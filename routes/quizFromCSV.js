import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper untuk membaca CSV
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// ===============================================
// GET /quiz/csv/interest/questions
// ===============================================
router.get("/csv/interest/questions", async (req, res) => {
  try {
    const csvPath = path.join(__dirname, "..", "Data", "Resource Data Learning Buddy - Current Interest Questions.csv");

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: "File CSV tidak ditemukan" });
    }

    const data = await readCSV(csvPath);

    const questionsMap = {};
    data.forEach((row) => {
      const question = row.question_desc || row.question;
      if (!questionsMap[question]) {
        questionsMap[question] = {
          question_text: question,
          options: [],
        };
      }
      questionsMap[question].options.push({
        option_text: row.option_text || row.option,
        category: row.category,
      });
    });

    const questions = Object.values(questionsMap);

    res.json({ questions });
  } catch (error) {
    console.error("Get interest questions error:", error);
    res.status(500).json({ error: "Gagal mengambil pertanyaan interest" });
  }
});

// ===============================================
// GET /quiz/csv/tech/questions
// ===============================================
router.get("/csv/tech/questions", async (req, res) => {
  try {
    const { tech_category, difficulty } = req.query;
    const csvPath = path.join(__dirname, "..", "Data", "Resource Data Learning Buddy - Current Tech Questions.csv");

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: "File CSV tidak ditemukan" });
    }

    let data = await readCSV(csvPath);

    if (tech_category) {
      data = data.filter(
        (row) =>
          (row.tech_category || "").toLowerCase() === tech_category.toLowerCase()
      );
    }

    if (difficulty) {
      data = data.filter(
        (row) =>
          (row.difficulty || "").toLowerCase() === difficulty.toLowerCase()
      );
    }

    const questionsByLevel = {};
    const allQuestionsByLevel = {};

    data.forEach((row) => {
      const level = (row.difficulty || row.Difficulty || "")
        .toLowerCase()
        .trim();
      if (!level || level === "unknown") return;

      if (!allQuestionsByLevel[level]) {
        allQuestionsByLevel[level] = [];
      }

      const questionText = row.question_desc || row.question || row.Question;
      if (!questionText) return;

      const options = [
        { label: "A", text: row.option_1 || row.Option_1 },
        { label: "B", text: row.option_2 || row.Option_2 },
        { label: "C", text: row.option_3 || row.Option_3 },
        { label: "D", text: row.option_4 || row.Option_4 },
      ].filter((o) => o.text);

      if (options.length < 2) return;

      const isDuplicate = allQuestionsByLevel[level].some(
        (q) => q.question_text === questionText
      );
      if (!isDuplicate) {
        allQuestionsByLevel[level].push({
          question_text: questionText,
          tech_category: row.tech_category || row.Tech_Category,
          difficulty: row.difficulty || row.Difficulty,
          options,
          correct_answer: row.correct_answer || row.Correct_Answer,
        });
      }
    });

    // Shuffle & ambil max 10 tiap level
    Object.keys(allQuestionsByLevel).forEach((level) => {
      const arr = allQuestionsByLevel[level];

      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      questionsByLevel[level] = arr.slice(0, 10);
    });

    const questions = Object.values(questionsByLevel).flat();

    res.json({ questions });
  } catch (error) {
    console.error("Get tech questions error:", error);
    res.status(500).json({ error: "Gagal mengambil pertanyaan tech" });
  }
});

export default router;
