const API_URL = "http://localhost:5000";

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    
    if (!res.ok) throw new Error("Register gagal");
    alert("Register berhasil! Silakan login.");
    window.location.href = "/auth/signin.html";
  } catch (err) {
    alert("Error: " + err.message);
  }
}