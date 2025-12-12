import express from "express";
import { askGPT } from "../services/openai.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message is required" });
    }

    const reply = await askGPT(message);
    res.json({ reply });
  } catch (error) {
    console.error("Chat route error:", error);
    res.status(500).json({ reply: "Internal server error" });
  }
});

export default router;
