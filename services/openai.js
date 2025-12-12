import axios from "axios";

export async function askGPT(message) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY tidak ditemukan");
      return "Maaf, AI service belum dikonfigurasi.";
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: message }],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error OpenAI:", error.response?.data || error.message);
    return "Maaf, terjadi kesalahan saat menghubungi AI.";
  }
}
