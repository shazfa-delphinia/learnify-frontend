import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// POST /auth/register - Menyimpan user baru
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name dan email wajib diisi" });
    }

    const { data, error } = await supabase
      .from("users")
      .insert([{ name, email, password }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Email sudah terdaftar" });
      }
      throw error;
    }

    res.status(201).json({ message: "Register berhasil", user: data });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Gagal register" });
  }
});

// POST /auth/login - Mengambil data user berdasarkan email dan verifikasi password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Email atau password salah" });
    }

    // Verifikasi password (simple comparison, in production use bcrypt)
    if (data.password !== password) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    // Jangan kirim password ke client
    const { password: _, ...userWithoutPassword } = data;

    res.json({ message: "Login berhasil", user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Gagal login" });
  }
});

export default router;
