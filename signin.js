const API_URL = "http://localhost:5000";

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    
    if (!res.ok) throw new Error("Login gagal");
    const data = await res.json();
    
    // Simpan user info
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "/index.html";
  } catch (err) {
    alert("Error: " + err.message);
  }
}