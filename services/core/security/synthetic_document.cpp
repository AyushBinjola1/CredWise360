#include "security/synthetic_document.hpp"
#include "security/credentials.hpp"
namespace cw {
Json storeSyntheticDocument(Database& db, const std::string& userId, const Json& doc) {
    require(doc.is_object(), "Attach a synthetic proof document.");
    auto name=field(doc,"name",120), mime=field(doc,"mime",60), encoded=field(doc,"content_base64",350000);
    require(name.find_first_of("/\\:*?\"<>|\r\n\t") == std::string::npos && name != "." && name != "..",
            "Use a plain document filename.");
    auto bytes=security::decodeDocument(encoded);
    const std::string marker="CREDWISE-SYNTHETIC";
    if (mime=="text/plain") {
        require(bytes.starts_with(marker) && bytes.find('\0') == std::string::npos,
                "Use a text file beginning with CREDWISE-SYNTHETIC.");
        try { (void)Json(bytes).dump(); }
        catch (const Json::exception&) { throw Error(422,"validation","The text file must contain valid UTF-8."); }
    } else if (mime=="application/pdf") {
        require(bytes.starts_with("%PDF-") && bytes.find(marker)!=std::string::npos,
                "Use a synthetic PDF containing CREDWISE-SYNTHETIC.");
    } else throw Error(422,"validation","Use a synthetic PDF or plain text document.");
    return db.one("INSERT INTO synthetic_documents(user_id,name,mime,contents,sha256) VALUES($1,$2,$3,decode($4,'base64'),$5) RETURNING id",
                  {userId,name,mime,encoded,security::digest(bytes)});
}
}
