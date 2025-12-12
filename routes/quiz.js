import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// =============================================
// LEARNING PATH QUIZ
// =============================================

// GET /quiz/lp/questions - Ambil semua pertanyaan LP quiz
router.get("/lp/questions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("lp_quiz_questions")
      .select(`
        id,
        question_text,
        lp_quiz_options (
          id,
          option_text,
          lp_category
        )
      `)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ questions: data });
  } catch (error) {
    console.error("Get LP questions error:", error);
    res.status(500).json({ error: "Gagal mengambil pertanyaan" });
  }
});

// POST /quiz/lp/submit - Submit jawaban LP quiz
router.post("/lp/submit", async (req, res) => {
  try {
    const { user_id, answers } = req.body;
    // answers = [{ question_id, selected_option_id }, ...]

    if (!user_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "user_id dan answers wajib diisi" });
    }

    // Ambil semua option yang dipilih untuk hitung kategori
    const optionIds = answers.map((a) => a.selected_option_id);
    const { data: options, error: optError } = await supabase
      .from("lp_quiz_options")
      .select("lp_category")
      .in("id", optionIds);

    if (optError) throw optError;

    // Hitung score per kategori
    const categoryScores = {};
    options.forEach((opt) => {
      if (opt.lp_category) {
        categoryScores[opt.lp_category] = (categoryScores[opt.lp_category] || 0) + 1;
      }
    });

    // Cari kategori dengan score tertinggi
    let maxCategory = null;
    let maxScore = 0;
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category;
      }
    }

    // Cari learning path berdasarkan kategori
    let recommendedLpId = null;
    if (maxCategory) {
      const { data: lp } = await supabase
        .from("learning_path")
        .select("id")
        .ilike("name_lp", `%${maxCategory}%`)
        .single();
      
      if (lp) recommendedLpId = lp.id;
    }

    // Simpan hasil
    const { data: result, error: saveError } = await supabase
      .from("user_learning_path_result")
      .insert([{
        user_id,
        recommended_lp: recommendedLpId,
        total_score: answers.length
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    res.json({
      message: "Quiz LP berhasil disubmit",
      result: {
        ...result,
        category_scores: categoryScores,
        recommended_category: maxCategory
      }
    });
  } catch (error) {
    console.error("Submit LP quiz error:", error);
    res.status(500).json({ error: "Gagal submit quiz" });
  }
});

// =============================================
// LEVEL QUIZ
// =============================================

// GET /quiz/level/questions - Ambil soal untuk learning path tertentu
router.get("/level/questions", async (req, res) => {
  try {
    const { tech_category, level } = req.query;

    let query = supabase
      .from("level_quiz_questions")
      .select(`
        id,
        tech_category,
        level,
        question_text,
        level_quiz_options (
          id,
          option_label,
          option_text
        )
      `)
      .order("created_at", { ascending: true });

    if (tech_category) {
      query = query.eq("tech_category", tech_category);
    }
    if (level) {
      query = query.eq("level", level);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ questions: data });
  } catch (error) {
    console.error("Get level questions error:", error);
    res.status(500).json({ error: "Gagal mengambil pertanyaan" });
  }
});

// POST /quiz/level/submit - Submit jawaban level quiz
router.post("/level/submit", async (req, res) => {
  try {
    const { user_id, learning_path_id, answers } = req.body;
    // answers = [{ question_id, selected_option_id }, ...]

    if (!user_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "user_id dan answers wajib diisi" });
    }

    // Ambil semua option yang dipilih untuk cek jawaban benar
    const optionIds = answers.map((a) => a.selected_option_id);
    const { data: options, error: optError } = await supabase
      .from("level_quiz_options")
      .select("id, is_correct")
      .in("id", optionIds);

    if (optError) throw optError;

    // Hitung score (jawaban benar)
    const correctCount = options.filter((opt) => opt.is_correct).length;
    const totalQuestions = answers.length;
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

    // Tentukan level berdasarkan score
    let determinedLevel = "beginner";
    if (scorePercentage >= 80) {
      determinedLevel = "advanced";
    } else if (scorePercentage >= 50) {
      determinedLevel = "intermediate";
    }

    // Simpan hasil
    const { data: result, error: saveError } = await supabase
      .from("user_level_result")
      .insert([{
        user_id,
        learning_path: learning_path_id,
        level: determinedLevel,
        score: scorePercentage
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    res.json({
      message: "Quiz level berhasil disubmit",
      result: {
        ...result,
        correct_answers: correctCount,
        total_questions: totalQuestions
      }
    });
  } catch (error) {
    console.error("Submit level quiz error:", error);
    res.status(500).json({ error: "Gagal submit quiz" });
  }
});

// =============================================
// ML PIPELINE INTEGRATION
// =============================================

// POST /quiz/ml/predict - Call ML pipeline to predict learning path
router.post("/ml/predict", async (req, res) => {
  try {
    const { user_interest_answers, user_tech_answers_mcq, student_id } = req.body;

    // Validate that at least one type of answer is provided
    const hasInterest = user_interest_answers && Array.isArray(user_interest_answers) && user_interest_answers.length > 0;
    const hasTech = user_tech_answers_mcq && typeof user_tech_answers_mcq === 'object' && Object.keys(user_tech_answers_mcq).length > 0;

    if (!hasInterest && !hasTech) {
      return res.status(400).json({ error: "Minimal salah satu dari user_interest_answers atau user_tech_answers_mcq harus diisi" });
    }

    // Ensure both are provided (use empty defaults if missing)
    const interestAnswers = hasInterest ? user_interest_answers : [];
    const techAnswers = hasTech ? user_tech_answers_mcq : {};

    // Call Python ML API
    const axios = (await import("axios")).default;
    try {
      const mlResponse = await axios.post("http://localhost:8000/predict", {
        user_interest_answers: interestAnswers,
        user_tech_answers_mcq: techAnswers,
        student_id
      }, {
        timeout: 30000 // 30 second timeout
      });

      res.json(mlResponse.data);
    } catch (mlError) {
      console.error("ML API error:", mlError.message);
      if (mlError.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: "ML server tidak dapat diakses. Pastikan ML server sudah running di port 8000.",
          details: "Coba jalankan: python ml_server.py"
        });
      }
      throw mlError;
    }
  } catch (error) {
    console.error("ML prediction error:", error);
    res.status(500).json({ 
      error: "Gagal memprediksi learning path", 
      details: error.message 
    });
  }
});

export default router;
