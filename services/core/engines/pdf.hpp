#pragma once
#include "common.hpp"

namespace cw {
// Minimal PDF 1.4 writer: A4 pages, Helvetica text, wrapped paragraphs, tables, branded header and numbered footer.
class PdfDocument {
public:
    PdfDocument(std::string title, std::string subtitle, std::string generated);
    void heading(const std::string& text);
    void paragraph(const std::string& text);
    void note(const std::string& text);
    void keyValues(const std::vector<std::pair<std::string, std::string>>& rows);
    // Weights set relative column widths. Numeric-looking cells are right aligned.
    void table(const std::vector<std::string>& columns, const std::vector<std::vector<std::string>>& rows, const std::vector<double>& weights = {});
    std::string render() const;
    std::string base64() const;
    static std::string inr(Money paise);
private:
    struct Page { std::string content; };
    std::string title_, subtitle_, generated_;
    std::vector<Page> pages_;
    double y_ = 0;
    void newPage();
    void ensure(double height);
    void text(double x, double y, const std::string& value, double size, bool bold, const char* colour = "0.1 0.15 0.12");
    void rect(double x, double y, double w, double h, const char* colour);
    // Draws the CredWise 360 logo (dark-theme colours, for the charcoal header) with its lower-left corner at (x, y).
    void logo(double x, double y, double height);
    std::vector<std::string> wrap(const std::string& value, double width, double size, bool bold) const;
};
}
