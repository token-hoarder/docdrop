/* ==========================================================================
   MARKITDOWN WEB HUB - CLIENT INTERACTIVE SYSTEM
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // State Variables
    // ----------------------------------------------------------------------
    let selectedFile = null;
    let conversionHistory = JSON.parse(localStorage.getItem("mid_history") || "[]");
    let currentMarkdown = "";
    let currentFilename = "";
    let selectedOcrEngine = "none";

    // ----------------------------------------------------------------------
    // DOM Element Selection
    // ----------------------------------------------------------------------
    // Sidebar
    const historySidebar = document.getElementById("historySidebar");
    const toggleSidebarBtn = document.getElementById("toggleSidebar");
    const closeSidebarBtn = document.getElementById("closeSidebar");
    const historyList = document.getElementById("historyList");
    const clearHistoryBtn = document.getElementById("clearHistory");

    // Theme & Header
    const themeToggleBtn = document.getElementById("themeToggle");

    // File Upload Pane
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.getElementById("browseBtn");
    const filePreviewZone = document.getElementById("filePreviewZone");
    const fileNameSpan = document.getElementById("fileName");
    const fileSizeSpan = document.getElementById("fileSize");
    const removeFileBtn = document.getElementById("removeFile");


    // Workspace & Previews
    const btnPreviewTab = document.getElementById("btnPreviewTab");
    const btnRawTab = document.getElementById("btnRawTab");
    const wordCountSpan = document.getElementById("wordCount");
    const copyBtn = document.getElementById("copyBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const emptyWorkspace = document.getElementById("emptyWorkspace");
    const previewContainer = document.getElementById("previewContainer");
    const visualPreview = document.getElementById("visualPreview");
    const rawContainer = document.getElementById("rawContainer");
    const rawEditor = document.getElementById("rawEditor");

    // OCR
    const ocrCard = document.getElementById("ocrCard");
    const ocrNotice = document.getElementById("ocrNotice");
    const ocrNoticeText = document.getElementById("ocrNoticeText");
    const ocrPills = document.getElementById("ocrPills");
    const ocrConvertRow = document.getElementById("ocrConvertRow");
    const ocrConvertBtn = document.getElementById("ocrConvertBtn");
    const ocrConvertLabel = document.getElementById("ocrConvertLabel");
    const ocrBadge = document.getElementById("ocrBadge");
    const ocrBadgeLabel = document.getElementById("ocrBadgeLabel");
    const loadingTitle = document.getElementById("loadingTitle");
    const loadingSubtitle = document.getElementById("loadingSubtitle");

    // Notifications
    const toastContainer = document.getElementById("toastContainer");

    // ----------------------------------------------------------------------
    // Initialize Libraries
    // ----------------------------------------------------------------------
    lucide.createIcons();
    
    // Configure Marked.js options for beautiful layout
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true,
        mangle: false
    });

    // ----------------------------------------------------------------------
    // OCR Engine Selector
    // ----------------------------------------------------------------------
    const IMAGE_EXTS = new Set(["png","jpg","jpeg","webp","tiff","tif","bmp","gif"]);

    function getFileExt(filename) {
        return filename.split(".").pop().toLowerCase();
    }

    function showOcrSuggestion(message) {
        ocrNoticeText.textContent = message;
        ocrNotice.style.display = "flex";
        ocrCard.classList.remove("hidden");
        lucide.createIcons();
    }

    function hideOcrCard() {
        ocrCard.classList.add("hidden");
        // Reset engine selection back to Off
        selectedOcrEngine = "none";
        ocrPills.querySelectorAll(".ocr-pill").forEach(p => p.classList.remove("active"));
        ocrPills.querySelector('[data-engine="none"]').classList.add("active");
    }

    async function loadAvailableEngines() {
        try {
            const res = await fetch("/api/ocr-engines");
            const data = await res.json();
            const available = data.engines || [];
            ocrPills.querySelectorAll(".ocr-pill[data-engine]").forEach(pill => {
                const engine = pill.dataset.engine;
                if (engine === "none") return;
                if (available.includes(engine)) {
                    pill.disabled = false;
                    pill.title = pill.title.replace(" (not installed)", "");
                } else {
                    pill.disabled = true;
                    pill.title += " (not installed)";
                }
            });
        } catch (_) {
            // server not ready yet — pills stay disabled
        }
    }

    const MODEL_DOWNLOAD_SIZES = { surya: "~1.4 GB" };
    const warnedEngines = new Set();
    let progressInterval = null;

    const OCR_STEPS = {
        tesseract: [
            "Converting PDF pages to images...",
            "Running Tesseract OCR...",
            "Extracting text blocks...",
            "Assembling markdown output...",
        ],
        surya: [
            "Converting PDF pages to images...",
            "Starting Surya inference engine...",
            "Running vision model on document...",
            "Analysing layout and reading order...",
            "Processing text blocks...",
            "Assembling markdown output...",
        ],
    };

    function startProgressMessages(engine) {
        const steps = OCR_STEPS[engine] || ["Processing..."];
        const interval = engine === "surya" ? 3500 : 2000;
        let i = 0;

        loadingTitle.textContent = `Running OCR — ${engine.charAt(0).toUpperCase() + engine.slice(1)}`;
        loadingSubtitle.textContent = steps[0];

        progressInterval = setInterval(() => {
            i = Math.min(i + 1, steps.length - 1);
            loadingSubtitle.textContent = steps[i];
        }, interval);
    }

    function stopProgressMessages() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        loadingTitle.textContent = "Parsing document...";
        loadingSubtitle.textContent = "DocDrop is converting structure and assets to Markdown";
    }

    function setOcrProcessing(active) {
        ocrPills.querySelectorAll(".ocr-pill").forEach(p => {
            p.disabled = active;
            if (active && p.classList.contains("active") && p.dataset.engine !== "none") {
                p.classList.add("processing");
            } else {
                p.classList.remove("processing");
            }
        });
        ocrConvertBtn.disabled = active;
        if (active) {
            ocrConvertBtn.classList.add("loading");
        } else {
            ocrConvertBtn.classList.remove("loading");
            // Re-enable available engines
            loadAvailableEngines();
        }
    }

    ocrPills.addEventListener("click", (e) => {
        const pill = e.target.closest(".ocr-pill");
        if (!pill || pill.disabled) return;

        ocrPills.querySelectorAll(".ocr-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        selectedOcrEngine = pill.dataset.engine;

        if (selectedOcrEngine === "none") {
            ocrConvertRow.classList.add("hidden");
            return;
        }

        // Warn once per session for heavy models
        if (MODEL_DOWNLOAD_SIZES[selectedOcrEngine] && !warnedEngines.has(selectedOcrEngine)) {
            showToast(
                `First use will download ${MODEL_DOWNLOAD_SIZES[selectedOcrEngine]} of models — this may take a minute.`,
                "warning"
            );
            warnedEngines.add(selectedOcrEngine);
        }

        const label = selectedOcrEngine.charAt(0).toUpperCase() + selectedOcrEngine.slice(1);
        ocrConvertLabel.textContent = `Convert with ${label}`;
        ocrConvertRow.classList.remove("hidden");
    });

    ocrConvertBtn.addEventListener("click", () => {
        if (selectedFile && selectedOcrEngine !== "none") {
            triggerFileConversion();
        }
    });

    loadAvailableEngines();

    // ----------------------------------------------------------------------
    // Initialize Styles & Themes
    // ----------------------------------------------------------------------
    // Set initial theme based on local storage or system preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "light" || (!savedTheme && !prefersDark)) {
        document.body.classList.add("light-theme");
    }

    // Toggle theme action
    themeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        const activeTheme = document.body.classList.contains("light-theme") ? "light" : "dark";
        localStorage.setItem("theme", activeTheme);
        showToast(`Switched to ${activeTheme} theme`, "success");
    });

    // ----------------------------------------------------------------------
    // UI Layout Helpers & Interactions
    // ----------------------------------------------------------------------
    // Toggle Sidebar
    toggleSidebarBtn.addEventListener("click", () => {
        historySidebar.classList.add("active");
    });

    closeSidebarBtn.addEventListener("click", () => {
        historySidebar.classList.remove("active");
    });



    // ----------------------------------------------------------------------
    // Drag and Drop Logic
    // ----------------------------------------------------------------------
    // Dropzone Visual Hover listeners
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        }, false);
    });

    // File drop event
    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    // File browse triggers
    browseBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    // Process chosen file details
    function handleSelectedFile(file) {
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        fileSizeSpan.textContent = formatBytes(file.size);

        dropzone.querySelector(".dropzone-content").classList.add("hidden");
        filePreviewZone.style.display = "block";

        const ext = getFileExt(file.name);

        if (IMAGE_EXTS.has(ext)) {
            // Images can't be read by markitdown without an LLM — show OCR card up front
            showOcrSuggestion(
                "This is an image file. markitdown cannot extract text from images directly — select an OCR engine below to convert it."
            );
            // Don't auto-convert yet; wait for user to pick an engine
        } else {
            hideOcrCard();
            triggerFileConversion();
        }
    }

    // Reset chosen file selection
    removeFileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = "";

        filePreviewZone.style.display = "none";
        dropzone.querySelector(".dropzone-content").classList.remove("hidden");
        hideOcrCard();
    });

    // ----------------------------------------------------------------------
    // Markdown Parsing & Preview System
    // ----------------------------------------------------------------------
    // Visual tab switcher
    btnPreviewTab.addEventListener("click", () => {
        btnPreviewTab.classList.add("active");
        btnRawTab.classList.remove("active");
        previewContainer.classList.remove("hidden");
        rawContainer.classList.add("hidden");
    });

    btnRawTab.addEventListener("click", () => {
        btnRawTab.classList.add("active");
        btnPreviewTab.classList.remove("active");
        rawContainer.classList.remove("hidden");
        previewContainer.classList.add("hidden");
    });

    // Live Word Counter
    function updateWordCount(text) {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCountSpan.textContent = `${words} words`;
    }

    // ----------------------------------------------------------------------
    // API Integration & Server Requests
    // ----------------------------------------------------------------------
    
    // File Upload Conversion Action
    function triggerFileConversion() {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("ocr_engine", selectedOcrEngine);

        if (selectedOcrEngine !== "none") {
            setOcrProcessing(true);
            startProgressMessages(selectedOcrEngine);
        }

        performConversion(formData);
    }



    // Generic Fetch API Wrapper
    async function performConversion(formData) {
        loadingOverlay.classList.add("active");

        try {
            const response = await fetch("/api/convert", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || "Server conversion failed.");
            }

            // Populate Output Workspace
            currentMarkdown = data.markdown;
            currentFilename = data.filename;

            // Show OCR badge if OCR was used
            if (data.ocr_used && data.ocr_engine) {
                const label = data.ocr_engine.charAt(0).toUpperCase() + data.ocr_engine.slice(1);
                ocrBadgeLabel.textContent = `OCR: ${label}`;
                ocrBadge.classList.remove("hidden");
                lucide.createIcons();
            } else {
                ocrBadge.classList.add("hidden");
            }

            // If the result is nearly empty and this is a PDF, suggest OCR
            const isSparse = data.markdown.trim().length < 100;
            const isPdf = selectedFile && getFileExt(selectedFile.name) === "pdf";
            if (isSparse && isPdf && !data.ocr_used) {
                showOcrSuggestion(
                    "This PDF appears to be scanned or image-based — no readable text was found. Select an OCR engine below to extract the text."
                );
            } else if (data.ocr_used || !isSparse) {
                hideOcrCard();
            }

            displayMarkdownResults(currentMarkdown, currentFilename);
            
            // Log to local history list
            saveToHistory({
                name: currentFilename,
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now(),
                type: formData.has("url") ? "url" : "file",
                markdown: currentMarkdown
            });

            showToast("Document converted successfully!", "success");

        } catch (error) {
            console.error("Conversion error:", error);
            showToast(error.message, "error");
        } finally {
            loadingOverlay.classList.remove("active");
            stopProgressMessages();
            setOcrProcessing(false);
        }
    }

    // Render results in output panels
    function displayMarkdownResults(markdown, filename) {
        // Hide empty workspace placeholder
        emptyWorkspace.style.display = "none";
        
        // Show raw text
        rawEditor.value = markdown;
        updateWordCount(markdown);

        // Parse & Render beautiful visual HTML preview
        visualPreview.innerHTML = marked.parse(markdown);
        
        // Make sure all links open in a new tab
        visualPreview.querySelectorAll("a").forEach(a => {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
        });

        // Jump to preview tab initially
        btnPreviewTab.click();
    }

    // ----------------------------------------------------------------------
    // History Persistence Engine
    // ----------------------------------------------------------------------
    function saveToHistory(item) {
        // Prevent duplicate logs based on matching name & text content
        conversionHistory = conversionHistory.filter(h => !(h.name === item.name && h.markdown === item.markdown));
        
        // Keep history list within clean size bounds (e.g. 10 items max)
        conversionHistory.unshift(item);
        if (conversionHistory.length > 10) {
            conversionHistory.pop();
        }
        
        localStorage.setItem("mid_history", JSON.stringify(conversionHistory));
        renderHistoryList();
    }

    function renderHistoryList() {
        historyList.innerHTML = "";
        
        if (conversionHistory.length === 0) {
            historyList.innerHTML = `
                <li class="empty-history">
                    <i data-lucide="clock"></i>
                    <p>No recent conversions</p>
                </li>
            `;
            lucide.createIcons();
            return;
        }

        conversionHistory.forEach((item) => {
            const li = document.createElement("li");
            li.className = "history-item";
            
            const isUrl = item.type === "url";
            const iconName = isUrl ? "globe" : "file-text";
            
            li.innerHTML = `
                <i data-lucide="${iconName}" class="history-item-icon"></i>
                <div class="history-item-details">
                    <span class="history-item-name">${item.name}</span>
                    <span class="history-item-meta">${item.date}</span>
                </div>
            `;
            
            // Clicking restore item state
            li.addEventListener("click", () => {
                currentMarkdown = item.markdown;
                currentFilename = item.name;
                displayMarkdownResults(currentMarkdown, currentFilename);
                showToast(`Restored: ${item.name}`, "success");
                
                // On mobile, close sidebar drawer when item selected
                if (window.innerWidth <= 768) {
                    historySidebar.classList.remove("active");
                }
            });

            historyList.appendChild(li);
        });

        lucide.createIcons();
    }

    // Clear local storage history
    clearHistoryBtn.addEventListener("click", () => {
        conversionHistory = [];
        localStorage.removeItem("mid_history");
        renderHistoryList();
        showToast("History cleared", "warning");
    });

    // ----------------------------------------------------------------------
    // Utility Actions: Copy & Download
    // ----------------------------------------------------------------------
    // Copy markdown code to clipboard
    copyBtn.addEventListener("click", () => {
        if (!currentMarkdown) {
            showToast("No markdown content to copy.", "warning");
            return;
        }

        navigator.clipboard.writeText(currentMarkdown).then(() => {
            showToast("Copied to clipboard!", "success");
            
            // Add a brief spring scale visual to button
            copyBtn.style.transform = "scale(0.85)";
            setTimeout(() => {
                copyBtn.style.transform = "scale(1)";
            }, 150);

        }).catch(err => {
            console.error("Clipboard error:", err);
            showToast("Failed to copy text.", "error");
        });
    });

    // Download Markdown file (.md)
    downloadBtn.addEventListener("click", () => {
        if (!currentMarkdown) {
            showToast("No markdown content to download.", "warning");
            return;
        }

        const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        
        // Clean filename, make sure it has .md extension
        let baseName = currentFilename || "document";
        const dotIndex = baseName.lastIndexOf(".");
        if (dotIndex > 0) {
            baseName = baseName.substring(0, dotIndex);
        }
        a.download = `${baseName}.md`;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);

        showToast("Markdown file downloaded!", "success");
    });

    // ----------------------------------------------------------------------
    // UI Format Helpers
    // ----------------------------------------------------------------------
    // Helper to format bytes cleanly
    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    // Floating notifications toast builder
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconName = "check-circle";
        if (type === "error") iconName = "alert-triangle";
        if (type === "warning") iconName = "info";

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon"></i>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        lucide.createIcons();

        // Slide out and remove toast after 3.5s
        setTimeout(() => {
            toast.style.transform = "translateY(20px)";
            toast.style.opacity = "0";
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }, 3500);
    }

    // ----------------------------------------------------------------------
    // Initial Render Actions
    // ----------------------------------------------------------------------
    renderHistoryList();
});
