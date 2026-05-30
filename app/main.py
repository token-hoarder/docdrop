import os
import sys
import time
import logging
import tempfile
import shutil
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ── Logger ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("docdrop")

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_SRC = os.path.join(ROOT_DIR, "packages", "markitdown", "src")
if os.path.exists(LOCAL_SRC) and LOCAL_SRC not in sys.path:
    sys.path.insert(0, LOCAL_SRC)

try:
    from markitdown import MarkItDown
except ImportError:
    raise RuntimeError("Could not import markitdown. Ensure it is installed or path is correct.")

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.bmp', '.gif'}

# Lazy-loaded, cached OCR models
_surya_predictor = None

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocDrop", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OCR helpers ───────────────────────────────────────────────────────────────

def pdf_needs_ocr(file_path: str, threshold: int = 100) -> bool:
    """Fast check using pdfminer: sparse text on first 2 pages → image-based PDF."""
    try:
        from pdfminer.high_level import extract_text
        t0 = time.perf_counter()
        text = extract_text(file_path, maxpages=2)
        char_count = len(text.strip())
        elapsed = time.perf_counter() - t0
        result = char_count < threshold
        log.info(
            "PDF OCR check — %d chars in %.2fs → %s",
            char_count, elapsed,
            "OCR needed (image-based)" if result else "text-based, skipping OCR",
        )
        return result
    except Exception as exc:
        log.warning("PDF OCR check failed (%s), assuming text-based", exc)
        return False


def pdf_to_images(file_path: str):
    """Convert PDF pages to PIL images (requires poppler)."""
    try:
        from pdf2image import convert_from_path
        log.info("PDF→images — converting at 200 dpi...")
        t0 = time.perf_counter()
        images = convert_from_path(file_path, dpi=200)
        log.info("PDF→images — %d page(s) ready in %.2fs", len(images), time.perf_counter() - t0)
        return images
    except ImportError:
        raise HTTPException(status_code=400, detail="pdf2image not installed. Run: pip install pdf2image")
    except Exception as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("poppler", "pdftoppm", "pdfinfo")):
            raise HTTPException(
                status_code=400,
                detail="poppler not found. Install with: brew install poppler (macOS) or sudo apt install poppler-utils (Linux)"
            )
        raise HTTPException(status_code=500, detail=f"PDF→image conversion failed: {msg}")


def ocr_tesseract(images) -> str:
    try:
        import pytesseract
    except ImportError:
        raise HTTPException(
            status_code=400,
            detail="pytesseract not installed. Run: pip install pytesseract (also needs: brew install tesseract)"
        )

    log.info("Tesseract — running on %d image(s)", len(images))
    t0 = time.perf_counter()
    pages = []
    for i, img in enumerate(images, 1):
        page_t0 = time.perf_counter()
        text = pytesseract.image_to_string(img).strip()
        log.info("  page %d/%d — %d chars in %.2fs", i, len(images), len(text), time.perf_counter() - page_t0)
        if text:
            pages.append(f"## Page {i}\n\n{text}")

    log.info(
        "Tesseract — done in %.2fs | %d page(s) with text, %d total chars",
        time.perf_counter() - t0, len(pages), sum(len(p) for p in pages),
    )
    return "\n\n".join(pages)


