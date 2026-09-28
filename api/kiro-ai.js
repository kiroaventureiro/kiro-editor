export const config = {
  maxDuration: 60,
};

const MAX_BODY_BYTES = 220_000;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_ACTIONS = 40;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!received) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const actionSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Resumo curto em português do que será alterado no projeto.",
    },
    actions: {
      type: "array",
      maxItems: MAX_ACTIONS,
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { const: "split_clip" },
              clipId: { type: "string" },
              time: { type: "number" },
            },
            required: ["type", "clipId", "time"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "delete_clips" },
              clipIds: { type: "array", items: { type: "string" }, maxItems: 40 },
              ripple: { type: "boolean" },
            },
            required: ["type", "clipIds"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "move_clip" },
              clipId: { type: "string" },
              start: { type: "number" },
            },
            required: ["type", "clipId", "start"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "update_clip" },
              clipId: { type: "string" },
              patch: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  volume: { type: "number" },
                  speed: { type: "number" },
                  x: { type: "number" },
                  y: { type: "number" },
                  scale: { type: "number" },
                  rotation: { type: "number" },
                  opacity: { type: "number" },
                  fadeIn: { type: "number" },
                  fadeOut: { type: "number" },
                  fontSize: { type: "number" },
                  fontWeight: { type: "number" },
                  color: { type: "string" },
                  backgroundColor: { type: "string" },
                  backgroundOpacity: { type: "number" },
                  brightness: { type: "number" },
                  contrast: { type: "number" },
                  saturation: { type: "number" },
                  blur: { type: "number" },
                },
                minProperties: 1,
                additionalProperties: false,
              },
            },
            required: ["type", "clipId", "patch"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "set_track" },
              trackId: { type: "string" },
              muted: { type: "boolean" },
              locked: { type: "boolean" },
            },
            required: ["type", "trackId"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "add_text" },
              text: { type: "string" },
              start: { type: "number" },
              duration: { type: "number" },
            },
            required: ["type", "text", "start", "duration"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["summary", "actions"],
  additionalProperties: false,
};

function compactProject(project) {
  if (!project || typeof project !== "object") return null;
  const tracks = Array.isArray(project.tracks) ? project.tracks.slice(0, 32) : [];
  return {
    id: String(project.id || "").slice(0, 120),
    name: String(project.name || "Projeto KIRO").slice(0, 180),
    settings: project.settings || {},
    currentTime: Number(project.currentTime || 0),
    selectedClipId: project.selectedClipId || null,
    tracks: tracks.map((track) => ({
      id: String(track.id || "").slice(0, 120),
      name: String(track.name || "").slice(0, 180),
      type: track.type,
      muted: Boolean(track.muted),
      locked: Boolean(track.locked),
      clips: (Array.isArray(track.clips) ? track.clips : []).slice(0, 120).map((clip) => ({
        id: String(clip.id || "").slice(0, 120),
        name: String(clip.name || "").slice(0, 180),
        type: clip.type,
        start: Number(clip.start || 0),
        duration: Number(clip.duration || 0),
        assetId: clip.assetId || undefined,
        text: typeof clip.text === "string" ? clip.text.slice(0, 500) : undefined,
        volume: clip.volume,
        speed: clip.speed,
        x: clip.x,
        y: clip.y,
        scale: clip.scale,
        opacity: clip.opacity,
      })),
    })),
  };
}

function extractText(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const parts = [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string")
        parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function extractToolCall(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.find(
    (item) => item?.type === "function_call" && item?.name === "apply_editor_actions",
  );
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return json(res, 200, {
      ready: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY),
      feature: "kiro-ai-editor",
      model: process.env.KIRO_AI_MODEL || "gpt-5.6-luna",
      maxActions: MAX_ACTIONS,
      gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Método não permitido." });
  }

  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!gatewayKey && !openaiKey)
    return json(res, 503, {
      error: "KIRO IA ainda não está conectada. Configure AI_GATEWAY_API_KEY ou OPENAI_API_KEY na Vercel.",
    });

  try {
    const body = await readJson(req);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json(res, 400, { error: "Escreva uma instrução para a KIRO IA." });
    if (message.length > MAX_MESSAGE_CHARS)
      return json(res, 400, { error: `A instrução pode ter no máximo ${MAX_MESSAGE_CHARS} caracteres.` });

    const project = compactProject(body.project);
    if (!project) return json(res, 400, { error: "Contexto do projeto inválido." });

    const useGateway = Boolean(gatewayKey);
    const baseUrl = useGateway
      ? "https://ai-gateway.vercel.sh/v1/responses"
      : "https://api.openai.com/v1/responses";
    const configuredModel = process.env.KIRO_AI_MODEL || "gpt-5.6-luna";
    const model = useGateway && !configuredModel.includes("/")
      ? `openai/${configuredModel}`
      : configuredModel;

    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayKey || openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        max_output_tokens: 1800,
        instructions:
          "Você é a KIRO IA dentro de um editor de vídeo. Responda em português do Brasil. Use apenas IDs presentes no contexto. Quando o usuário pedir uma alteração no projeto, chame apply_editor_actions e gere somente ações necessárias, preservando sincronização e conteúdo que não foi solicitado. Nunca invente clipes ou trilhas. Se o pedido for apenas uma pergunta, explicação ou sugestão, responda normalmente sem chamar ferramenta. Não afirme que uma alteração foi aplicada; diga que preparou ou executará as ações e deixe o aplicativo confirmar o resultado.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `CONTEXTO ATUAL DO EDITOR:\n${JSON.stringify(project)}\n\nPEDIDO DO USUÁRIO:\n${message}`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            name: "apply_editor_actions",
            description:
              "Executa alterações permitidas no projeto aberto do KIRO Editor. Use quando o usuário pedir para editar a timeline, clipes, textos, áudio ou trilhas.",
            parameters: actionSchema,
          },
        ],
        tool_choice: "auto",
      }),
    });

    const raw = await upstream.text();
    let response;
    try {
      response = JSON.parse(raw);
    } catch {
      response = null;
    }
    if (!upstream.ok) {
      const message = response?.error?.message || raw.slice(0, 500) || "Falha ao consultar a KIRO IA.";
      return json(res, upstream.status, { error: message });
    }

    const call = extractToolCall(response);
    let actions = [];
    let summary = "";
    if (call?.arguments) {
      try {
        const parsed = JSON.parse(call.arguments);
        actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, MAX_ACTIONS) : [];
        summary = typeof parsed.summary === "string" ? parsed.summary : "";
      } catch {
        return json(res, 502, { error: "A KIRO IA retornou comandos que não puderam ser interpretados." });
      }
    }

    const reply = extractText(response) || summary || (actions.length
      ? `Preparei ${actions.length} alteração(ões) para o projeto.`
      : "Não encontrei uma alteração segura para aplicar.");

    return json(res, 200, {
      reply,
      summary,
      actions,
      model,
      usage: response?.usage || null,
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return json(res, 400, { error: "JSON inválido." });
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")
      return json(res, 413, { error: "O contexto enviado à KIRO IA ficou grande demais." });
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Falha inesperada na KIRO IA.",
    });
  }
}
