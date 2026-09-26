const allowedMediaTypes = new Set(["video", "audio", "image"]);
const allowedCategories = new Set([
  "video",
  "image",
  "audio",
  "overlay",
  "template",
]);
const allowedTiers = new Set(["free", "plus"]);
const allowedVisibility = new Set(["public", "internal"]);
const allowedStatus = new Set(["draft", "published", "archived"]);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.end(JSON.stringify(body));
}

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
      /\/$/,
      "",
    ),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    publicKey: String(
      process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "",
    ),
  };
}

async function verifyAdmin(req) {
  const { url, serviceKey, publicKey } = supabaseConfig();
  if (!url || !serviceKey || !publicKey)
    throw Object.assign(
      new Error("Backend da KIRO Library ainda não está configurado."),
      { status: 503 },
    );

  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer "))
    throw Object.assign(new Error("Faça login para acessar o Admin."), {
      status: 401,
    });

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: publicKey,
      Authorization: authorization,
    },
  });
  if (!userResponse.ok)
    throw Object.assign(new Error("Sessão inválida ou expirada."), {
      status: 401,
    });
  const user = await userResponse.json();
  if (!user?.id)
    throw Object.assign(new Error("Usuário inválido."), { status: 401 });

  const roleResponse = await fetch(
    `${url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(
      user.id,
    )}&role=eq.admin&select=role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!roleResponse.ok)
    throw Object.assign(
      new Error("Não foi possível validar a permissão administrativa."),
      { status: 502 },
    );
  const roles = await roleResponse.json();
  if (!Array.isArray(roles) || !roles.length)
    throw Object.assign(
      new Error("Esta conta não possui acesso administrativo à KIRO Library."),
      { status: 403 },
    );

  return { user, url, serviceKey };
}

function databaseHeaders(serviceKey, prefer) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function requiredString(value, field, max = 240) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw Object.assign(new Error(`${field} é obrigatório.`), { status: 400 });
  return text.slice(0, max);
}

function createRow(body, userId) {
  const mediaType = body?.mediaType;
  const category = body?.category;
  const tier = body?.tier;
  const visibility = body?.visibility;
  const status = body?.status;

  if (!allowedMediaTypes.has(mediaType))
    throw Object.assign(new Error("Tipo de mídia inválido."), { status: 400 });
  if (!allowedCategories.has(category))
    throw Object.assign(new Error("Categoria inválida."), { status: 400 });
  if (!allowedTiers.has(tier))
    throw Object.assign(new Error("Plano inválido."), { status: 400 });
  if (!allowedVisibility.has(visibility))
    throw Object.assign(new Error("Visibilidade inválida."), { status: 400 });
  if (!allowedStatus.has(status))
    throw Object.assign(new Error("Estado inválido."), { status: 400 });

  const storageBucket = requiredString(body?.storageBucket, "Bucket", 120);
  const storagePath = requiredString(body?.storagePath, "Caminho do arquivo", 500);
  if (
    visibility === "public" &&
    storageBucket !== "kiro-library-public"
  )
    throw Object.assign(
      new Error("Assets públicos devem ficar no bucket público da KIRO Library."),
      { status: 400 },
    );
  if (
    visibility === "internal" &&
    storageBucket !== "kiro-library-internal"
  )
    throw Object.assign(
      new Error("Assets internos devem ficar no bucket interno da KIRO Library."),
      { status: 400 },
    );

  return {
    name: requiredString(body?.name, "Nome", 180),
    media_type: mediaType,
    category,
    tier,
    visibility,
    status,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    public_url:
      visibility === "public" && typeof body?.publicUrl === "string"
        ? body.publicUrl.trim().slice(0, 1200)
        : null,
    thumbnail_url:
      typeof body?.thumbnailUrl === "string"
        ? body.thumbnailUrl.trim().slice(0, 1200) || null
        : null,
    duration:
      Number.isFinite(Number(body?.duration)) && Number(body.duration) >= 0
        ? Number(body.duration)
        : null,
    tags: cleanTags(body?.tags),
    collection:
      typeof body?.collection === "string"
        ? body.collection.trim().slice(0, 180) || null
        : null,
    created_by: userId,
  };
}

function patchRow(body) {
  const patch = {};
  if (body?.name !== undefined)
    patch.name = requiredString(body.name, "Nome", 180);
  if (body?.category !== undefined) {
    if (!allowedCategories.has(body.category))
      throw Object.assign(new Error("Categoria inválida."), { status: 400 });
    patch.category = body.category;
  }
  if (body?.tier !== undefined) {
    if (!allowedTiers.has(body.tier))
      throw Object.assign(new Error("Plano inválido."), { status: 400 });
    patch.tier = body.tier;
  }
  if (body?.status !== undefined) {
    if (!allowedStatus.has(body.status))
      throw Object.assign(new Error("Estado inválido."), { status: 400 });
    patch.status = body.status;
  }
  if (body?.tags !== undefined) patch.tags = cleanTags(body.tags);
  if (body?.collection !== undefined)
    patch.collection =
      typeof body.collection === "string"
        ? body.collection.trim().slice(0, 180) || null
        : null;
  return patch;
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON inválido."), { status: 400 });
  }
}

async function fetchAsset(url, serviceKey, id) {
  const response = await fetch(
    `${url}/rest/v1/kiro_library_assets?id=eq.${encodeURIComponent(
      id,
    )}&select=*&limit=1`,
    { headers: databaseHeaders(serviceKey) },
  );
  if (!response.ok) throw new Error("Falha ao ler o asset atualizado.");
  const rows = await response.json();
  return rows?.[0] ?? null;
}

export default async function handler(req, res) {
  try {
    const { user, url, serviceKey } = await verifyAdmin(req);

    if (req.method === "GET") {
      const response = await fetch(
        `${url}/rest/v1/kiro_library_assets?select=*&order=updated_at.desc`,
        { headers: databaseHeaders(serviceKey) },
      );
      if (!response.ok)
        throw Object.assign(new Error("Falha ao carregar o acervo administrativo."), {
          status: 502,
        });
      return send(res, 200, { items: await response.json() });
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      const row = createRow(body, user.id);
      const response = await fetch(`${url}/rest/v1/kiro_library_assets`, {
        method: "POST",
        headers: databaseHeaders(serviceKey, "return=representation"),
        body: JSON.stringify(row),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw Object.assign(
          new Error(payload?.message || "Falha ao cadastrar o asset."),
          { status: 502 },
        );
      return send(res, 201, { item: payload?.[0] });
    }

    const id = String(req.query?.id || "").trim();
    if (!id)
      throw Object.assign(new Error("ID do asset é obrigatório."), { status: 400 });

    if (req.method === "PATCH") {
      const patch = patchRow(await parseBody(req));
      if (!Object.keys(patch).length)
        throw Object.assign(new Error("Nenhuma alteração válida foi enviada."), {
          status: 400,
        });
      const response = await fetch(
        `${url}/rest/v1/kiro_library_assets?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: databaseHeaders(serviceKey, "return=representation"),
          body: JSON.stringify(patch),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw Object.assign(
          new Error(payload?.message || "Falha ao atualizar o asset."),
          { status: 502 },
        );
      const item = payload?.[0] ?? (await fetchAsset(url, serviceKey, id));
      return send(res, 200, { item });
    }

    if (req.method === "DELETE") {
      const response = await fetch(
        `${url}/rest/v1/kiro_library_assets?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: databaseHeaders(serviceKey, "return=representation"),
          body: JSON.stringify({ status: "archived" }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw Object.assign(
          new Error(payload?.message || "Falha ao arquivar o asset."),
          { status: 502 },
        );
      return send(res, 200, { item: payload?.[0] });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return send(res, 405, { error: "Método não permitido." });
  } catch (error) {
    return send(res, Number(error?.status || 500), {
      error:
        error instanceof Error
          ? error.message
          : "Falha inesperada no Admin da KIRO Library.",
    });
  }
}