def _html_to_text(html_str: str) -> str:
    """Convert Surya block HTML to plain text, preserving newlines at block boundaries."""
    import re
    from html import unescape
    from html.parser import HTMLParser

    class _Extractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []

        def handle_starttag(self, tag, attrs):
            if tag in ("br", "p", "tr", "li", "h1", "h2", "h3", "h4"):
                self.parts.append("\n")

        def handle_endtag(self, tag):
            if tag in ("p", "tr", "td", "th", "h1", "h2", "h3", "h4"):
                self.parts.append(" ")

        def handle_data(self, data):
            self.parts.append(data)

    parser = _Extractor()
    parser.feed(html_str)
    text = "".join(parser.parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return unescape(text).strip()


def ocr_surya(images) -> str:
    global _surya_predictor
    try:
        from surya.recognition import RecognitionPredictor
        from surya.inference import SuryaInferenceManager
    except ImportError:
        raise HTTPException(status_code=400, detail="surya-ocr not installed. Run: pip install surya-ocr")

    if _surya_predictor is None:
        log.info("Surya — loading model (first use, GGUF ~1.4 GB)...")
        t0 = time.perf_counter()
        _surya_predictor = RecognitionPredictor(SuryaInferenceManager())
        log.info("Surya — model ready in %.2fs", time.perf_counter() - t0)
    else:
        log.info("Surya — using cached predictor")

    log.info("Surya — processing %d page(s) one by one via llama-server...", len(images))
    t0 = time.perf_counter()
    pages = []

    for i, img in enumerate(images, 1):
        log.info("  page %d/%d — sending to VLM...", i, len(images))
        page_t0 = time.perf_counter()

        results = _surya_predictor([img], full_page=True)
        page = results[0]

        blocks = sorted(page.blocks, key=lambda b: b.reading_order)
        non_skipped = [b for b in blocks if not b.skipped and not b.error and b.html]
        lines = [ln for ln in (_html_to_text(b.html) for b in non_skipped) if ln]
        text = "\n\n".join(lines)

        log.info(
            "  page %d/%d — done in %.2fs | %d block(s), %d chars",
            i, len(images), time.perf_counter() - page_t0, len(non_skipped), len(text),
        )
        if text:
            pages.append(f"## Page {i}\n\n{text}")

    log.info(
        "Surya — all pages done in %.2fs | %d page(s) with text, %d total chars",
        time.perf_counter() - t0, len(pages), sum(len(p) for p in pages),
    )
    return "\n\n".join(pages)


def run_ocr(images, engine: str) -> str:
    if engine == "tesseract":
        return ocr_tesseract(images)
    if engine == "surya":
        return ocr_surya(images)
    raise HTTPException(status_code=400, detail=f"Unknown OCR engine: {engine}")


# ── Engine availability probe ─────────────────────────────────────────────────

@app.get("/api/ocr-engines")
async def get_ocr_engines():
    """Returns OCR engines available in this Python environment."""
    available = []

    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        available.append("tesseract")
    except Exception:
        pass

    try:
        import surya  # noqa: F401
        import shutil
        if shutil.which("llama-server") or shutil.which("vllm"):
            available.append("surya")
    except Exception:
        pass

    log.info("Engine probe → available: %s", available or ["none"])
    return {"engines": available}


# ── Main conversion endpoint ──────────────────────────────────────────────────

@app.post("/api/convert")
async def convert_document(
    file: Optional[UploadFile] = File(None),
    ocr_engine: Optional[str] = Form("none"),
):
    if not file:
        raise HTTPException(status_code=400, detail="A file upload is required.")

    size_kb = round((file.size or 0) / 1024, 1)
    suffix = os.path.splitext(file.filename)[1]
    log.info("Conversion request — file=%r size=%s KB engine=%s", file.filename, size_kb, ocr_engine)

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        temp_file_path = tmp.name

    try:
        t0 = time.perf_counter()
        log.info("markitdown — converting %r...", file.filename)
        result = MarkItDown().convert(temp_file_path)
        markdown = result.text_content
        log.info(
            "markitdown — done in %.2fs | %d chars extracted",
            time.perf_counter() - t0, len(markdown.strip()),
        )
        ocr_used = False

        if ocr_engine and ocr_engine != "none":
            ext = suffix.lower()
            needs_ocr = False

            if ext in IMAGE_EXTENSIONS:
                log.info("Image file detected — OCR will run unconditionally")
                needs_ocr = True
            elif ext == ".pdf":
                needs_ocr = pdf_needs_ocr(temp_file_path)

            if needs_ocr:
                if ext in IMAGE_EXTENSIONS:
                    from PIL import Image
                    images = [Image.open(temp_file_path).convert("RGB")]
                    log.info("Loaded image as single-page input")
                else:
                    images = pdf_to_images(temp_file_path)

                ocr_result = run_ocr(images, ocr_engine)
                if ocr_result.strip():
                    markdown = ocr_result
                    ocr_used = True
                else:
                    log.warning("OCR returned empty output — keeping markitdown result")
            else:
                log.info("OCR not needed — using markitdown output")

        log.info(
            "Done — ocr_used=%s engine=%s | %d words",
            ocr_used, ocr_engine if ocr_used else "n/a", len(markdown.split()),
        )

        return {
            "success": True,
            "filename": file.filename,
            "size_bytes": os.path.getsize(temp_file_path),
            "markdown": markdown,
            "ocr_used": ocr_used,
            "ocr_engine": ocr_engine if ocr_used else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("Conversion failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


# ── Static frontend ───────────────────────────────────────────────────────────
static_path = os.path.join(ROOT_DIR, "app", "static")
if os.path.exists(static_path):
    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
else:
    @app.get("/")
    def welcome():
        return {"message": "Server running. Please create the app/static directory."}
