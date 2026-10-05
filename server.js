import express from "express";
import multer from "multer";
import { fal } from "@fal-ai/client";
import fs from "fs";
import os from "os";

const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 15 * 1024 * 1024 } });
const PORT = process.env.PORT || 3000;

if (!process.env.FAL_KEY) {
  console.warn("⚠️  FAL_KEY is not set as environment variable. Clients can still send it via the form.");
}

app.use(express.static("."));

app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    const {
      prompt,
      negative_prompt,
      duration = "5",
      resolution = "720p",
      mode = "t",
      seed,
      api_key
    } = req.body;

    // Prefer key from request (for easy testing), fallback to env
    const falKey = (api_key && api_key.trim()) || process.env.FAL_KEY;
    if (!falKey) {
      return res.status(500).json({
        error: "مفتاح fal.ai مطلوب. الصقه في الحقل أو اضبط متغير البيئة FAL_KEY."
      });
    }

    // Configure fal with the key for this request
    fal.config({ credentials: falKey });

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "الوصف مطلوب." });
    }

    const dur = duration === "10" ? "10" : "5";
    const resl = ["480p", "720p", "1080p"].includes(resolution) ? resolution : "720p";

    const neg =
      negative_prompt?.trim() ||
      "low quality, blurry, distorted face, deformed hands, extra fingers, extra limbs, duplicate person, watermark, text";

    let result;

    if (mode === "i" || req.file) {
      if (!req.file) {
        return res.status(400).json({ error: "الصورة مطلوبة لوضع صورة → فيديو." });
      }

      const imageUrl = await fal.storage.upload(req.file.path);

      const input = {
        prompt: prompt.trim(),
        image_url: imageUrl,
        duration: dur,
        resolution: resl,
        negative_prompt: neg,
        enable_prompt_expansion: true
      };

      if (seed && Number.isInteger(Number(seed))) {
        input.seed = Number(seed);
      }

      result = await fal.subscribe("fal-ai/wan-25-preview/image-to-video", {
        input,
        logs: true
      });
    } else {
      // Text → Video
      const input = {
        prompt: prompt.trim(),
        duration: dur,
        resolution: resl,
        negative_prompt: neg,
        enable_prompt_expansion: true
      };

      if (seed && Number.isInteger(Number(seed))) {
        input.seed = Number(seed);
      }

      result = await fal.subscribe("fal-ai/wan-25-preview/text-to-video", {
        input,
        logs: true
      });
    }

    const videoUrl =
      result?.data?.video?.url ||
      result?.data?.video_url ||
      result?.video?.url;

    if (!videoUrl) {
      return res.status(502).json({
        error: "fal.ai لم يرجع رابط فيديو.",
        details: result?.data || null
      });
    }

    res.json({
      videoUrl,
      requestId: result?.requestId || null
    });
  } catch (e) {
    console.error("Generation error:", e);
    const msg = e?.body?.detail || e?.message || "حدث خطأ أثناء التوليد.";
    res.status(500).json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) });
  } finally {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ KAMAL AI running on http://localhost:${PORT}`);
});
