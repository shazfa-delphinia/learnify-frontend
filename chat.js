console.log("=== Chat.js Loaded ===");

// Ambil elemen
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Pastikan addMessage global dari script.js tetap dipakai
function addMsg(text, role = "bot", isHTML = false) {
    if (window.addMessage) {
        window.addMessage(text, role, isHTML);
    } else {
        console.error("window.addMessage tidak ditemukan");
    }
}

// ========== Fungsi kirim ke backend AI ==========
async function sendToAI(msg) {
    try {
        const res = await fetch(`${NODE_API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg }),
        });

        const data = await res.json();
        return data.reply || null;

    } catch (error) {
        console.error("AI Error:", error);
        return null;
    }
}

// ========== Handler kirim pesan ==========
if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const text = chatInput.value.trim();
        if (!text) return;

        // tampilkan user bubble
        addMsg(text, "user");
        chatInput.value = "";

        // loading bubble
        const loading = document.createElement("div");
        loading.classList.add("bubble", "bubble-bot");
        loading.textContent = "Sedang memproses...";
        chatMessages.appendChild(loading);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 1️⃣ Coba AI dulu
        const aiReply = await sendToAI(text);

        loading.remove();

        if (aiReply) {
            addMsg(aiReply, "bot", !!aiReply.includes("<"));
            return;
        }

        // 2️⃣ Fallback dataset
        if (typeof getAnswerFromDicoding === "function") {
            const fallback = getAnswerFromDicoding(text);
            addMsg(fallback, "bot");
        } else {
            addMsg("Maaf, aku belum bisa menjawab pertanyaan itu.", "bot");
        }
    });
} else {
    console.error("chat-form tidak ditemukan");
}
