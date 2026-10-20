/* Nova AI - designed and developed by Rahul Dharuman */

(() => {
    "use strict";

    // ---------- Elements ----------
    const $ = (id) => document.getElementById(id);
    const app = $("app");
    const input = $("input");
    const sendBtn = $("send");
    const welcome = $("welcome");
    const chatEl = $("chat");
    const thread = $("thread");
    const historyEl = $("history");
    const searchInput = $("searchInput");
    const modelSelect = $("modelSelect");
    const menu = $("menu");
    const menuBtn = $("menuBtn");
    const greeting = $("greeting");

    // ---------- State ----------
    const CHATS_KEY = "nova.chats.v1";
    const ACTIVE_KEY = "nova.active";
    const MODEL_KEY = "nova.model";
    const MAX_CONTEXT = 30;

    let chats = loadChats();
    let activeId = null;
    let generating = false;
    let controller = null;

    const AI_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" fill="currentColor"/></svg>';
    const EDIT_ICON =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
    const DEL_ICON =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

    // ---------- Storage ----------
    function loadChats() {
        try {
            const data = JSON.parse(localStorage.getItem(CHATS_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function saveChats() {
        try {
            localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        } catch (e) {
            console.warn("Could not save chats:", e);
        }
    }

    const getChat = (id) => chats.find((c) => c.id === id) || null;
    const activeChat = () => getChat(activeId);

    // ---------- Theme ----------
    $("themeToggle").addEventListener("click", () => {
        const root = document.documentElement;
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("nova.theme", next); } catch (e) {}
    });

    // ---------- Greeting ----------
    function setGreeting() {
        const h = new Date().getHours();
        const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
        greeting.textContent = `${part}, I'm Nova.`;
    }

    // ---------- Models ----------
    async function loadModels() {
        try {
            const res = await fetch("/api/models");
            const data = await res.json();
            const names = data.models && data.models.length ? data.models : [data.default];
            const saved = localStorage.getItem(MODEL_KEY);
            modelSelect.innerHTML = "";
            names.forEach((n) => {
                const opt = document.createElement("option");
                opt.value = n;
                opt.textContent = n;
                modelSelect.appendChild(opt);
            });
            modelSelect.value = names.includes(saved) ? saved : data.default;
        } catch (e) {
            console.warn("Could not load models:", e);
        }
    }

    modelSelect.addEventListener("change", () => {
        try { localStorage.setItem(MODEL_KEY, modelSelect.value); } catch (e) {}
    });

    // ---------- Markdown (safe, small renderer) ----------
    function escapeHtml(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function inline(s) {
        return s
            .replace(/`([^`\n]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*])\*([^*\s][^*\n]*)\*/g, "$1<em>$2</em>")
            .replace(
                /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
            );
    }

    function renderMarkdown(src) {
        const blocks = [];
        let text = src.replace(/```([\w+-]*)\n?([\s\S]*?)(```|$)/g, (m, lang, code) => {
            blocks.push({ lang, code: code.replace(/\n$/, "") });
            return `\u0000${blocks.length - 1}\u0000`;
        });

        text = escapeHtml(text);

        const lines = text.split("\n");
        let html = "";
        let para = [];
        let list = null; // "ul" | "ol"

        const flushPara = () => {
            if (para.length) {
                html += `<p>${inline(para.join("<br>"))}</p>`;
                para = [];
            }
        };
        const flushList = () => {
            if (list) {
                html += `</${list}>`;
                list = null;
            }
        };

        for (const line of lines) {
            const ph = line.match(/^\u0000(\d+)\u0000$/);
            if (ph) {
                flushPara();
                flushList();
                const b = blocks[Number(ph[1])];
                html +=
                    `<div class="code"><div class="code-head"><span>${escapeHtml(b.lang || "code")}</span>` +
                    `<button type="button" class="copy-code">Copy</button></div>` +
                    `<pre><code>${escapeHtml(b.code)}</code></pre></div>`;
                continue;
            }

            const h = line.match(/^(#{1,4})\s+(.*)$/);
            const ul = line.match(/^\s*[-*]\s+(.*)$/);
            const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);

            if (h) {
                flushPara();
                flushList();
                const n = h[1].length;
                html += `<h${n}>${inline(h[2])}</h${n}>`;
            } else if (ul || ol) {
                flushPara();
                const type = ul ? "ul" : "ol";
                if (list !== type) {
                    flushList();
                    html += `<${type}>`;
                    list = type;
                }
                html += `<li>${inline((ul || ol)[1])}</li>`;
            } else if (!line.trim()) {
                flushPara();
                flushList();
            } else {
                flushList();
                para.push(line);
            }
        }
        flushPara();
        flushList();
        return html;
    }

    // ---------- Rendering ----------
    function buildAiMessage(content, { showRegenerate = false, isError = false } = {}) {
        const msg = document.createElement("div");
        msg.className = "msg ai" + (isError ? " error" : "");

        const av = document.createElement("div");
        av.className = "av";
        av.innerHTML = AI_ICON;

        const wrap = document.createElement("div");
        wrap.className = "content";

        const body = document.createElement("div");
        body.className = "body";
        if (content) body.innerHTML = renderMarkdown(content);

        wrap.appendChild(body);
        msg.append(av, wrap);
        return { msg, body, wrap };
    }

    function addActions(wrap, text, { showRegenerate }) {
        const actions = document.createElement("div");
        actions.className = "actions";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.textContent = "Copy";
        copy.addEventListener("click", async () => {
            await copyText(text);
            copy.textContent = "Copied";
            setTimeout(() => (copy.textContent = "Copy"), 1500);
        });
        actions.appendChild(copy);

        if (showRegenerate) {
            const regen = document.createElement("button");
            regen.type = "button";
            regen.textContent = "Regenerate";
            regen.addEventListener("click", regenerate);
            actions.appendChild(regen);
        }
        wrap.appendChild(actions);
    }

    function buildUserMessage(text) {
        const msg = document.createElement("div");
        msg.className = "msg user";
        const body = document.createElement("div");
        body.className = "body";
        body.textContent = text;
        msg.appendChild(body);
        return msg;
    }

    function renderThread() {
        const chat = activeChat();
        thread.innerHTML = "";

        if (!chat || !chat.messages.length) {
            welcome.hidden = false;
            chatEl.hidden = true;
            return;
        }

        welcome.hidden = true;
        chatEl.hidden = false;

        const lastIndex = chat.messages.length - 1;
        chat.messages.forEach((m, i) => {
            if (m.role === "user") {
                thread.appendChild(buildUserMessage(m.content));
            } else {
                const { msg, wrap } = buildAiMessage(m.content);
                addActions(wrap, m.content, { showRegenerate: i === lastIndex });
                thread.appendChild(msg);
            }
        });
        scrollToBottom(true);
    }

    function scrollToBottom(force = false) {
        const nearBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 140;
        if (force || nearBottom) {
            requestAnimationFrame(() => (chatEl.scrollTop = chatEl.scrollHeight));
        }
    }

    // ---------- History sidebar ----------
    function groupLabel(ts) {
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const day = 86400000;
        if (ts >= startOfToday) return "Today";
        if (ts >= startOfToday - day) return "Yesterday";
        if (ts >= startOfToday - 7 * day) return "Previous 7 days";
        return "Older";
    }

    function renderHistory() {
        const q = searchInput.value.trim().toLowerCase();
        const list = chats
            .filter((c) => !q || c.title.toLowerCase().includes(q))
            .sort((a, b) => b.updated - a.updated);

        historyEl.innerHTML = "";

        if (!list.length) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = q ? "No chats match your search." : "Your conversations will appear here.";
            historyEl.appendChild(li);
            return;
        }

        let lastGroup = "";
        list.forEach((c) => {
            const g = groupLabel(c.updated);
            if (g !== lastGroup) {
                const h = document.createElement("li");
                h.className = "group";
                h.textContent = g;
                historyEl.appendChild(h);
                lastGroup = g;
            }

            const li = document.createElement("li");
            li.className = "item" + (c.id === activeId ? " active" : "");
            li.dataset.id = c.id;
            li.tabIndex = 0;

            const title = document.createElement("span");
            title.className = "title";
            title.textContent = c.title;
            title.title = c.title;

            const actions = document.createElement("span");
            actions.className = "row-actions";
            actions.innerHTML =
                `<button type="button" class="ren" aria-label="Rename chat">${EDIT_ICON}</button>` +
                `<button type="button" class="del" aria-label="Delete chat">${DEL_ICON}</button>`;

            li.append(title, actions);
            historyEl.appendChild(li);
        });
    }

    historyEl.addEventListener("click", (e) => {
        const item = e.target.closest(".item");
        if (!item) return;
        const id = item.dataset.id;
        if (e.target.closest(".ren")) return renameChat(id);
        if (e.target.closest(".del")) return deleteChat(id);
        openChat(id);
    });

    historyEl.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("item")) {
            e.preventDefault();
            openChat(e.target.dataset.id);
        }
    });

    searchInput.addEventListener("input", renderHistory);

    // ---------- Chat management ----------
    function stopGenerating() {
        if (controller) controller.abort();
    }

    function openChat(id) {
        if (!getChat(id)) return;
        if (generating) stopGenerating();
        activeId = id;
        try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
        renderThread();
        renderHistory();
        closeMobileSidebar();
        input.focus();
    }

    function newChat() {
        if (generating) stopGenerating();
        activeId = null;
        try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
        input.value = "";
        resizeInput();
        updateSendState();
        renderThread();
        renderHistory();
        closeMobileSidebar();
        input.focus();
    }

    function createChat(firstMessage) {
        const now = Date.now();
        const title = firstMessage.replace(/\s+/g, " ").slice(0, 48) + (firstMessage.length > 48 ? "…" : "");
        const chat = { id: "c" + now.toString(36) + Math.random().toString(36).slice(2, 6), title, created: now, updated: now, messages: [] };
        chats.push(chat);
        activeId = chat.id;
        try { localStorage.setItem(ACTIVE_KEY, chat.id); } catch (e) {}
        return chat;
    }

    function renameChat(id) {
        const chat = getChat(id);
        if (!chat) return;
        const name = prompt("Rename chat", chat.title);
        if (name && name.trim()) {
            chat.title = name.trim().slice(0, 80);
            saveChats();
            renderHistory();
        }
    }

    function deleteChat(id) {
        const chat = getChat(id);
        if (!chat) return;
        if (!confirm(`Delete "${chat.title}"?`)) return;
        if (id === activeId && generating) stopGenerating();
        chats = chats.filter((c) => c.id !== id);
        saveChats();
        if (id === activeId) {
            activeId = null;
            try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
            renderThread();
        }
        renderHistory();
    }

    function clearAll() {
        if (!chats.length) return;
        if (!confirm("Delete all chat history? This cannot be undone.")) return;
        if (generating) stopGenerating();
        chats = [];
        saveChats();
        newChat();
    }

    function exportChat() {
        const chat = activeChat();
        if (!chat || !chat.messages.length) {
            alert("Open a chat with messages to export it.");
            return;
        }
        const md =
            `# ${chat.title}\n\n` +
            chat.messages.map((m) => `**${m.role === "user" ? "You" : "Nova"}:**\n\n${m.content}`).join("\n\n---\n\n") +
            "\n\n---\n*Exported from Nova AI - designed and developed by Rahul Dharuman*\n";
        const blob = new Blob([md], { type: "text/markdown" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = chat.title.replace(/[^\w-]+/g, "_").slice(0, 40) + ".md";
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // ---------- Sending & streaming ----------
    async function sendMessage(text) {
        const message = (text ?? input.value).trim();
        if (!message || generating) return;

        const chat = activeChat() || createChat(message);
        chat.messages.push({ role: "user", content: message });
        chat.updated = Date.now();
        saveChats();

        input.value = "";
        resizeInput();
        renderHistory();
        await streamReply(chat);
    }

    async function regenerate() {
        const chat = activeChat();
        if (!chat || generating) return;
        if (chat.messages.length && chat.messages[chat.messages.length - 1].role === "assistant") {
            chat.messages.pop();
            saveChats();
        }
        await streamReply(chat);
    }

    async function streamReply(chat) {
        generating = true;
        controller = new AbortController();
        updateSendState();
        renderThread();

        const { msg, body, wrap } = buildAiMessage("");
        body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
        thread.appendChild(msg);
        scrollToBottom(true);

        let full = "";
        let error = null;

        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    model: modelSelect.value,
                    messages: chat.messages.slice(-MAX_CONTEXT),
                }),
            });

            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Server error");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let nl;
                while ((nl = buffer.indexOf("\n")) >= 0) {
                    const line = buffer.slice(0, nl).trim();
                    buffer = buffer.slice(nl + 1);
                    if (!line) continue;

                    const evt = JSON.parse(line);
                    if (evt.error) throw new Error(evt.error);
                    if (evt.token) {
                        full += evt.token;
                        body.innerHTML = renderMarkdown(full);
                        scrollToBottom();
                    }
                }
            }
        } catch (e) {
            if (e.name !== "AbortError") {
                error = e.message || "Something went wrong.";
                console.error("Chat error:", e);
            }
        } finally {
            generating = false;
            controller = null;

            if (full) {
                chat.messages.push({ role: "assistant", content: full });
                chat.updated = Date.now();
                saveChats();
            }

            updateSendState();
            renderHistory();

            if (activeId === chat.id) {
                renderThread();
                if (error) showError(error);
            }
        }
    }

    function showError(text) {
        const { msg, body, wrap } = buildAiMessage("", { isError: true });
        body.textContent =
            text.toLowerCase().includes("connect") || text.toLowerCase().includes("refused")
                ? "Couldn't reach Ollama. Make sure it is running, then try again."
                : `Something went wrong: ${text}`;

        const actions = document.createElement("div");
        actions.className = "actions";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Try again";
        retry.addEventListener("click", () => {
            msg.remove();
            streamReply(activeChat());
        });
        actions.appendChild(retry);
        wrap.appendChild(actions);

        thread.appendChild(msg);
        scrollToBottom(true);
    }

    // ---------- Input ----------
    function resizeInput() {
        input.style.height = "40px";
        input.style.height = Math.min(input.scrollHeight, 160) + "px";
    }

    function updateSendState() {
        sendBtn.classList.toggle("stop", generating);
        sendBtn.disabled = generating ? false : input.value.trim().length === 0;
        sendBtn.setAttribute("aria-label", generating ? "Stop generating" : "Send message");
    }

    input.addEventListener("input", () => {
        resizeInput();
        updateSendState();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!generating) sendMessage();
        }
    });

    sendBtn.addEventListener("click", () => {
        if (generating) stopGenerating();
        else sendMessage();
    });

    document.querySelectorAll(".suggestions button").forEach((btn) => {
        btn.addEventListener("click", () => sendMessage(btn.dataset.prompt));
    });

    // ---------- Copy helpers ----------
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
    }

    thread.addEventListener("click", async (e) => {
        const btn = e.target.closest(".copy-code");
        if (!btn) return;
        const code = btn.closest(".code").querySelector("code").textContent;
        await copyText(code);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
    });

    // ---------- Sidebar & menu ----------
    const mobile = () => window.matchMedia("(max-width: 820px)").matches;

    function closeMobileSidebar() {
        app.classList.remove("open");
    }

    $("toggleSidebar").addEventListener("click", () => {
        if (mobile()) app.classList.toggle("open");
        else app.classList.toggle("collapsed");
    });
    $("closeSidebar").addEventListener("click", closeMobileSidebar);
    $("scrim").addEventListener("click", closeMobileSidebar);

    $("newChat").addEventListener("click", newChat);
    $("sideNew").addEventListener("click", newChat);

    function setMenu(open) {
        menu.hidden = !open;
        menuBtn.setAttribute("aria-expanded", String(open));
    }

    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setMenu(menu.hidden);
    });
    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            setMenu(false);
            closeMobileSidebar();
        }
    });

    $("exportChat").addEventListener("click", () => { setMenu(false); exportChat(); });
    $("deleteChat").addEventListener("click", () => { setMenu(false); if (activeId) deleteChat(activeId); });
    $("clearAll").addEventListener("click", () => { setMenu(false); clearAll(); });

    // ---------- Init ----------
    setGreeting();
    loadModels();
    renderHistory();

    const savedActive = localStorage.getItem(ACTIVE_KEY);
    if (savedActive && getChat(savedActive)) {
        activeId = savedActive;
    }
    renderThread();
    updateSendState();
})();
