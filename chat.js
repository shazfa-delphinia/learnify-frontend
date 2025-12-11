// ambil elemen
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// fungsi untuk nambah bubble chat ke layar
function addMessage(text, role = "user") {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble", role === "user" ? "bubble-user" : "bubble-bot");
  bubble.textContent = text;
  chatMessages.appendChild(bubble);

  // auto scroll ke bawah
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// saat form di-submit (klik tombol / tekan Enter)
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // biar halaman nggak reload

  const text = chatInput.value.trim();
  if (!text) return;

  // tampilkan pesan user
  addMessage(text, "user");
  chatInput.value = "";

  // ====== VERSI SEDERHANA: BOT DUMMY DI FRONTEND ======
  // nanti bagian ini bisa diganti panggilan ke backend / ML
  setTimeout(() => {
    const reply = `Kamu bilang: "${text}". Nanti di sini aku jawab pakai otak Learning Buddy 🙂`;
    addMessage(reply, "bot");
  }, 400);

  // ====== VERSI BACKEND (kalau sudah punya API /chat) ======
  try {
     const res = await fetch("http://localhost:5000/chat", {
      method: "POST",
       headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ message: text }),
   });
   const data = await res.json();
   addMessage(data.reply, "bot");
 } catch (err) {
   addMessage("Maaf, terjadi kesalahan koneksi ke server.", "bot");
 }
});
