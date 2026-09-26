const XAI_BASE_URL = "https://api.x.ai/v1";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const expected = String(process.env.CREATOR_HUB_ADMIN_TOKEN || "");
  if (!expected) return false;
  const auth = String(req.headers.authorization || "");
  return auth === `Bearer ${expected}`;
}

function assertGenerationEnabled(req) {
  if (process.env.CREATOR_HUB_GENERATION_ENABLED !== "true") {
    const error = new Error("Geração externa ainda não foi liberada neste ambiente.");
    error.status = 503;
    throw error;
  }
  if (!process.env.XAI_API_KEY) {
    const error = new Error("O conector Grok/xAI ainda não está configurado no servidor.");
    error.status = 503;
    throw error;
  }
  if (!authorized(req)) {
    const error = new Error("Entre com uma conta KIRO autorizada antes de usar geração paga.");
    error.status = 401;
    throw error;
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("JSON inválido.");
    error.status = 400;
    throw error;
  }
}

function cleanPrompt(value) {
  const prompt = typeof value === "string" ? value.trim() : "";
  if (!prompt) {
    const error = new Error("Escreva um prompt para gerar a mídia.");
    error.status = 400;
    throw error;
  }
  if (prompt.length > 4000) {
    const error = new Error("O prompt deve ter no máximo 4.000 caracteres.");
    error.status = 400;
    throw error;
  }
  return prompt;
}

async function xaiRequest(path, options = {}) {
  const response = await fetch(`${XAI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Falha no provedor xAI (${response.status}).`;
    const error = new Error(message);
    error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return payload;
}

async function generateImage(body) {
  const payload = await xaiRequest("/images/generations", {
    method: "POST",
    body: JSON.stringify({
      model: body.model || "grok-imagine-image-2.0",
      prompt: cleanPrompt(body.prompt),
      ...(body.aspectRatio ? { aspect_ratio: String(body.aspectRatio) } : {}),
      ...(body.resolution ? { resolution: String(body.resolution) } : {}),
      response_format: "url",
    }),
  });

  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  return {
    provider: "xai",
    kind: "image",
    status: "done",
    url: first?.url || null,
    revisedPrompt: first?.revised_prompt || null,
    usage: payload?.usage || null,
  };
}

async function startVideo(body) {
  const duration = Math.max(1, Math.min(15, Number(body.duration) || 6));
  const payload = await xaiRequest("/videos/generations", {
    method: "POST",
    body: JSON.stringify({
      model: body.model || "grok-imagine-video-1.5",
      prompt: cleanPrompt(body.prompt),
      duration,
      ...(body.aspectRatio ? { aspect_ratio: String(body.aspectRatio) } : {}),
      ...(body.resolution ? { resolution: String(body.resolution) } : {}),
      storage_options: {
        filename: `kiro-${Date.now()}.mp4`,
        public_url: true,
      },
    }),
  });

  if (!payload?.request_id) {
    const error = new Error("A xAI não retornou um identificador para o vídeo.");
    error.status = 502;
    throw error;
  }

  return {
    provider: "xai",
    kind: "video",
    status: "queued",
    requestId: payload.request_id,
  };
}

async function pollVideo(id) {
  if (!/^[A-Za-z0-9-]{8,120}$/.test(id)) {
    const error = new Error("Identificador de vídeo inválido.");
    error.status = 400;
    throw error;
  }
  const payload = await xaiRequest(`/videos/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return {
    provider: "xai",
    kind: "video",
    status: payload?.status || "unknown",
    requestId: id,
    url: payload?.video?.url || payload?.video?.file_output?.public_url || null,
    publicUrl: payload?.video?.file_output?.public_url || null,
    error: payload?.error || null,
  };
}

export default async function handler(req, res) {
  try {
    assertGenerationEnabled(req);

    if (req.method === "POST") {
      const body = await readJson(req);
      if (body?.provider !== "xai") {
        return send(res, 400, { error: "Provedor não suportado nesta rota." });
      }
      if (body?.kind === "image") return send(res, 200, await generateImage(body));
      if (body?.kind === "video") return send(res, 202, await startVideo(body));
      return send(res, 400, { error: "Tipo de mídia inválido." });
    }

    if (req.method === "GET") {
      const id = String(req.query?.id || "").trim();
      if (!id) return send(res, 400, { error: "Informe o request id do vídeo." });
      return send(res, 200, await pollVideo(id));
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Método não permitido." });
  } catch (error) {
    return send(res, Number(error?.status || 500), {
      error: error instanceof Error ? error.message : "Falha inesperada na geração de mídia.",
    });
  }
}
