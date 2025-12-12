import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { askGPT } from "./services/openai.js";

import authRoutes from "./routes/auth.js";
import quizRoutes from "./routes/quiz.js";
import quizFromCSVRoutes from "./routes/quizFromCSV.js";
import learningPathRoutes from "./routes/learningPath.js";
import courseRoutes from "./routes/course.js";
import userRoutes from "./routes/user.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Learnify backend is running 🚀");
});

// routes
app.use("/auth", authRoutes);
app.use("/quiz", quizRoutes);
app.use("/quiz", quizFromCSVRoutes);
app.use("/learning-paths", learningPathRoutes);
app.use("/courses", courseRoutes);
app.use("/user", userRoutes);

// CHAT ENDPOINT
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message is required" });
    }

    const reply = await askGPT(message);
    res.json({ reply });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({ reply: "Terjadi kesalahan pada server." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
