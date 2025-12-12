import { NODE_API_URL } from "./config.js";

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

function addMessage(text, role = "user") {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble", role === "user" ? "bubble-user" : "bubble-bot");
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  chatInput.value = "";

  try {
    const res = await fetch(`${NODE_API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    addMessage(data.reply, "bot");
  } catch (err) {
    console.error(err);
    addMessage("Maaf, tidak dapat terhubung ke server.", "bot");
  }
});
