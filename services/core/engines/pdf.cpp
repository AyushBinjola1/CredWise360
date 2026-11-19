#include "engines/pdf.hpp"
#include <iomanip>
#include <sstream>

namespace cw {
namespace {
constexpr double pageWidth = 595, pageHeight = 842, margin = 48, headerHeight = 62, footerHeight = 40;

// Replace characters outside the base-14 font set so every byte in the file is plain ASCII.
std::string ascii(const std::string& in) {
    std::string out;
    for (size_t i = 0; i < in.size(); ++i) {
        const unsigned char c = in[i];
        if (c < 0x80) { if (c >= 32 || c == '\t') out += static_cast<char>(c); continue; }
        if (in.compare(i, 3, "\xE2\x82\xB9") == 0) { out += "INR "; i += 2; }
        else if (in.compare(i, 2, "\xC2\xB7") == 0) { out += "-"; i += 1; }
        else if (in.compare(i, 3, "\xE2\x80\x94") == 0 || in.compare(i, 3, "\xE2\x80\x93") == 0) { out += "-"; i += 2; }
        else if (in.compare(i, 3, "\xE2\x80\x99") == 0 || in.compare(i, 3, "\xE2\x80\x98") == 0) { out += "'"; i += 2; }
        else if (in.compare(i, 3, "\xE2\x80\x9C") == 0 || in.compare(i, 3, "\xE2\x80\x9D") == 0) { out += "\""; i += 2; }
        else { out += '?'; while (i + 1 < in.size() && (static_cast<unsigned char>(in[i + 1]) & 0xC0) == 0x80) ++i; }
    }
    return out;
}
std::string escape(const std::string& in) {
    std::string out;
    for (char c : ascii(in)) { if (c == '(' || c == ')' || c == '\\') out += '\\'; out += c; }
    return out;
}
double glyph(char c) {
    if (std::string("ilj.,:;'!|I ").find(c) != std::string::npos) return 0.28;
    if (std::string("ftr()[]-/").find(c) != std::string::npos) return 0.36;
    if (c == 'm' || c == 'w' || c == 'M' || c == 'W') return 0.82;
    if (c >= 'A' && c <= 'Z') return 0.68;
    if (c >= '0' && c <= '9') return 0.556;
    return 0.52;
}
double width(const std::string& value, double size, bool bold) {
    double total = 0;
    for (char c : ascii(value)) total += glyph(c);
    return total * size * (bold ? 1.06 : 1.0);
}
bool numeric(const std::string& cell) {
    return !cell.empty() && (std::isdigit(static_cast<unsigned char>(cell[0])) || cell.rfind("INR", 0) == 0 || cell.rfind("-INR", 0) == 0 ||
                             (cell[0] == '-' && cell.size() > 1 && std::isdigit(static_cast<unsigned char>(cell[1]))));
}
std::string number(double v) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << v;
    return out.str();
}
}

PdfDocument::PdfDocument(std::string title, std::string subtitle, std::string generated)
    : title_(std::move(title)), subtitle_(std::move(subtitle)), generated_(std::move(generated)) { newPage(); }

