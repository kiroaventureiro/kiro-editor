function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.end(JSON.stringify(body));
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Método não permitido." });
  }

  const xaiConfigured = Boolean(process.env.XAI_API_KEY);
  const managedGenerationEnabled =
    process.env.CREATOR_HUB_GENERATION_ENABLED === "true";
  const openAiConfigured = Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
  );

  return send(res, 200, {
    version: 1,
    connectors: {
      "kiro-ai": {
        configured: openAiConfigured,
        auth: "managed",
        capabilities: ["chat", "editor.read", "editor.write", "agent"],
      },
      xai: {
        configured: xaiConfigured,
        generationEnabled: xaiConfigured && managedGenerationEnabled,
        requiresKiroAuth: true,
        auth: "kiro-account",
        capabilities: [
          "chat",
          "image.generate",
          "image.edit",
          "video.generate",
          "video.edit",
        ],
      },
    },
  });
}
