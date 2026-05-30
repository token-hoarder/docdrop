# DocDrop

Convert **PDF, Word, Excel, PowerPoint, images, audio, and more** to clean Markdown — right in your browser. Drag, drop, done. Runs 100% locally, nothing leaves your machine.

---

## ✨ Features

- 📄 **Drag & drop** any file to convert instantly
- 👁️ **Live preview** — rendered Markdown side-by-side with raw source
- 📋 **Copy** to clipboard or **download** the `.md` file in one click
- 🕓 **History sidebar** — last 10 conversions saved in your browser
- 🔍 **OCR support** — extract text from scanned PDFs and images (optional)
- 🌗 **Dark / Light** theme toggle
- 🖥️ Runs entirely **locally** — no accounts, no uploads, no cloud

### Supported Formats
`PDF` `DOCX` `XLSX` `PPTX` `HTML` `CSV` `JSON` `XML` `ZIP` `EPUB` `MP3` `WAV` `JPG` `PNG` `BMP` `GIF` and more.

---

## 🚀 Quick Start

### What you need first
- **Python 3.9 or newer** — [Download here](https://www.python.org/downloads/)
- **Git** (only if cloning) — [Download here](https://git-scm.com/)

---

### macOS / Linux

**Step 1 — Get the project**
```bash
git clone https://github.com/token-hoarder/docdrop.git
cd docdrop
```

**Step 2 — Start it**
```bash
chmod +x run.sh
./run.sh
```

Your browser will open automatically at **http://127.0.0.1:8000**. Done!

---

### Windows

**Step 1 — Get the project**
```bat
git clone https://github.com/token-hoarder/docdrop.git
cd docdrop
```

**Step 2 — Start it**

Double-click `run.bat`, or from Command Prompt:
```bat
run.bat
```

Your browser will open automatically at **http://127.0.0.1:8000**. Done!

---

### Next time you run it

Just run the same script again — it detects your existing setup and starts instantly.

```bash
./run.sh       # macOS / Linux
run.bat        # Windows
```

---

## 🔍 OCR — Extract Text from Scanned Files (Optional)

Normal PDFs have text you can select — those convert fine with no extra setup.

**Scanned PDFs and images** (photos of documents, scanned pages) contain no selectable text. OCR reads them like a human would. Two engines are available:

---

### Option A: Tesseract (fast, lightweight)

**macOS:**
```bash
brew install tesseract poppler
pip install pytesseract pdf2image
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install tesseract-ocr poppler-utils
pip install pytesseract pdf2image
```

**Windows:**
1. Download and install [Tesseract for Windows](https://github.com/UB-Mannheim/tesseract/wiki)
2. Then run:
```bat
pip install pytesseract pdf2image
```
> Also install [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases) and add it to your PATH.

---

### Option B: Surya (more accurate, uses AI)

> **Heads up:** Downloads ~1.4 GB of AI models on first use. Requires [llama.cpp](https://github.com/ggerganov/llama.cpp).

**macOS (Apple Silicon recommended):**
```bash
brew install llama.cpp
pip install surya-ocr
```

**Linux / Windows:** See the [Surya install guide](https://github.com/VikParuchuri/surya).

---

### Using OCR in the app

1. Drop a scanned PDF or image onto the app
2. An **OCR panel** appears automatically
3. Pick **Tesseract** or **Surya** and click **Convert**

The OCR panel only shows up when it's needed — it stays hidden for regular files.

---

## 📁 Project Structure

```
docdrop/
├── run.sh                  # One-click startup (macOS / Linux)
├── run.bat                 # One-click startup (Windows)
├── requirements.txt        # Core dependencies
├── requirements-ocr.txt    # Optional OCR dependencies
├── app/
│   ├── main.py             # FastAPI backend
│   └── static/
│       ├── index.html      # Single-page web app
│       ├── style.css       # Dark/light theme
│       └── app.js          # Frontend logic
└── packages/
    └── markitdown/         # Core document conversion library
```

---

## 🛑 Stopping the Server

Press **`Ctrl + C`** in the terminal where the server is running.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| `command not found: python3` | Install Python 3.9+ from [python.org](https://www.python.org/downloads/) |
| Port 8000 already in use | Kill the other process or change `PORT=8000` in `run.sh` / `run.bat` |
| Conversion fails for a file | Rerun `run.sh` / `run.bat` to reinstall dependencies |
| Browser doesn't open | Go to [http://127.0.0.1:8000](http://127.0.0.1:8000) manually |
| OCR panel doesn't appear | Drop a scanned PDF or image — it only shows when needed |
| Tesseract not found | Make sure `brew install tesseract` (or `apt install tesseract-ocr`) ran successfully |
| Surya download is slow | First run downloads ~1.4 GB — just wait, it caches for next time |

---

## 🤝 Contributing

Bug reports and pull requests are welcome! Open an [issue](https://github.com/token-hoarder/docdrop/issues) to get started.

---

## 📜 License

MIT — see [LICENSE](LICENSE).
