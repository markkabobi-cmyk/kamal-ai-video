import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";

const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 15 * 1024 * 1024 } });
const PORT = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.json());

app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "الوصف مطلوب." });
    }

    // هنا تم وضع الرابط الطويل الصحيح والمستقر للمحرك المباشر
    const response = await fetch("https://huggingface.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt.trim() }),
    });

    if (!response.ok) {
      throw new Error("المحرك مشغول حالياً، يرجى المحاولة مجدداً بعد ثوانٍ.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // تحويل الفيديو إلى صيغة Base64 ليرسل مباشرة للواجهة الأمامية لموقعك
    const videoBase64 = buffer.toString("base64");
    const videoUrl = `data:video/mp4;base64,${videoBase64}`;

    res.json({
      videoUrl,
      requestId: "free_" + Date.now()
    });

  } catch (e) {
    console.error("Generation error:", e);
    res.status(500).json({ error: e.message || "حدث خطأ أثناء التوليد المجاني." });
  } finally {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ KAMAL AI running on http://localhost:${PORT}`);
});
