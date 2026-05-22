from pathlib import Path

from docx import Document
from pypdf import PdfReader
from striprtf.striprtf import rtf_to_text


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".rtf"}


def extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(file_path)
    if suffix == ".docx":
        return _extract_docx(file_path)
    if suffix == ".rtf":
        return _extract_rtf(file_path)
    if suffix in {".txt", ".doc"}:
        return _extract_plain(file_path)

    raise ValueError(f"Unsupported file type: {suffix}")


def _extract_pdf(file_path: Path) -> str:
    reader = PdfReader(str(file_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def _extract_docx(file_path: Path) -> str:
    doc = Document(str(file_path))
    paragraphs = [p.text for p in doc.paragraphs]
    return "\n".join(paragraphs).strip()


def _extract_rtf(file_path: Path) -> str:
    raw = file_path.read_text(encoding="utf-8", errors="ignore")
    return rtf_to_text(raw).strip()


def _extract_plain(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8", errors="ignore").strip()
