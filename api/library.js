const categories = ["video", "image", "audio", "overlay", "template"];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  res.end(JSON.stringify(body));
}

function config() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
      /\/$/,
      "",
    ),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
  };
}

function asLibraryItem(row, supabaseUrl) {
  const publicUrl =
    row.public_url ||
    (row.storage_bucket === "kiro-library-public" && row.storage_path
      ? `${supabaseUrl}/storage/v1/object/public/${row.storage_bucket}/${encodeURI(
          row.storage_path,
        )}`
      : "");

  return {
    id: `kiro:${row.id}`,
    name: row.name,
    type: row.media_type,
    path: publicUrl,
    duration: row.duration == null ? undefined : Number(row.duration),
    thumbnail: row.thumbnail_url || undefined,
    source: "kiro",
    tier: row.tier,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    collection: row.collection || undefined,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Método não permitido." });
  }

  const scope = String(req.query?.scope || "public");
  if (scope !== "public") {
    return send(res, 403, {
      error: "Este catálogo não está disponível neste acesso.",
    });
  }

  const { url, serviceKey } = config();
  if (!url || !serviceKey) {
    return send(res, 200, {
      version: 1,
      scope: "public",
      categories,
      items: [],
      backend: "unconfigured",
    });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/kiro_library_assets?visibility=eq.public&status=eq.published&select=id,name,media_type,category,tier,storage_bucket,storage_path,public_url,thumbnail_url,duration,tags,collection&order=updated_at.desc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    const rows = await response.json().catch(() => null);
    if (!response.ok) {
      return send(res, 502, {
        error: rows?.message || "A KIRO Library está temporariamente indisponível.",
      });
    }

    const items = Array.isArray(rows)
      ? rows.map((row) => asLibraryItem(row, url)).filter((item) => item.path)
      : [];

    return send(res, 200, {
      version: 1,
      scope: "public",
      categories,
      items,
    });
  } catch (error) {
    return send(res, 502, {
      error:
        error instanceof Error
          ? `Falha ao abrir a KIRO Library: ${error.message}`
          : "A KIRO Library está temporariamente indisponível.",
    });
  }
}
