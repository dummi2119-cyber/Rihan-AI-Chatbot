import { Router } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { fetchWeatherContext, isWeatherQuestion } from "../lib/weather";

const router = Router();
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
    let messages = parsed.data.messages;
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (latestUserMessage && isWeatherQuestion(latestUserMessage.content)) {
      try {
        const weather = await fetchWeatherContext(latestUserMessage.content);
        req.log.info({ location: weather.location }, "Weather context added to NVIDIA request");
        messages = [
          {
            role: "system",
            content: weather.context,
          },
          ...messages,
        ];
      } catch (error) {
        req.log.error({ err: error }, "Weather lookup failed");
        res.status(502).json({
          error: "Live weather is temporarily unavailable. Please try again.",
        });
        return;
      }
    }

    const upstream = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      req.log.error(
        { status: upstream.status, responseBody: detail.slice(0, 2000) },
        "NVIDIA request failed",
      );
      if (upstream.status === 401) {
        res.status(401).json({ error: "NVIDIA API key is invalid or unauthorized." });
        return;
      }
      if (upstream.status === 404) {
        res.status(502).json({ error: "NVIDIA endpoint or model was not found. Check the configured model ID and API URL." });
        return;
      }
      if (upstream.status === 429) {
        res.status(429).json({ error: "NVIDIA rate limit reached. Please try again shortly." });
        return;
      }
      if (upstream.status === 502 || upstream.status === 503) {
        res.status(502).json({ error: "The NVIDIA model is temporarily unavailable. Please try again." });
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