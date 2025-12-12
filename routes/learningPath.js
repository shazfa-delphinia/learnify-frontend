import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// GET /learning-paths - Ambil semua learning path
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("learning_path")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ learning_paths: data });
  } catch (error) {
    console.error("Get learning paths error:", error);
    res.status(500).json({ error: "Gagal mengambil learning paths" });
  }
});

// GET /learning-paths/:id - Ambil detail learning path
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("learning_path")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Learning path tidak ditemukan" });
    }

    res.json({ learning_path: data });
  } catch (error) {
    console.error("Get learning path error:", error);
    res.status(500).json({ error: "Gagal mengambil learning path" });
  }
});

// GET /learning-paths/:id/courses - Ambil course berdasarkan LP
router.get("/:id/courses", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("course")
      .select("*")
      .eq("lp_id", id)
      .order("course_order", { ascending: true });

    if (error) throw error;

    res.json({ courses: data });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ error: "Gagal mengambil courses" });
  }
});

export default router;
