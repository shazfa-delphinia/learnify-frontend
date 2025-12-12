import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// =============================================
// USER PROGRESS
// =============================================

// GET /user/:id/progress - Ambil progress user
router.get("/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_progress")
      .select(`
        id,
        status,
        progress_percentage,
        updated_at,
        tutorials (
          id,
          title,
          tutorial_order,
          course (
            id,
            course_name,
            level,
            learning_path (
              id,
              name_lp
            )
          )
        )
      `)
      .eq("user_id", id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    res.json({ progress: data });
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ error: "Gagal mengambil progress" });
  }
});

// POST /user/progress/update - Update progress tutorial
router.post("/progress/update", async (req, res) => {
  try {
    const { user_id, tutorial_id, status, progress_percentage } = req.body;

    if (!user_id || !tutorial_id) {
      return res.status(400).json({ error: "user_id dan tutorial_id wajib diisi" });
    }

    // Cek apakah progress sudah ada
    const { data: existing } = await supabase
      .from("user_progress")
      .select("id")
      .eq("user_id", user_id)
      .eq("tutorial_id", tutorial_id)
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("user_progress")
        .update({
          status: status || "in_progress",
          progress_percentage: progress_percentage || 0
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("user_progress")
        .insert([{
          user_id,
          tutorial_id,
          status: status || "not_started",
          progress_percentage: progress_percentage || 0
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ message: "Progress berhasil diupdate", progress: result });
  } catch (error) {
    console.error("Update progress error:", error);
    res.status(500).json({ error: "Gagal update progress" });
  }
});

// =============================================
// USER ROADMAP
// =============================================

// GET /user/:id/roadmap - Ambil roadmap milik user
router.get("/:id/roadmap", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_roadmap")
      .select(`
        id,
        user_level,
        generated_at,
        learning_path (
          id,
          name_lp,
          summary,
          course (
            id,
            course_name,
            level,
            hours_to_study,
            course_order,
            tutorials (
              id,
              title,
              tutorial_order
            )
          )
        )
      `)
      .eq("user_id", id)
      .order("generated_at", { ascending: false });

    if (error) throw error;

    res.json({ roadmaps: data });
  } catch (error) {
    console.error("Get roadmap error:", error);
    res.status(500).json({ error: "Gagal mengambil roadmap" });
  }
});

// POST /user/roadmap/generate - Menyimpan roadmap hasil rekomendasi chatbot
router.post("/roadmap/generate", async (req, res) => {
  try {
    const { user_id, lp_id, learning_path_name, user_level } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id wajib diisi" });
    }

    let finalLpId = lp_id;

    // If lp_id not provided but learning_path_name is, find LP by name
    if (!finalLpId && learning_path_name) {
      const { data: lpData, error: lpError } = await supabase
        .from("learning_path")
        .select("id")
        .ilike("name_lp", learning_path_name)
        .limit(1)
        .single();

      if (lpError || !lpData) {
        console.warn(`Learning path "${learning_path_name}" not found, creating roadmap without LP`);
        // Continue without LP ID if not found
      } else {
        finalLpId = lpData.id;
      }
    }

    // If still no LP ID, we can't create roadmap (LP is required in schema)
    if (!finalLpId) {
      return res.status(400).json({ 
        error: "lp_id atau learning_path_name wajib diisi",
        note: "Learning path tidak ditemukan di database"
      });
    }

    const { data, error } = await supabase
      .from("user_roadmap")
      .insert([{
        user_id,
        lp_id: finalLpId,
        user_level: user_level || "beginner"
      }])
      .select(`
        id,
        user_level,
        generated_at,
        learning_path (
          id,
          name_lp,
          summary
        )
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ message: "Roadmap berhasil dibuat", roadmap: data });
  } catch (error) {
    console.error("Generate roadmap error:", error);
    res.status(500).json({ error: "Gagal membuat roadmap" });
  }
});

// =============================================
// USER RESULTS
// =============================================

// GET /user/:id/lp-results - Ambil hasil LP quiz user
router.get("/:id/lp-results", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_learning_path_result")
      .select(`
        id,
        total_score,
        created_at,
        learning_path:recommended_lp (
          id,
          name_lp
        )
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ results: data });
  } catch (error) {
    console.error("Get LP results error:", error);
    res.status(500).json({ error: "Gagal mengambil hasil LP quiz" });
  }
});

// GET /user/:id/level-results - Ambil hasil level quiz user
router.get("/:id/level-results", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_level_result")
      .select(`
        id,
        level,
        score,
        created_at,
        learning_path (
          id,
          name_lp
        )
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ results: data });
  } catch (error) {
    console.error("Get level results error:", error);
    res.status(500).json({ error: "Gagal mengambil hasil level quiz" });
  }
});

// GET /user/:id/has-quiz-result - Cek apakah user sudah punya hasil kuis
router.get("/:id/has-quiz-result", async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah user sudah punya roadmap (indikator sudah selesai kuis)
    const { data: roadmap, error: roadmapError } = await supabase
      .from("user_roadmap")
      .select(`
        id,
        user_level,
        learning_path (
          id,
          name_lp
        )
      `)
      .eq("user_id", id)
      .order("generated_at", { ascending: false })
      .limit(1);

    if (roadmapError) throw roadmapError;

    // Cek juga apakah ada hasil LP atau level quiz
    const { data: lpResult, error: lpError } = await supabase
      .from("user_learning_path_result")
      .select("id")
      .eq("user_id", id)
      .limit(1);

    if (lpError) throw lpError;

    const hasResult = (roadmap && roadmap.length > 0) || (lpResult && lpResult.length > 0);
    
    // Return learning path and level if available
    const result = {
      hasQuizResult: hasResult
    };
    
    if (hasResult && roadmap && roadmap.length > 0) {
      result.learningPath = roadmap[0].learning_path?.name_lp || null;
      result.userLevel = roadmap[0].user_level || null;
    }

    res.json(result);
  } catch (error) {
    console.error("Check quiz result error:", error);
    res.status(500).json({ error: "Gagal mengecek hasil kuis" });
  }
});

export default router;
