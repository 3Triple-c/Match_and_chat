import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const MAX_IMPORTED_TEXT = 12000;

const normalizeExtractedText = value =>
  value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();

export const importStudyMaterial = async ({
  fileName = "",
  mimeType = "",
  contentBase64 = "",
}) => {
  if (!contentBase64) {
    throw new Error("No file content was provided");
  }

  const buffer = Buffer.from(contentBase64, "base64");
  const loweredName = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" || loweredName.endsWith(".pdf");

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    const text = normalizeExtractedText(parsed.text || "").slice(0, MAX_IMPORTED_TEXT);
    if (!text) {
      throw new Error(
        "No readable text was found in the PDF. If this is a scanned or image-only PDF, paste the text or use a text-based file instead.",
      );
    }

    return {
      sourceType: "pdf",
      sourceLabel: fileName || "Imported PDF",
      sourceText: text,
    };
  }

  const text = normalizeExtractedText(buffer.toString("utf8")).slice(
    0,
    MAX_IMPORTED_TEXT,
  );
  if (!text) {
    throw new Error("No readable text was found in the uploaded file");
  }

  return {
    sourceType: "notes",
    sourceLabel: fileName || "Imported notes",
    sourceText: text,
  };
};
