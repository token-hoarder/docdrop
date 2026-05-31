/* ==========================================================================
   DOCDROP - CLIENT INTERACTIVE SYSTEM
   ========================================================================== */

// Supabase client — publishable key is safe to expose in frontend
const _supabase = supabase.createClient(
    "https://fiorxuddpviuwouyzbdm.supabase.co",
    "sb_publishable_tylHmfeOFiuiCkfqf-UUOQ_lIhQo97g"
);

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // State
    // ----------------------------------------------------------------------
    const state = {
        selectedFile: null,
        selectedOcrEngine: "none",
        ocrSuggestion: null,   // null = OCR card hidden; string = notice message
        currentMarkdown: "",
        currentFilename: "",
        conversionHistory: JSON.parse(localStorage.getItem("mid_history") || "[]"),
        user: null,
        preflightData: null,
    };

    function setState(patch) {
        Object.assign(state, patch);
        renderFileZone();
        renderOcrCard();
    }

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

    // Credits modal
    const creditsModalBackdrop = document.getElementById("creditsModalBackdrop");
    const closeCreditsModal = document.getElementById("closeCreditsModal");

    function openCreditsModal() {
        creditsModalBackdrop.classList.remove("hidden");
        lucide.createIcons();
    }

    function closeCreditsModalFn() {
        creditsModalBackdrop.classList.add("hidden");
    }

    closeCreditsModal.addEventListener("click", closeCreditsModalFn);
    creditsModalBackdrop.addEventListener("click", (e) => {
        if (e.target === creditsModalBackdrop) closeCreditsModalFn();
    });

    creditsModalBackdrop.querySelectorAll(".credits-plan").forEach(plan => {
        plan.querySelector(".plan-buy-btn").addEventListener("click", async () => {
            if (!state.user) { openAuthModal(); return; }
            const product = plan.dataset.product;
            try {
                const res = await fetchWithAuth("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ product }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
            } catch (err) {
                showToast("Could not start checkout. Please try again.", "error");
            }
        });
    });

    // Auth
    const signInBtn = document.getElementById("signInBtn");
    const signOutBtn = document.getElementById("signOutBtn");
    const userMenu = document.getElementById("userMenu");
    const userEmail = document.getElementById("userEmail");
    const creditBadge = document.getElementById("creditBadge");
    const creditCount = document.getElementById("creditCount");
    const authModalBackdrop = document.getElementById("authModalBackdrop");
    const closeAuthModal = document.getElementById("closeAuthModal");
    const authForm = document.getElementById("authForm");
    const authEmail = document.getElementById("authEmail");
    const authPassword = document.getElementById("authPassword");
    const authError = document.getElementById("authError");
    const authSubmitLabel = document.getElementById("authSubmitLabel");
    const authTabs = document.querySelectorAll(".auth-tab");

    // ----------------------------------------------------------------------
    // Initialize Libraries
    // ----------------------------------------------------------------------
    lucide.createIcons();

    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true,
        mangle: false
    });

    // ----------------------------------------------------------------------
    // Auth
    // ----------------------------------------------------------------------
    let activeAuthTab = "signin";

    async function refreshCredits() {
        try {
            const res = await fetchWithAuth("/api/credits");
            if (res.ok) {
                const data = await res.json();
                creditCount.textContent = data.balance;
                creditBadge.classList.toggle("low-credits", data.balance <= 5);
            }
        } catch (_) {}
    }

    function renderAuthState(user) {
        state.user = user;
        if (user) {
            signInBtn.classList.add("hidden");
            userMenu.classList.remove("hidden");
            userEmail.textContent = user.email;
            refreshCredits();
        } else {
            signInBtn.classList.remove("hidden");
            userMenu.classList.add("hidden");
            creditCount.textContent = "—";
        }
    }

    function openAuthModal() {
        authModalBackdrop.classList.remove("hidden");
        authEmail.focus();
        lucide.createIcons();
    }

    function closeModal() {
        authModalBackdrop.classList.add("hidden");
        authForm.reset();
        authError.classList.add("hidden");
    }

    authTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            authTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeAuthTab = tab.dataset.tab;
            authSubmitLabel.textContent = activeAuthTab === "signin" ? "Sign In" : "Create Account";
            authError.classList.add("hidden");
        });
    });

    signInBtn.addEventListener("click", openAuthModal);
    closeAuthModal.addEventListener("click", closeModal);
    authModalBackdrop.addEventListener("click", (e) => {
        if (e.target === authModalBackdrop) closeModal();
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.classList.add("hidden");
        const email = authEmail.value.trim();
        const password = authPassword.value;

        try {
            let result;
            if (activeAuthTab === "signin") {
                result = await _supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await _supabase.auth.signUp({ email, password });
            }

            if (result.error) throw result.error;

            closeModal();
            const msg = activeAuthTab === "signup"
                ? "Account created! Check your email to confirm."
                : "Signed in successfully!";
            showToast(msg, "success");
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove("hidden");
        }
    });

    signOutBtn.addEventListener("click", async () => {
        await _supabase.auth.signOut();
        showToast("Signed out", "success");
    });

    creditBadge.addEventListener("click", () => {
        if (state.user) openCreditsModal();
    });

    // Listen for auth state changes (login, logout, token refresh)
    let _authDebounce = null;
    _supabase.auth.onAuthStateChange((_event, session) => {
        clearTimeout(_authDebounce);
        _authDebounce = setTimeout(() => renderAuthState(session?.user ?? null), 100);
    });

    // Restore session on page load
    _supabase.auth.getSession().then(({ data: { session } }) => {
        renderAuthState(session?.user ?? null);
    });

    async function getAuthHeaders() {
        // refreshSession silently renews an expired token if a refresh token exists
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) return {};
        return { Authorization: `Bearer ${session.access_token}` };
    }

    async function fetchWithAuth(url, options = {}) {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
        if (res.status === 401) {
            // Token may have expired mid-session — sign out cleanly
            await _supabase.auth.signOut();
            showToast("Your session expired. Please sign in again.", "warning");
            throw new Error("Session expired");
        }
        return res;
    }

    // ----------------------------------------------------------------------
    // Render Functions
    // ----------------------------------------------------------------------
    function renderFileZone() {
        const hasFile = !!state.selectedFile;
        dropzone.querySelector(".dropzone-content").classList.toggle("hidden", hasFile);
        filePreviewZone.style.display = hasFile ? "block" : "none";
        if (hasFile) {
            fileNameSpan.textContent = state.selectedFile.name;
            fileSizeSpan.textContent = formatBytes(state.selectedFile.size);
        }
    }

    function renderOcrCard() {
        const hasCard = state.ocrSuggestion !== null;
        ocrCard.classList.toggle("hidden", !hasCard);
        if (hasCard) {
            ocrNoticeText.textContent = state.ocrSuggestion;
            ocrNotice.style.display = "flex";
            lucide.createIcons();
        }

        ocrPills.querySelectorAll(".ocr-pill").forEach(p => {
            p.classList.toggle("active", p.dataset.engine === state.selectedOcrEngine);
        });

        const hasEngine = state.selectedOcrEngine !== "none";
        ocrConvertRow.classList.toggle("hidden", !hasEngine);
        if (hasEngine) {
            const label = state.selectedOcrEngine.charAt(0).toUpperCase() + state.selectedOcrEngine.slice(1);
            ocrConvertLabel.textContent = `Convert with ${label}`;
        }
    }

    // ----------------------------------------------------------------------
    // OCR Engine Selector
    // ----------------------------------------------------------------------
    let IMAGE_EXTS = new Set();

    function getFileExt(filename) {
        return filename.split(".").pop().toLowerCase();
    }

    async function loadFormats() {
        try {
            const res = await fetch("/api/formats");
            const data = await res.json();
            IMAGE_EXTS = new Set(data.image_extensions || []);
        } catch (_) {
            // server not ready yet — IMAGE_EXTS stays empty
        }
    }

    async function loadAvailableEngines() {
        try {
            const res = await fetchWithAuth("/api/ocr-engines");
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
            loadAvailableEngines();
        }
    }

    async function runPreflight(engine) {
        if (!state.selectedFile || engine === "none") return;

        const ext = getFileExt(state.selectedFile.name);
        const isOcrTarget = IMAGE_EXTS.has(ext) || ext === "pdf";
        if (!isOcrTarget) return;

        try {
            const formData = new FormData();
            formData.append("file", state.selectedFile);
            const res = await fetchWithAuth("/api/preflight", { method: "POST", body: formData });
            if (!res.ok) return;
            const data = await res.json();

            if (data.pages === 0) return;

            let msg;
            if (!state.user) {
                msg = `Sign in to use OCR — this file is ${data.pages} page(s).`;
            } else if (!data.can_convert) {
                msg = `This file is ${data.pages} page(s) and costs ${data.credits_required} credit(s). You have ${data.credits_available} — top up to convert.`;
            } else {
                msg = `This file is ${data.pages} page(s) and will use ${data.credits_required} of your ${data.credits_available} credit(s).`;
            }

            setState({ ocrSuggestion: msg, preflightData: data });
        } catch (_) {
            // preflight failure is non-fatal — user can still try to convert
        }
    }

    ocrPills.addEventListener("click", (e) => {
        const pill = e.target.closest(".ocr-pill");
        if (!pill || pill.disabled) return;

        const engine = pill.dataset.engine;

        if (MODEL_DOWNLOAD_SIZES[engine] && !warnedEngines.has(engine)) {
            showToast(
                `First use will download ${MODEL_DOWNLOAD_SIZES[engine]} of models — this may take a minute.`,
                "warning"
            );
            warnedEngines.add(engine);
        }

        setState({ selectedOcrEngine: engine });
        runPreflight(engine);
    });

    ocrConvertBtn.addEventListener("click", () => {
        if (state.selectedFile && state.selectedOcrEngine !== "none") {
            triggerFileConversion();
        }
    });

    loadFormats();
    loadAvailableEngines();

    // ----------------------------------------------------------------------
    // Initialize Styles & Themes
    // ----------------------------------------------------------------------
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "light" || (!savedTheme && !prefersDark)) {
        document.body.classList.add("light-theme");
    }

    themeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        const activeTheme = document.body.classList.contains("light-theme") ? "light" : "dark";
        localStorage.setItem("theme", activeTheme);
        showToast(`Switched to ${activeTheme} theme`, "success");
    });

    // ----------------------------------------------------------------------
    // UI Layout Helpers & Interactions
    // ----------------------------------------------------------------------
    toggleSidebarBtn.addEventListener("click", () => {
        historySidebar.classList.add("active");
    });

    closeSidebarBtn.addEventListener("click", () => {
        historySidebar.classList.remove("active");
    });

    // ----------------------------------------------------------------------
    // Drag and Drop Logic
    // ----------------------------------------------------------------------
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

    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    browseBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    const MAX_FILE_MB = 50;

    function handleSelectedFile(file) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            showToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_MB} MB.`, "error");
            return;
        }

        const ext = getFileExt(file.name);
        if (IMAGE_EXTS.has(ext)) {
            setState({
                selectedFile: file,
                ocrSuggestion: "This is an image file. markitdown cannot extract text from images directly — select an OCR engine below to convert it.",
            });
        } else {
            setState({ selectedFile: file, ocrSuggestion: null });
            triggerFileConversion();
        }
    }

    removeFileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = "";
        setState({ selectedFile: null, ocrSuggestion: null, selectedOcrEngine: "none", preflightData: null });
    });

    // ----------------------------------------------------------------------
    // Markdown Parsing & Preview System
    // ----------------------------------------------------------------------
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

    function updateWordCount(text) {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCountSpan.textContent = `${words} words`;
    }

    // ----------------------------------------------------------------------
    // API Integration & Server Requests
    // ----------------------------------------------------------------------
    function triggerFileConversion() {
        if (!state.selectedFile) return;

        const formData = new FormData();
        formData.append("file", state.selectedFile);
        formData.append("ocr_engine", state.selectedOcrEngine);

        if (state.selectedOcrEngine !== "none") {
            setOcrProcessing(true);
            startProgressMessages(state.selectedOcrEngine);
        }

        performConversion(formData);
    }

    async function performConversion(formData) {
        loadingOverlay.classList.add("active");

        try {
            const response = await fetchWithAuth("/api/convert", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (response.status === 402) {
                setState({
                    ocrSuggestion: `Not enough credits — need ${data.credits_required}, you have ${data.credits_available}.`,
                    preflightData: data,
                });
                openCreditsModal();
                return;
            }

            if (!response.ok) {
                throw new Error(data.detail || "Server conversion failed.");
            }

            if (data.ocr_used && data.ocr_engine) {
                const label = data.ocr_engine.charAt(0).toUpperCase() + data.ocr_engine.slice(1);
                ocrBadgeLabel.textContent = `OCR: ${label}`;
                ocrBadge.classList.remove("hidden");
                lucide.createIcons();
            } else {
                ocrBadge.classList.add("hidden");
            }

            const isSparse = data.markdown.trim().length < 100;
            const isPdf = state.selectedFile && getFileExt(state.selectedFile.name) === "pdf";
            const newSuggestion = (isSparse && isPdf && !data.ocr_used)
                ? "This PDF appears to be scanned or image-based — no readable text was found. Select an OCR engine below to extract the text."
                : null;

            setState({
                currentMarkdown: data.markdown,
                currentFilename: data.filename,
                ocrSuggestion: newSuggestion,
            });

            displayMarkdownResults(state.currentMarkdown, state.currentFilename);

            saveToHistory({
                name: state.currentFilename,
                date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                timestamp: Date.now(),
                type: formData.has("url") ? "url" : "file",
                markdown: state.currentMarkdown,
            });

            showToast("Document converted successfully!", "success");
            if (state.user) refreshCredits();

        } catch (error) {
            console.error("Conversion error:", error);
            if (!navigator.onLine) {
                showToast("No internet connection. Please check your network and try again.", "error");
            } else if (error.name === "TypeError" && error.message.includes("fetch")) {
                showToast("Could not reach the server. Is DocDrop running?", "error");
            } else {
                showToast(error.message || "Conversion failed. Please try again.", "error");
            }
        } finally {
            loadingOverlay.classList.remove("active");
            stopProgressMessages();
            setOcrProcessing(false);
        }
    }

    function displayMarkdownResults(markdown, filename) {
        emptyWorkspace.style.display = "none";

        rawEditor.value = markdown;
        updateWordCount(markdown);

        visualPreview.innerHTML = marked.parse(markdown);

        visualPreview.querySelectorAll("a").forEach(a => {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
        });

        btnPreviewTab.click();
    }

    // ----------------------------------------------------------------------
    // History Persistence Engine
    // ----------------------------------------------------------------------
    function saveToHistory(item) {
        let history = state.conversionHistory.filter(h => !(h.name === item.name && h.markdown === item.markdown));
        history.unshift(item);
        if (history.length > 10) history.pop();
        localStorage.setItem("mid_history", JSON.stringify(history));
        state.conversionHistory = history;
        renderHistoryList();
    }

    function renderHistoryList() {
        historyList.innerHTML = "";

        if (state.conversionHistory.length === 0) {
            historyList.innerHTML = `
                <li class="empty-history">
                    <i data-lucide="clock"></i>
                    <p>No recent conversions</p>
                </li>
            `;
            lucide.createIcons();
            return;
        }

        state.conversionHistory.forEach((item) => {
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

            li.addEventListener("click", () => {
                setState({
                    currentMarkdown: item.markdown,
                    currentFilename: item.name,
                });
                displayMarkdownResults(state.currentMarkdown, state.currentFilename);
                showToast(`Restored: ${item.name}`, "success");

                if (window.innerWidth <= 768) {
                    historySidebar.classList.remove("active");
                }
            });

            historyList.appendChild(li);
        });

        lucide.createIcons();
    }

    clearHistoryBtn.addEventListener("click", () => {
        state.conversionHistory = [];
        localStorage.removeItem("mid_history");
        renderHistoryList();
        showToast("History cleared", "warning");
    });

    // ----------------------------------------------------------------------
    // Utility Actions: Copy & Download
    // ----------------------------------------------------------------------
    copyBtn.addEventListener("click", () => {
        if (!state.currentMarkdown) {
            showToast("No markdown content to copy.", "warning");
            return;
        }

        navigator.clipboard.writeText(state.currentMarkdown).then(() => {
            showToast("Copied to clipboard!", "success");

            copyBtn.style.transform = "scale(0.85)";
            setTimeout(() => {
                copyBtn.style.transform = "scale(1)";
            }, 150);

        }).catch(err => {
            console.error("Clipboard error:", err);
            showToast("Failed to copy text.", "error");
        });
    });

    downloadBtn.addEventListener("click", () => {
        if (!state.currentMarkdown) {
            showToast("No markdown content to download.", "warning");
            return;
        }

        const blob = new Blob([state.currentMarkdown], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        let baseName = state.currentFilename || "document";
        const dotIndex = baseName.lastIndexOf(".");
        if (dotIndex > 0) {
            baseName = baseName.substring(0, dotIndex);
        }
        a.download = `${baseName}.md`;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);

        showToast("Markdown file downloaded!", "success");
    });

    // ----------------------------------------------------------------------
    // UI Format Helpers
    // ----------------------------------------------------------------------
    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

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

    // Handle post-payment redirect
    if (window.location.hash === "#success") {
        showToast("Payment successful! Your credits have been added.", "success");
        history.replaceState(null, "", "/");
        setTimeout(() => { if (state.user) refreshCredits(); }, 2000);
    }

    // ----------------------------------------------------------------------
    // Initial Render
    // ----------------------------------------------------------------------
    renderHistoryList();
});
