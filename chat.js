console.log("=== Chat.js Loaded ===");

// ---------- helper: aman ambil context user ----------
function getUserContext() {
  const userId = localStorage.getItem("userId") || null;
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  return {
    isLoggedIn,
    userId,
    learningPath: localStorage.getItem("userLearningPath") || "",
    userLevel: localStorage.getItem("userLevel") || "",
    interestCategory: localStorage.getItem("userInterestCategory") || "",
  };
}

// ---------- helper: nambah message via global addMessage ----------
function addMsg(text, role = "bot", isHTML = false) {
  if (window.addMessage) return window.addMessage(text, role, isHTML);
  console.error("window.addMessage tidak ditemukan");
}

// ---------- helper: route intent lokal (tanpa AI) ----------
async function handleLocalIntent(userTextRaw) {
  const text = (userTextRaw || "").toLowerCase().trim();
  const ctx = getUserContext();

  // kalau belum login, biarin guard yang redirect (tetap return false biar AI gak dipanggil)
  if (!ctx.isLoggedIn || !ctx.userId) return false;

  // 1) kalau user minta kuis
  if (/\bkuis\b|\bquiz\b|\bmulai kuis\b|\btes\b/.test(text)) {
    if (typeof window.showQuizOptions === "function") {
      window.showQuizOptions();
      return true;
    }
    addMsg("Fitur kuis belum siap. Coba refresh halaman ya.", "bot");
    return true;
  }

  // 2) kalau user minta roadmap
  if (/\broadmap\b|\bmodul\b|\bjalur belajar\b|\blearning path\b.*\broadmap\b|\broadmap aku\b/.test(text)) {
    // kalau user belum punya hasil kuis
    if (!ctx.learningPath) {
      addMsg(
        "Roadmap kamu belum ada karena kamu belum menyelesaikan kuis. Ketik **kuis** untuk mulai ya 😊",
        "bot",
        true
      );
      return true;
    }

    if (typeof window.displayRoadmap === "function") {
      await window.displayRoadmap(ctx.userId);
      return true;
    }

    addMsg("Fitur roadmap belum siap. Coba refresh halaman ya.", "bot");
    return true;
  }

  // 3) kalau user nanya “learning path aku apa / hasil kuis aku”
  if (
    /\blearning path aku\b|\bjalur belajar aku\b|\bhasil kuis\b|\bpath aku\b|\blevel aku\b|\blevel skill\b/.test(text)
  ) {
    if (!ctx.learningPath) {
      addMsg(
        "Aku belum bisa menentukan learning path kamu karena kamu belum mengerjakan kuis. Ketik **kuis** untuk mulai ya 😊",
        "bot",
        true
      );
      return true;
    }

    const lp = ctx.learningPath || "—";
    const lvl = ctx.userLevel ? ` (${ctx.userLevel})` : "";
    const cat = ctx.interestCategory ? `<br><small style="opacity:.85">Kategori: ${ctx.interestCategory}</small>` : "";

    const html = `
      <div style="color:#ffffff; line-height:1.7;">
        <p style="margin:0 0 10px 0;"><strong>📌 Hasil kuis kamu:</strong></p>
        <p style="margin:0;"><strong>Learning Path:</strong> ${lp}${lvl}</p>
        ${cat}
        <p style="margin:12px 0 0 0; opacity:.9;">Ketik <strong>roadmap</strong> kalau mau lihat modul & urutannya.</p>
      </div>
    `;
    addMsg(html, "bot", true);
    return true;
  }

  return false; // tidak ada intent lokal yang match
}

// ---------- fungsi kirim ke backend AI (dengan konteks user) ----------
async function sendToAI(msg) {
  const ctx = getUserContext();

  try {
    const res = await fetch(`${NODE_API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        userId: ctx.userId,
        userLearningPath: ctx.learningPath,
        userLevel: ctx.userLevel,
        userInterestCategory: ctx.interestCategory,
      }),
    });

    const data = await res.json();
    return data.reply || null;
  } catch (error) {
    console.error("AI Error:", error);
    return null;
  }
}

// ---------- main ----------
document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  if (!chatForm || !chatInput || !chatMessages) {
    console.error("chat elements tidak ditemukan");
    return;
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ login guard (kalau belum login, redirect)
    if (typeof requireLoginForChat === "function" && !requireLoginForChat(e)) return;

    const text = chatInput.value.trim();
    if (!text) return;

    // tampilkan user bubble
    addMsg(text, "user");
    chatInput.value = "";
    chatInput.focus();

    // 0) coba handle intent lokal dulu (kuis/roadmap/hasil kuis)
    const handled = await handleLocalIntent(text);
    if (handled) return;

    // loading bubble
    const loading = document.createElement("div");
    loading.classList.add("bubble", "bubble-bot");
    loading.textContent = "Sedang memproses...";
    chatMessages.appendChild(loading);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 1) Coba AI
    const aiReply = await sendToAI(text);
    loading.remove();

    if (aiReply) {
      if (typeof window.formatAIResponse === "function") {
        const pretty = window.formatAIResponse(aiReply);
        addMsg(pretty, "bot", true);
      } else {
        addMsg(aiReply, "bot", false);
      }
      return;
    }

    // 2) Fallback dataset
    if (typeof getAnswerFromDicoding === "function") {
      const fallback = getAnswerFromDicoding(text);
      addMsg(fallback, "bot");
    } else {
      addMsg("Maaf, aku belum bisa menjawab pertanyaan itu.", "bot");
    }
  });
});
