// auth/signup.js
const API_URL = "https://learnify-backend-2exd.onrender.com";

async function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!name || !email || !password) {
    alert("Semua field wajib diisi.");
    return;
  }

  try {
    const res = await fetch(`${NODE_API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Register gagal");
    }

    alert("Register berhasil! Silakan login.");
    window.location.href = "/auth/signin.html";
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}
