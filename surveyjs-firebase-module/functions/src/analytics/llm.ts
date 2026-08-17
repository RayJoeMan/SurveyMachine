import { HttpsError } from "firebase-functions/v2/https";

export interface LlmResult {
  provider: string;
  model: string;
  text: string;
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Minimal Gemini REST client (no SDK dependency). The API key is read from the
 * function environment and sent via the `x-goog-api-key` header so it never
 * appears in request URLs or logs. Enabled only when LLM_API_KEY is set.
 */
export async function generateText(systemPrompt: string, userPrompt: string): Promise<LlmResult> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "AI analytics is not configured yet. The operator must set LLM_API_KEY.",
    );
  }
  const model = process.env.LLM_MODEL?.trim() || "gemini-2.0-flash";

  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpsError("internal", `LLM request failed (${response.status}).`, {
      detail: body.slice(0, 300),
    });
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new HttpsError("internal", "The LLM returned an empty response.");
  }

  return { provider: "google-gemini", model, text };
}
