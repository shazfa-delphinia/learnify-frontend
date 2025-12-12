/************************************************************
 *  FINAL CHAT.JS — AI FIRST, FALLBACK KE DATASET
 ************************************************************/

console.log("=== Chat.js Loaded ===");

// Pastikan elemen tersedia
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Hapus event listener lama yang mungkin ditambahkan script.js
chatForm.replaceWith(chatForm.cloneNode(true)); 
// lalu ambil ulang elemennya
const form = document.getElementById("chat-form");


// ========== Fungsi Tambah Bubble Chat ==========
function addMessage(text, role = "user") {
    const bubble = document.createElement("div");
    bubble.classList.add("bubble", role === "user" ? "bubble-user" : "bubble-bot");
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ========== Fungsi Kirim ke Backend OpenAI ==========
async function sendToAI(userMessage) {
    try {
        const response = await fetch(`${NODE_API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage })
        });

        const data = await response.json();
        return data.reply || null;
    } catch (err) {
        console.error("AI Fetch Error:", err);
        return null;
    }
}


// ========== Fallback ke Dataset (fungsi dari script.js) ==========
function fallbackDataset(userText) {
    if (typeof getBestAnswerFromDataset === "function") {
        return getBestAnswerFromDataset(userText);
    }
    return "Maaf, aku belum bisa menemukan jawaban.";
}


// ========== Event Submit Chat ==========
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    // tampilkan pesan user
    addMessage(text, "user");
    chatInput.value = "";

    // loading bubble
    const loadingBubble = document.createElement("div");
    loadingBubble.classList.add("bubble", "bubble-bot");
    loadingBubble.textContent = "Sedang memikirkan jawaban...";
    chatMessages.appendChild(loadingBubble);


    // =====================
    // 1️⃣ Coba jawab pakai AI
    // =====================
    const aiReply = await sendToAI(text);

    // Hapus loading
    loadingBubble.remove();

    if (aiReply) {
        addMessage(aiReply, "bot");
        return;
    }

    // =====================
    // 2️⃣ AI gagal → fallback dataset
    // =====================
    const datasetReply = fallbackDataset(text);
    addMessage(datasetReply, "bot");
});