std::string PdfDocument::inr(Money paise) {
    const bool negative = paise < 0;
    const Money magnitude = negative ? -paise : paise;
    std::string whole = std::to_string(magnitude / 100), grouped;
    for (size_t i = 0; i < whole.size(); ++i) {
        const size_t remaining = whole.size() - i;
        grouped += whole[i];
        const size_t after = remaining - 1;  // Indian grouping: last three digits, then pairs
        if (after >= 3 && after % 2 == 1) grouped += ',';
    }
    return std::string(negative ? "-" : "") + "INR " + grouped + "." + std::to_string(100 + magnitude % 100).substr(1);
}
void PdfDocument::newPage() {
    pages_.push_back({});
    rect(0, pageHeight - headerHeight, pageWidth, headerHeight, "0.098 0.243 0.18");
    text(margin, pageHeight - 30, "CredWise 360", 15, true, "1 1 1");
    text(margin, pageHeight - 48, "Educational lending simulation - synthetic data", 8.5, false, "0.85 0.92 0.87");
    text(pageWidth - margin - width(title_, 11, true), pageHeight - 30, title_, 11, true, "1 1 1");
    y_ = pageHeight - headerHeight - 30;
    if (pages_.size() == 1) {
        text(margin, y_, title_, 20, true, "0.098 0.243 0.18");
        y_ -= 18;
        if (!subtitle_.empty()) { text(margin, y_, subtitle_, 10, false, "0.35 0.42 0.38"); y_ -= 14; }
        y_ -= 10;
    }
}
void PdfDocument::ensure(double height) { if (y_ - height < footerHeight + 12) newPage(); }
void PdfDocument::text(double x, double y, const std::string& value, double size, bool bold, const char* colour) {
    pages_.back().content += "BT /" + std::string(bold ? "F2" : "F1") + " " + number(size) + " Tf " + colour + " rg " +
                             number(x) + " " + number(y) + " Td (" + escape(value) + ") Tj ET\n";
}
void PdfDocument::rect(double x, double y, double w, double h, const char* colour) {
    pages_.back().content += std::string(colour) + " rg " + number(x) + " " + number(y) + " " + number(w) + " " + number(h) + " re f\n";
}
std::vector<std::string> PdfDocument::wrap(const std::string& value, double maxWidth, double size, bool bold) const {
    std::vector<std::string> lines;
    std::istringstream words(ascii(value));
    std::string line, word;
    while (words >> word) {
        const std::string candidate = line.empty() ? word : line + " " + word;
        if (!line.empty() && width(candidate, size, bold) > maxWidth) { lines.push_back(line); line = word; }
        else line = candidate;
    }
    if (!line.empty()) lines.push_back(line);
    if (lines.empty()) lines.push_back("");
    return lines;
}
void PdfDocument::heading(const std::string& value) {
    ensure(44);
    y_ -= 12;
    text(margin, y_, value, 13, true, "0.098 0.243 0.18");
    rect(margin, y_ - 5, pageWidth - 2 * margin, 0.8, "0.7 0.8 0.74");
    y_ -= 20;
}
void PdfDocument::paragraph(const std::string& value) {
    for (const auto& line : wrap(value, pageWidth - 2 * margin, 10, false)) { ensure(15); text(margin, y_, line, 10, false); y_ -= 14; }
    y_ -= 4;
}
void PdfDocument::note(const std::string& value) {
    for (const auto& line : wrap(value, pageWidth - 2 * margin, 8.5, false)) { ensure(13); text(margin, y_, line, 8.5, false, "0.4 0.45 0.42"); y_ -= 12; }
    y_ -= 4;
}
void PdfDocument::keyValues(const std::vector<std::pair<std::string, std::string>>& rows) {
    const double labelWidth = 190;
    bool shade = false;
    for (const auto& [label, value] : rows) {
        const auto lines = wrap(value, pageWidth - 2 * margin - labelWidth - 12, 10, false);
        const double height = 16 + 13 * (lines.size() - 1);
        ensure(height);
        if (shade) rect(margin, y_ - height + 12, pageWidth - 2 * margin, height, "0.95 0.97 0.95");
        shade = !shade;
        text(margin + 6, y_, label, 10, true, "0.25 0.32 0.28");
        double line = y_;
        for (const auto& piece : lines) { text(margin + labelWidth, line, piece, 10, false); line -= 13; }
        y_ -= height;
    }
    y_ -= 6;
}
void PdfDocument::table(const std::vector<std::string>& columns, const std::vector<std::vector<std::string>>& rows, const std::vector<double>& weights) {
    const double total = pageWidth - 2 * margin;
    std::vector<double> w(columns.size(), 1.0);
    for (size_t i = 0; i < weights.size() && i < w.size(); ++i) w[i] = weights[i];
    double sum = 0;
    for (double v : w) sum += v;
    for (double& v : w) v = total * v / sum;
    auto header = [&] {
        ensure(26);
        rect(margin, y_ - 6, total, 19, "0.098 0.243 0.18");
        double x = margin;
        for (size_t i = 0; i < columns.size(); ++i) {
            const bool right = i > 0 && rows.size() && numeric(rows.front()[i]);
            text(right ? x + w[i] - 5 - width(columns[i], 8.5, true) : x + 5, y_ - 1, columns[i], 8.5, true, "1 1 1");
            x += w[i];
        }
        y_ -= 20;
    };
    header();
    bool shade = false;
    for (const auto& row : rows) {
        if (y_ - 18 < footerHeight + 12) { newPage(); header(); }
        if (shade) rect(margin, y_ - 5, total, 16, "0.95 0.97 0.95");
        shade = !shade;
        double x = margin;
        for (size_t i = 0; i < columns.size() && i < row.size(); ++i) {
            std::string cell = ascii(row[i]);
            while (cell.size() > 3 && width(cell, 8.5, false) > w[i] - 10) cell.pop_back();
            if (cell.size() != ascii(row[i]).size()) cell += "..";
            text(numeric(row[i]) && i > 0 ? x + w[i] - 5 - width(cell, 8.5, false) : x + 5, y_, cell, 8.5, false);
            x += w[i];
        }
        y_ -= 16;
    }
    y_ -= 8;
}
std::string PdfDocument::render() const {
    std::string out = "%PDF-1.4\n";
    std::vector<size_t> offsets;
    auto object = [&](const std::string& body) { offsets.push_back(out.size()); out += std::to_string(offsets.size()) + " 0 obj\n" + body + "\nendobj\n"; };
    const size_t count = pages_.size();
    object("<< /Type /Catalog /Pages 2 0 R >>");
    std::string kids;
    for (size_t i = 0; i < count; ++i) kids += std::to_string(5 + 2 * i) + " 0 R ";
    object("<< /Type /Pages /Kids [" + kids + "] /Count " + std::to_string(count) + " >>");
    object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    for (size_t i = 0; i < count; ++i) {
        object("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + std::to_string(6 + 2 * i) + " 0 R >>");
        const std::string footer = "BT /F1 8 Tf 0.4 0.45 0.42 rg " + number(margin) + " 24 Td (" + escape("Educational simulation - not a real financial document. Generated " + generated_ + " - Page " +
                                   std::to_string(i + 1) + " of " + std::to_string(count)) + ") Tj ET\n";
        const std::string content = pages_[i].content + footer;
        object("<< /Length " + std::to_string(content.size()) + " >>\nstream\n" + content + "endstream");
    }
    const size_t xref = out.size();
    out += "xref\n0 " + std::to_string(offsets.size() + 1) + "\n0000000000 65535 f \n";
    for (size_t offset : offsets) { std::ostringstream line; line << std::setw(10) << std::setfill('0') << offset << " 00000 n \n"; out += line.str(); }
    out += "trailer\n<< /Size " + std::to_string(offsets.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + std::to_string(xref) + "\n%%EOF\n";
    return out;
}
std::string PdfDocument::base64() const {
    static const char* table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const std::string bytes = render();
    std::string out;
    for (size_t i = 0; i < bytes.size(); i += 3) {
        const unsigned v = (static_cast<unsigned char>(bytes[i]) << 16) | (i + 1 < bytes.size() ? static_cast<unsigned char>(bytes[i + 1]) << 8 : 0) |
                           (i + 2 < bytes.size() ? static_cast<unsigned char>(bytes[i + 2]) : 0);
        out += table[(v >> 18) & 63]; out += table[(v >> 12) & 63];
        out += i + 1 < bytes.size() ? table[(v >> 6) & 63] : '='; out += i + 2 < bytes.size() ? table[v & 63] : '=';
    }
    return out;
}
}
