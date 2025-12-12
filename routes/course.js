import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// GET /courses/:id/tutorials - Ambil tutorial dalam satu course
router.get("/:id/tutorials", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .eq("course_id", id)
      .order("tutorial_order", { ascending: true });

    if (error) throw error;

    res.json({ tutorials: data });
  } catch (error) {
    console.error("Get tutorials error:", error);
    res.status(500).json({ error: "Gagal mengambil tutorials" });
  }
});

// GET /courses/:id - Ambil detail course
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("course")
      .select(`
        *,
        learning_path (
          id,
          name_lp
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Course tidak ditemukan" });
    }

    res.json({ course: data });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ error: "Gagal mengambil course" });
  }
});

export default router;
