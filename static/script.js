(() => {
    "use strict";

    const input = document.getElementById("user-input");
    const form = document.getElementById("chat-form");
    const sendButton = document.getElementById("send-btn");
    const chatBox = document.getElementById("chat-box");
    const welcomeScreen = document.getElementById("welcome-screen");
    const historyNav = document.getElementById("chat-history");
    const historyEmpty = document.getElementById("history-empty");
    const newChatButton = document.getElementById("new-chat-btn");
    const clearHistoryButton = document.getElementById("clear-history-btn");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const menuToggle = document.getElementById("menu-toggle");
    const sidebarClose = document.getElementById("sidebar-close");

    const STORAGE_KEY = "dzongkha-ai-chat-history-v1";
    const MAX_SAVED_CHATS = 20;

    let conversations = loadConversations();
    let activeConversationId = null;
    let isSending = false;

    function loadConversations() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            console.warn("Could not read saved chat history:", error);
            return [];
        }
    }

    function saveConversations() {
        try {
            conversations = conversations
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .slice(0, MAX_SAVED_CHATS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        } catch (error) {
            console.warn("Could not save chat history:", error);
        }
        renderHistory();
    }

    function makeId() {
        return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    }

    function getActiveConversation() {
        return conversations.find((chat) => chat.id === activeConversationId) || null;
    }

    function createConversation(firstMessage) {
        const conversation = {
            id: makeId(),
            title: firstMessage.length > 34 ? `${firstMessage.slice(0, 34).trim()}…` : firstMessage,
            messages: [],
            updatedAt: Date.now()
        };
        conversations.unshift(conversation);
        activeConversationId = conversation.id;
        return conversation;
    }

    function renderHistory() {
        historyNav.innerHTML = "";
        const sorted = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        if (sorted.length === 0) {
            const empty = document.createElement("p");
            empty.className = "history-empty";
            empty.textContent = "Your recent chats will appear here.";
            historyNav.appendChild(empty);
        }

        sorted.forEach((conversation) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "history-item";
            if (conversation.id === activeConversationId) item.classList.add("active");
            item.title = conversation.title;

            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("viewBox", "0 0 24 24");
            icon.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M8 5h9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7l-4 2V8a3 3 0 0 1 3-3h2Z");
            icon.appendChild(path);

            const label = document.createElement("span");
            label.textContent = conversation.title || "New conversation";
            item.append(icon, label);
            item.addEventListener("click", () => openConversation(conversation.id));
            historyNav.appendChild(item);
        });
    }

    function createMessageElement(role, content, options = {}) {
        const row = document.createElement("article");
        row.className = `message-row ${role === "user" ? "user-message" : "assistant-message"}`;
        if (options.error) row.classList.add("message-error");

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.setAttribute("aria-hidden", "true");

        if (role === "user") {
            avatar.textContent = "You";
        } else {
            avatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z"/><path d="M8 10h8M8 14h8"/></svg>';
        }

        const main = document.createElement("div");
        main.className = "message-main";

        const author = document.createElement("div");
        author.className = "message-author";
        author.textContent = role === "user" ? "You" : "Dzongkha AI";

        const body = document.createElement("div");
        body.className = "message-content";
        body.textContent = content;

        main.append(author, body);
        row.append(avatar, main);
        return row;
    }

    function showConversation(conversation) {
        chatBox.innerHTML = "";
        const hasMessages = Boolean(conversation && conversation.messages.length);
        welcomeScreen.classList.toggle("hidden", hasMessages);
        chatBox.classList.toggle("has-messages", hasMessages);

        if (hasMessages) {
            conversation.messages.forEach((message) => {
                chatBox.appendChild(createMessageElement(message.role, message.content, { error: message.error }));
            });
        }
        scrollToBottom();
    }

    function openConversation(id) {
        const conversation = conversations.find((chat) => chat.id === id);
        if (!conversation) return;
        activeConversationId = id;
        showConversation(conversation);
        renderHistory();
        closeSidebar();
    }

    function startNewChat() {
        if (isSending) return;
        activeConversationId = null;
        showConversation(null);
        renderHistory();
        input.value = "";
        updateComposer();
        input.focus();
        closeSidebar();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            const area = document.getElementById("conversation-area");
            area.scrollTop = area.scrollHeight;
        });
    }

    function showTypingIndicator() {
        const row = document.createElement("article");
        row.className = "message-row assistant-message";
        row.id = "typing-indicator";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z"/><path d="M8 10h8M8 14h8"/></svg>';

        const main = document.createElement("div");
        main.className = "message-main";
        const author = document.createElement("div");
        author.className = "message-author";
        author.textContent = "Dzongkha AI";
        const dots = document.createElement("div");
        dots.className = "typing-indicator";
        dots.setAttribute("aria-label", "Generating answer");
        dots.innerHTML = "<span></span><span></span><span></span>";
        main.append(author, dots);
        row.append(avatar, main);
        chatBox.appendChild(row);
        scrollToBottom();
        return row;
    }

    function updateComposer() {
        sendButton.disabled = isSending || !input.value.trim();
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }

    async function sendMessage(textOverride = null) {
        if (isSending) return;
        const message = (textOverride ?? input.value).trim();
        if (!message) return;

        if (!activeConversationId || !getActiveConversation()) {
            createConversation(message);
        }
        const conversation = getActiveConversation();
        if (!conversation) return;

        conversation.messages.push({ role: "user", content: message });
        conversation.updatedAt = Date.now();
        if (conversation.messages.length === 1) {
            conversation.title = message.length > 34 ? `${message.slice(0, 34).trim()}…` : message;
        }

        welcomeScreen.classList.add("hidden");
        chatBox.classList.add("has-messages");
        chatBox.appendChild(createMessageElement("user", message));
        input.value = "";
        isSending = true;
        updateComposer();
        renderHistory();
        const typing = showTypingIndicator();

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                throw new Error("The server returned an unreadable response.");
            }

            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status}).`);
            }

            const answer = data.answer || data.response || data.reply;
            if (!answer) {
                throw new Error(data.error || "The assistant returned an empty answer.");
            }

            typing.replaceWith(createMessageElement("assistant", answer));
            conversation.messages.push({ role: "assistant", content: answer });
            conversation.updatedAt = Date.now();
        } catch (error) {
            const messageText = error.message || "Unable to connect to the AI assistant.";
            typing.replaceWith(createMessageElement("assistant", messageText, { error: true }));
            conversation.messages.push({ role: "assistant", content: messageText, error: true });
            conversation.updatedAt = Date.now();
        } finally {
            isSending = false;
            updateComposer();
            saveConversations();
            scrollToBottom();
            input.focus();
        }
    }

    function openSidebar() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("visible");
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("visible");
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        sendMessage();
    });

    input.addEventListener("input", updateComposer);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!sendButton.disabled) sendMessage();
        }
    });

    document.querySelectorAll(".suggestion-card").forEach((button) => {
        button.addEventListener("click", () => {
            const prompt = button.dataset.prompt || "";
            input.value = prompt;
            updateComposer();
            sendMessage(prompt);
        });
    });

    newChatButton.addEventListener("click", startNewChat);
    clearHistoryButton.addEventListener("click", () => {
        if (!conversations.length) return;
        const confirmed = window.confirm("Clear all saved conversations from this browser?");
        if (!confirmed) return;
        conversations = [];
        activeConversationId = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn(error); }
        showConversation(null);
        renderHistory();
        closeSidebar();
    });

    menuToggle.addEventListener("click", openSidebar);
    sidebarClose.addEventListener("click", closeSidebar);
    sidebarOverlay.addEventListener("click", closeSidebar);

    renderHistory();
    updateComposer();
    showConversation(null);
})();
