console.log("=== Chat.js Loaded ===");

/* =========================
   Helpers
   ========================= */

// Pastikan addMessage global dari script.js tetap dipakai
function addMsg(text, role = "bot", isHTML = false) {
  if (typeof window.addMessage === "function") {
    window.addMessage(text, role, isHTML);
  } else {
    console.error("window.addMessage tidak ditemukan");
  }
}

/**
 * Kirim pesan ke backend AI
 * - Aman kalau response bukan JSON (misal error HTML)
 * - Ngeluarin error detail di console
 */
async function sendToAI(msg) {
  const url = `${window.NODE_API_URL}/chat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });

    // Ambil text dulu supaya aman kalau non-JSON
    const rawText = await res.text();

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      // Non-JSON response
      console.error("AI API returned non-JSON:", rawText);
      return null;
    }

    if (!res.ok) {
      console.error("AI API error:", res.status, data);
      return null;
    }

    return data.reply || null;
  } catch (error) {
    console.error("AI fetch error:", error);
    return null;
  }
}

/* =========================
   Main
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  if (!chatForm || !chatInput || !chatMessages) {
    console.error("Chat elements tidak ditemukan:", {
      chatForm: !!chatForm,
      chatInput: !!chatInput,
      chatMessages: !!chatMessages,
    });
    return;
  }

  // Enter untuk kirim (berguna kalau nanti input kamu jadi textarea)
  chatInput.addEventListener("keydown", (e) => {
    // Kirim pakai Enter (tanpa Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Trigger submit form
      chatForm.requestSubmit ? chatForm.requestSubmit() : chatForm.dispatchEvent(new Event("submit"));
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Login guard
    if (typeof window.requireLoginForChat === "function") {
      const ok = window.requireLoginForChat(e);
      if (!ok) return;
    }

    const text = (chatInput.value || "").trim();
    if (!text) return;

    // Bubble user
    addMsg(text, "user", false);
    chatInput.value = "";
    chatInput.focus();

    // Loading bubble bot
    const loading = document.createElement("div");
    loading.className = "bubble bubble-bot";
    loading.textContent = "Sedang memproses...";
    chatMessages.appendChild(loading);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 1) Coba AI
    const aiReply = await sendToAI(text);

    // Hapus loading
    loading.remove();

    if (aiReply) {
      // Rapihin jawaban AI kalau formatter tersedia
      if (typeof window.formatAIResponse === "function") {
        const prettyHTML = window.formatAIResponse(aiReply);
        addMsg(prettyHTML, "bot", true);
      } else {
        addMsg(aiReply, "bot", false);
      }
      return;
    }

    // 2) Fallback dataset
    if (typeof window.getAnswerFromDicoding === "function") {
      const fallback = window.getAnswerFromDicoding(text);
      addMsg(fallback, "bot", false);
    } else {
      addMsg("Maaf, aku belum bisa menjawab pertanyaan itu.", "bot", false);
    }
  });
});
