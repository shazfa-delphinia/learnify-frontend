// auth/signin.js
const API_URL = "https://learnify-backend-2exd.onrender.com";

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();

  if (!email) {
    alert("Email tidak boleh kosong.");
    return;
  }

  try {
    const res = await fetch(`${NODE_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Login gagal");
    }

    const data = await res.json().catch(() => null);

    // Simpan data user (sesuaikan dengan response backend kamu)
    if (data && data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user.id) {
        localStorage.setItem("userId", data.user.id);
      }
      localStorage.setItem("isLoggedIn", "true");
    }

    // Setelah login, kembali ke homepage
    window.location.href = "/index.html";
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}