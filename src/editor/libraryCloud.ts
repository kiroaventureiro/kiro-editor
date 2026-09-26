export type LibraryVisibility = "public" | "internal";
export type LibraryStatus = "draft" | "published" | "archived";

export interface LibraryAdminSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: {
    id: string;
    email?: string;
  };
}

export interface LibraryAdminAsset {
  id: string;
  name: string;
  media_type: "video" | "audio" | "image";
  category: "video" | "image" | "audio" | "overlay" | "template";
  tier: "free" | "plus";
  visibility: LibraryVisibility;
  status: LibraryStatus;
  storage_bucket: string;
  storage_path: string;
  public_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  tags: string[];
  collection?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NewLibraryAsset {
  name: string;
  mediaType: "video" | "audio" | "image";
  category: "video" | "image" | "audio" | "overlay" | "template";
  tier: "free" | "plus";
  visibility: LibraryVisibility;
  status: LibraryStatus;
  storageBucket: string;
  storagePath: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  tags: string[];
  collection?: string;
}

const SESSION_KEY = "kiro-editor-library-admin-session-v1";

function cloudConfig() {
  const env =
    (import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }).env ?? {};
  const url = String(env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = String(env.VITE_SUPABASE_ANON_KEY ?? "");
  return { url, key, ready: Boolean(url && key) };
}

export function libraryCloudConfigured() {
  return cloudConfig().ready;
}

export function loadLibraryAdminSession(): LibraryAdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LibraryAdminSession;
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    if (parsed.expiresAt && Date.now() / 1000 > parsed.expiresAt - 30) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeSession(session: LibraryAdminSession | null) {
  if (typeof window === "undefined") return;
  if (!session) window.sessionStorage.removeItem(SESSION_KEY);
  else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function signInLibraryAdmin(email: string, password: string) {
  const { url, key, ready } = cloudConfig();
  if (!ready)
    throw new Error("Supabase ainda não está configurado neste ambiente.");

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error_description || body?.msg || "Falha ao entrar no Admin.");

  const session: LibraryAdminSession = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at,
    user: {
      id: body.user?.id,
      email: body.user?.email,
    },
  };
  if (!session.user.id) throw new Error("A autenticação não retornou um usuário válido.");

  await listLibraryAdminAssets(session.accessToken);
  storeSession(session);
  return session;
}

export async function signOutLibraryAdmin(session?: LibraryAdminSession | null) {
  const current = session ?? loadLibraryAdminSession();
  const { url, key, ready } = cloudConfig();
  storeSession(null);
  if (!current || !ready) return;
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${current.accessToken}`,
    },
  }).catch(() => {});
}

async function adminRequest<T>(
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
  id?: string,
): Promise<T> {
  const query = id ? `?id=${encodeURIComponent(id)}` : "";
  const response = await fetch(`/api/library-admin${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.error || "Não foi possível acessar o Admin da KIRO Library.");
  return payload as T;
}

export async function listLibraryAdminAssets(token: string) {
  const result = await adminRequest<{ items: LibraryAdminAsset[] }>(token, "GET");
  return result.items ?? [];
}

export async function createLibraryAdminAsset(
  token: string,
  asset: NewLibraryAsset,
) {
  const result = await adminRequest<{ item: LibraryAdminAsset }>(
    token,
    "POST",
    asset,
  );
  return result.item;
}

export async function updateLibraryAdminAsset(
  token: string,
  id: string,
  patch: Partial<{
    name: string;
    category: LibraryAdminAsset["category"];
    tier: LibraryAdminAsset["tier"];
    status: LibraryStatus;
    tags: string[];
    collection: string;
  }>,
) {
  const result = await adminRequest<{ item: LibraryAdminAsset }>(
    token,
    "PATCH",
    patch,
    id,
  );
  return result.item;
}

export async function archiveLibraryAdminAsset(token: string, id: string) {
  const result = await adminRequest<{ item: LibraryAdminAsset }>(
    token,
    "DELETE",
    undefined,
    id,
  );
  return result.item;
}

function safeFileName(value: string) {
  const dot = value.lastIndexOf(".");
  const extension = dot >= 0 ? value.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const stem = (dot >= 0 ? value.slice(0, dot) : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "asset";
  return `${stem}${extension}`;
}

export async function uploadLibraryAsset(
  file: File,
  visibility: LibraryVisibility,
  token: string,
) {
  const { url, key, ready } = cloudConfig();
  if (!ready)
    throw new Error("Supabase ainda não está configurado neste ambiente.");

  const bucket =
    visibility === "public" ? "kiro-library-public" : "kiro-library-internal";
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `${month}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const response = await fetch(
    `${url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.message || body?.error || "Falha ao enviar o arquivo para a nuvem.");

  return {
    bucket,
    storagePath,
    publicUrl:
      visibility === "public"
        ? `${url}/storage/v1/object/public/${bucket}/${encodeURI(storagePath)}`
        : undefined,
  };
}
