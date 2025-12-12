document.addEventListener("DOMContentLoaded", function () {

    console.log("=== Chat.js Loaded ===");

    // Elemen UI
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");

    // ========== Tambah bubble chat ==========
    window.addMessage = function (text, role = "user", isHTML = false) {
        const bubble = document.createElement("div");
        bubble.classList.add("bubble", role === "user" ? "bubble-user" : "bubble-bot");

        if (isHTML) bubble.innerHTML = text;
        else bubble.textContent = text;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // ========== Kirim ke Backend (OpenAI) ==========
    async function sendToAI(prompt) {
        try {
            const res = await fetch(`${NODE_API_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt })
            });

            const data = await res.json();
            return data.reply || null;
        } catch (err) {
            console.error("AI error:", err);
            return null;
        }
    }

    // ========== Chat Handler ==========
    if (chatForm) {
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const text = chatInput.value.trim();
            if (!text) return;

            // bubble user
            window.addMessage(text, "user");
            chatInput.value = "";

            // bubble loading
            const loading = document.createElement("div");
            loading.classList.add("bubble", "bubble-bot");
            loading.textContent = "Sedang memproses...";
            chatMessages.appendChild(loading);

            // ===== AI FIRST =====
            const aiReply = await sendToAI(text);

            loading.remove();

            if (aiReply) {
                window.addMessage(aiReply, "bot");
                return;
            }

            // ===== FALLBACK DATASET =====
            if (typeof getAnswerFromDicoding === "function") {
                const fallback = getAnswerFromDicoding(text);
                window.addMessage(fallback, "bot");
            } else {
                window.addMessage("Maaf, aku belum bisa menjawab pertanyaan itu.", "bot");
            }
        });
    }

});
