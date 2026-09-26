const categories = ["video", "image", "audio", "overlay", "template"];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Método não permitido." });
  }

  const scope = String(req.query?.scope || "public");

  // O catálogo interno da KIRO Produções nunca deve ser enviado ao navegador
  // por esta rota. Quando o painel administrativo for conectado à autenticação,
  // ele terá um endpoint separado, validado no servidor.
  if (scope !== "public") {
    return send(res, 403, {
      error: "Este catálogo não está disponível neste acesso.",
    });
  }

  return send(res, 200, {
    version: 1,
    scope: "public",
    categories,
    items: [],
  });
}
