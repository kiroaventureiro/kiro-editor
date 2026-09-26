export const config = {
  maxDuration: 60,
};

// Vercel Functions limitam o corpo da requisição a 4.5 MB. Mantemos uma
// margem para cabeçalhos e metadados e rejeitamos antes de o proxy falhar.
const MAX_PROXY_BYTES = 4_300_000;

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(
    contentType.startsWith("application/json")
      ? JSON.stringify(body)
      : String(body),
  );
}

function safeFilename(value) {
  try {
    const decoded = decodeURIComponent(value || "midia.webm");
    return decoded.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "midia.webm";
  } catch {
    return "midia.webm";
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return send(res, 200, {
      ready: Boolean(process.env.OPENAI_API_KEY),
      feature: "automatic-captions",
      maxBytes: MAX_PROXY_BYTES,
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Método não permitido." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, {
      error:
        "Legendas automáticas ainda não estão conectadas. Configure OPENAI_API_KEY no ambiente da Vercel.",
    });
  }

  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > MAX_PROXY_BYTES) {
    return send(res, 413, {
      error:
        "Nesta primeira versão, a transcrição automática aceita arquivos de até 4,3 MB. A próxima etapa usará upload direto para arquivos maiores.",
    });
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > MAX_PROXY_BYTES) {
      return send(res, 413, {
        error:
          "Nesta primeira versão, a transcrição automática aceita arquivos de até 4,3 MB. A próxima etapa usará upload direto para arquivos maiores.",
      });
    }
    chunks.push(chunk);
  }

  if (!received) {
    return send(res, 400, { error: "Nenhum áudio ou vídeo foi recebido." });
  }

  const bytes = Buffer.concat(chunks);
  const type = String(req.headers["content-type"] || "application/octet-stream")
    .split(";")[0]
    .trim();
  const filename = safeFilename(req.headers["x-file-name"]);

  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), filename);
  // SRT precisa de marcações de tempo. Enquanto o endpoint moderno recomendado
  // não expõe SRT, usamos whisper-1 para esta função específica e mantemos a
  // chamada isolada aqui para facilitar a migração futura.
  form.append("model", "whisper-1");
  form.append("response_format", "srt");

  try {
    const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      let message = "Falha ao transcrever o áudio.";
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || message;
      } catch {
        if (text.trim()) message = text.trim().slice(0, 500);
      }
      return send(res, upstream.status, { error: message });
    }

    return send(res, 200, text, "text/plain; charset=utf-8");
  } catch (error) {
    return send(res, 502, {
      error:
        error instanceof Error
          ? `Falha de conexão na transcrição: ${error.message}`
          : "Falha de conexão na transcrição.",
    });
  }
}
