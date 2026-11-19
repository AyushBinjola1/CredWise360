#include "security/accounts.hpp"
#include <set>
#include "security/credentials.hpp"
#include <cctype>

namespace cw {
namespace {
const std::string userFields = "id,name,email,role,active,created_at";
std::string normalizedEmail(const Json& body) {
    auto email = field(body, "email", 254);
    const auto first = email.find_first_not_of(" \t\r\n"), last = email.find_last_not_of(" \t\r\n");
    email = email.substr(first, last - first + 1);
    for (char& ch : email) if (ch >= 'A' && ch <= 'Z') ch += 'a' - 'A';
    const auto at = email.find('@');
    require(at != std::string::npos && at > 0 && at <= 64 && at == email.rfind('@'), "Enter an email address.");
    require(email.find('.', at + 2) != std::string::npos && email.back() != '.' &&
            email[at + 1] != '.' && email.find("..") == std::string::npos, "Enter an email address.");
    for (size_t index = 0; index < email.size(); ++index) {
        const char c = email[index];
        require((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '.' || index == at ||
                (index < at && (c == '+' || c == '_')), "Enter an email address.");
    }
    return email;
}
std::string password(const Json& body, const std::string& key, bool creating) {
    auto text = field(body, key, 128);
    if (creating) require(text.size() >= 12, "Use a password with at least 12 characters.");
    return text;
}
std::string asId(const Json& row) { return std::to_string(row.at("id").get<std::int64_t>()); }

class AttemptWindow {
    Database& db_;
    Params key_;
public:
    AttemptWindow(Database& db, const Request& request, const std::string& email, const std::string& action)
        : db_(db), key_{security::digest(email), security::digest(request.remote), action} {
        db_.exec("SELECT pg_advisory_xact_lock(hashtextextended($1,402))", {key_[1]});
        db_.exec("SELECT pg_advisory_xact_lock(hashtextextended($1,403))", {key_[0]});
        auto count = db_.one(R"(
            SELECT count(*) FILTER (WHERE email_hash=$1 AND NOT success)::int AS email,
                   count(*) FILTER (WHERE remote_hash=$2 AND (NOT success OR action='register'))::int AS remote
            FROM auth_attempts WHERE action=$3 AND created_at > now()-interval '15 minutes'
              AND (email_hash=$1 OR remote_hash=$2))", key_);
        if (count["email"].get<int>() >= 8 || count["remote"].get<int>() >= 120)
            throw Error(429, "rate_limit", "Too many attempts. Try again in 15 minutes.");
    }
    void record(bool success) {
        Params values(key_);
        values.emplace_back(success ? "true" : "false");
        db_.exec("INSERT INTO auth_attempts(email_hash,remote_hash,action,success) VALUES($1,$2,$3,$4)", values);
    }
};

std::string newSession(Database& db, const std::string& id) {
    auto token = security::token();
    db.exec("DELETE FROM sessions WHERE user_id=$1 AND (expires_at<=now() OR last_seen_at<=now()-interval '1 hour')", {id});
    db.exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
            {security::digest(token),id});
    return security::sessionCookie(token);
}
Json readSettings(Database& db, const std::string& id) {
    auto row = db.one("SELECT " + userFields + ",preferences FROM users WHERE id=$1", {id});
    auto preferences = row.at("preferences");
    row.erase("preferences");
    return {{"user",row},{"preferences",preferences}};
}
Json mergePreferences(Json current, const Json& changes) {
    require(changes.is_object(), "Check the preference fields.");
    for (const auto& [key, value] : changes.items()) {
        if (key == "theme") require(value == "light" || value == "dark" || value == "system", "Choose a supported theme.");
        else if (key == "language") require(value == "en" || value == "hi", "Choose English or Hindi.");
        else if (key == "notifications") {
            require(value.is_object(), "Choose notification preferences.");
            for (const auto& [name, enabled] : value.items()) {
                require(current.at(key).contains(name) && enabled.is_boolean(), "Check the notification preference.");
                current[key][name] = enabled;
            }
            continue;
        } else throw Error(422, "validation", "Unknown preference.");
        current[key] = value;
    }
    return current;
}
}

std::unique_ptr<User> User::from(Json record) {
    if (record.at("role") == "admin") return std::make_unique<Administrator>(std::move(record));
    return std::make_unique<Customer>(std::move(record));
}
void identityAudit(Database& db, const std::string& actor, const std::string& subject,
                   const std::string& action, const Json& detail) {
    db.exec("INSERT INTO identity_audit(actor_id,subject_id,action,detail) VALUES(NULLIF($1,'')::bigint,NULLIF($2,'')::bigint,$3,$4::jsonb)",
            {actor,subject,action,detail.dump()});
}
Json createAccount(Database& db, const std::string& email, const std::string& name,
                   const std::string& secret, const std::string& role, const std::string& recovery) {
    auto user = db.one("INSERT INTO users(email,name,password_hash,role,recovery_hash) VALUES($1,$2,$3,$4,$5) RETURNING " + userFields,
                       {email,name,security::hashPassword(secret),role,security::digest(recovery)});
    db.exec("INSERT INTO financial_profiles(user_id) VALUES($1)", {asId(user)});
    identityAudit(db, asId(user), asId(user), "account.created");
    return user;
}
Json authenticate(Database& db, const Request& req, Permission permission) {
    if (req.session.size() != 64) throw Error(401, "unauthorized", "Sign in to continue.");
    auto rows = db.rows(R"(
        UPDATE sessions s SET last_seen_at=now() FROM users u
        WHERE s.user_id=u.id AND s.token_hash=$1 AND u.active AND s.expires_at>now()
          AND s.last_seen_at>now()-interval '1 hour'
        RETURNING u.id,u.name,u.email,u.role,u.active,u.created_at)", {security::digest(req.session)});
    if (rows.empty()) throw Error(401, "unauthorized", "Your session has expired. Sign in again.");
    auto user = User::from(std::move(rows.front()));
    if (!user->permits(permission)) throw Error(403, "forbidden", "Your account does not have access to this workspace.");
    return user->record();
}

std::optional<Response> authRoutes(Database& db, const Request& req) {
    if (req.path.size() != 2 || req.path.front() != "auth") return std::nullopt;
    const auto& action = req.path.back();
    if (action == "me" && req.method == "GET")
        return Response{{{"user",authenticate(db,req,Permission::ownAccount)}}};
    if (req.method != "POST") return std::nullopt;
    if (action == "logout") {
        if (!req.session.empty()) db.exec("DELETE FROM sessions WHERE token_hash=$1", {security::digest(req.session)});
        return Response{{{"logged_out",true}},200,security::sessionCookie("")};
    }
    if (action != "register" && action != "login" && action != "recover") return std::nullopt;
    const auto email = normalizedEmail(req.body);
    Transaction tx(db);
    AttemptWindow attempts(db, req, email, action);
    if (action == "register") {
        const auto name = field(req.body, "name", 100), secret = password(req.body,"password",true);
        if (email == "borrower@credwise.test" || email == "admin@credwise.test" ||
            !db.rows("SELECT id FROM users WHERE email=$1", {email}).empty()) {
            attempts.record(false);
            tx.commit();
            throw Error(409,"conflict","An account already uses that address.");
        }
        const auto code = security::token(16);
        auto user = createAccount(db,email,name,secret,"customer",code);
        auto cookie = newSession(db,asId(user));
        attempts.record(true);
        tx.commit();
        return Response{{{"user",user},{"recovery_code",code}},201,cookie};
    }
    auto users = db.rows("SELECT id,active,password_hash,recovery_hash FROM users WHERE email=$1 FOR UPDATE", {email});
    bool active = !users.empty() && users.front().at("active") == true;
    const std::string id = users.empty() ? "" : asId(users.front());
    if (action == "login") {
        // Use the same derivation cost when an address has no account.
        const auto dummy = "pbkdf2-sha256$600000$" + std::string(32,'0') + "$" + std::string(64,'0');
        const auto stored = users.empty() ? dummy : users.front().at("password_hash").get<std::string>();
        bool valid = security::matchesPassword(password(req.body,"password",false), stored);
        attempts.record(active && valid);
        if (!valid || !active) {
            if (!id.empty()) identityAudit(db,"",id,"security.login_failed");
            tx.commit();
            throw Error(401,"invalid_credentials","The email or password is incorrect.");
        }
        const auto cookie = newSession(db,id);
        auto user = db.one("SELECT " + userFields + " FROM users WHERE id=$1", {id});
        tx.commit();
        return Response{{{"user",user}},200,cookie};
    }
    const auto supplied = security::digest(field(req.body,"recovery_code",128));
    const auto secret = password(req.body,"new_password",true);
    bool valid = !users.empty() && security::equals(supplied,users.front().at("recovery_hash").get<std::string>());
    attempts.record(valid && active);
    if (!active || !valid) {
        tx.commit();
        throw Error(401,"invalid_recovery","The address or recovery code is incorrect.");
    }
    auto replacement = security::token(16);
    db.exec("UPDATE users SET password_hash=$2,recovery_hash=$3,updated_at=now() WHERE id=$1",
            {id,security::hashPassword(secret),security::digest(replacement)});
    db.exec("DELETE FROM sessions WHERE user_id=$1", {id});
    identityAudit(db,id,id,"security.account_recovered");
    tx.commit();
    return Response{{{"recovery_code",replacement}},200,security::sessionCookie("")};
}

bool sharedDemoAccount(const std::string& email) {
    if (setting("DEMO_PROTECT") != "1") return false;
    static const std::set<std::string> accounts = {"borrower@credwise.test","admin@credwise.test","diya.nair@credwise.test","rohan.iyer@credwise.test"};
    return accounts.contains(email);
}
void blockSharedDemoChange(const Json& user, const std::string& what) {
    if (user.is_object() && user.contains("email") && user.at("email").is_string() && sharedDemoAccount(user.at("email")))
        throw Error(403,"demo_protected","The shared demonstration keeps " + what + " fixed so every visitor sees the same data. Register your own account to try this.");
}
Response settingsRoute(Database& db, const Request& req) {
    const auto user = authenticate(db,req,Permission::ownAccount);
    const auto id = asId(user);
    if (req.method == "GET") return {readSettings(db,id)};
    const auto& body = req.body;
    require(!body.empty(), "Choose a setting to update.");
    for (const auto& [key,value] : body.items())
        require(key == "name" || key == "preferences" || key == "new_password" ||
                key == "current_password" || key == "active", "Unknown account setting.");
    Transaction tx(db);
    const auto account = db.one("SELECT active,password_hash,preferences FROM users WHERE id=$1 FOR UPDATE", {id});
    if (account.at("active") != true) throw Error(401,"unauthorized","This account is inactive.");
    bool deactivate = body.contains("active");
    if (deactivate || body.contains("new_password") || body.contains("name")) blockSharedDemoChange(user, "its name, password and status");
    if (deactivate) {
        require(body.at("active") == false, "Contact support to reactivate an account.");
        if (user.at("role") == "admin") throw Error(403,"forbidden","Administrators must retain workspace access.");
    }
    if (deactivate || body.contains("new_password")) {
        const auto secret = password(body,"current_password",false);
        if (!security::matchesPassword(secret,account.at("password_hash").get<std::string>()))
            throw Error(401,"invalid_credentials","Current password is incorrect.");
    }
    if (body.contains("name")) db.exec("UPDATE users SET name=$2,updated_at=now() WHERE id=$1", {id,field(body,"name",100)});
    if (body.contains("preferences"))
        db.exec("UPDATE users SET preferences=$2::jsonb,updated_at=now() WHERE id=$1",
                {id,mergePreferences(account.at("preferences"),body.at("preferences")).dump()});
    std::string cookie;
    if (body.contains("new_password")) {
        const auto secret = password(body,"new_password",true);
        db.exec("UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1", {id,security::hashPassword(secret)});
        db.exec("DELETE FROM sessions WHERE user_id=$1",{id});
        if (!deactivate) cookie = newSession(db,id);
        identityAudit(db,id,id,"security.password_changed");
    }
    if (deactivate) {
        db.exec("UPDATE users SET active=false,updated_at=now() WHERE id=$1", {id});
        db.exec("DELETE FROM sessions WHERE user_id=$1", {id});
        cookie = security::sessionCookie("");
        identityAudit(db,id,id,"account.deactivated");
    }
    auto data = readSettings(db,id);
    tx.commit();
    return {data,200,cookie};
}
}
