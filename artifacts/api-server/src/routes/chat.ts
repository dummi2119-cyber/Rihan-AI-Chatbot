import { Router, type IRouter } from "express";
import { SendChatMessageBody, SendChatMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please send a valid conversation." });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    req.log.error("NVIDIA_API_KEY is not configured");
    res.status(500).json({ error: "The AI service is not configured yet." });
    return;
  }

  try {
    const upstream = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: parsed.data.messages,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      req.log.error({ status: upstream.status, detail: detail.slice(0, 500) }, "NVIDIA request failed");
      if (upstream.status === 401 || upstream.status === 403) {
        res.status(502).json({ error: "NVIDIA API key rejected. Please update NVIDIA_API_KEY and try again." });
        return;
      }
      res.status(502).json({ error: "Rihan AI could not reach the model. Please try again." });
      return;
    }

    const payload = (await upstream.json()) as {
      choices?: Array<{ message?: { role?: string; content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.length === 0) {
      req.log.error("NVIDIA response did not include assistant content");
      res.status(502).json({ error: "The model returned an empty response. Please try again." });
      return;
    }

    const response = SendChatMessageResponse.parse({
      message: { role: "assistant", content: content.slice(0, 12000) },
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Unexpected NVIDIA request error");
    res.status(502).json({ error: "Something went wrong while contacting Rihan AI." });
  }
});

export default router;