import {
  Archive,
  CloudUpload,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  archiveLibraryAdminAsset,
  createLibraryAdminAsset,
  libraryCloudConfigured,
  listLibraryAdminAssets,
  loadLibraryAdminSession,
  signInLibraryAdmin,
  signOutLibraryAdmin,
  updateLibraryAdminAsset,
  uploadLibraryAsset,
  type LibraryAdminAsset,
  type LibraryAdminSession,
  type LibraryStatus,
  type LibraryVisibility,
} from "../editor/libraryCloud";

interface Props {
  onClose: () => void;
}

type MediaType = "video" | "audio" | "image";
type Category = "video" | "image" | "audio" | "overlay" | "template";

type FormState = {
  name: string;
  category: Category;
  tier: "free" | "plus";
  visibility: LibraryVisibility;
  status: LibraryStatus;
  collection: string;
  tags: string;
};

const initialForm: FormState = {
  name: "",
  category: "video",
  tier: "free",
  visibility: "internal",
  status: "draft",
  collection: "",
  tags: "",
};

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "video";
}

function categoryForMedia(type: MediaType): Category {
  if (type === "audio") return "audio";
  if (type === "image") return "image";
  return "video";
}

function prettyStatus(asset: LibraryAdminAsset) {
  const visibility = asset.visibility === "public" ? "Público" : "Interno";
  const status =
    asset.status === "published"
      ? "Publicado"
      : asset.status === "archived"
        ? "Arquivado"
        : "Rascunho";
  return `${visibility} · ${status}`;
}

export default function LibraryAdmin({ onClose }: Props) {
  const [session, setSession] = useState<LibraryAdminSession | null>(() =>
    loadLibraryAdminSession(),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assets, setAssets] = useState<LibraryAdminAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const configured = libraryCloudConfigured();

  const visibleAssets = useMemo(
    () =>
      [...assets].sort((a, b) =>
        String(b.updated_at ?? b.created_at ?? "").localeCompare(
          String(a.updated_at ?? a.created_at ?? ""),
        ),
      ),
    [assets],
  );

  const reload = async (activeSession = session) => {
    if (!activeSession) return;
    setLoading(true);
    setNotice("");
    try {
      setAssets(await listLibraryAdminAssets(activeSession.accessToken));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) void reload(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    setLoading(true);
    setNotice("");
    try {
      const next = await signInLibraryAdmin(email.trim(), password);
      setSession(next);
      setPassword("");
      setAssets(await listLibraryAdminAssets(next.accessToken));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao entrar no Admin.");
    } finally {
      setLoading(false);
    }
  };

  const chooseFile = (next: File | null) => {
    setFile(next);
    if (!next) return;
    const mediaType = detectMediaType(next);
    setForm((current) => ({
      ...current,
      name: current.name || next.name.replace(/\.[^.]+$/, ""),
      category: categoryForMedia(mediaType),
    }));
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !file) {
      setNotice("Escolha um arquivo antes de salvar o asset.");
      return;
    }

    setLoading(true);
    setNotice("Enviando o arquivo para a nuvem…");
    try {
      const mediaType = detectMediaType(file);
      const upload = await uploadLibraryAsset(
        file,
        form.visibility,
        session.accessToken,
      );
      const item = await createLibraryAdminAsset(session.accessToken, {
        name: form.name.trim() || file.name,
        mediaType,
        category: form.category,
        tier: form.tier,
        visibility: form.visibility,
        status: form.status,
        storageBucket: upload.bucket,
        storagePath: upload.storagePath,
        publicUrl: upload.publicUrl,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        collection: form.collection.trim() || undefined,
      });
      setAssets((current) => [item, ...current]);
      setFile(null);
      setForm(initialForm);
      setNotice(
        item.visibility === "public" && item.status === "published"
          ? "Asset publicado e liberado na KIRO Library."
          : "Asset salvo no acervo da KIRO Produções.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao salvar o asset.");
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (
    asset: LibraryAdminAsset,
    patch: Partial<{
      status: LibraryStatus;
      visibility: LibraryVisibility;
    }>,
  ) => {
    if (!session) return;
    setLoading(true);
    setNotice("");
    try {
      const updated = await updateLibraryAdminAsset(
        session.accessToken,
        asset.id,
        patch,
      );
      setAssets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Asset atualizado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao atualizar o asset.");
    } finally {
      setLoading(false);
    }
  };

  const archive = async (asset: LibraryAdminAsset) => {
    if (!session) return;
    setLoading(true);
    setNotice("");
    try {
      const updated = await archiveLibraryAdminAsset(
        session.accessToken,
        asset.id,
      );
      setAssets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Asset arquivado. O arquivo não foi apagado da nuvem.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao arquivar o asset.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOutLibraryAdmin(session);
    setSession(null);
    setAssets([]);
  };

  return (
    <div className="library-admin-shell">
      <header className="library-admin-topbar">
        <div>
          <span className="eyebrow">KIRO PRODUÇÕES</span>
          <h1>KIRO Library Admin</h1>
          <p>Publicação e controle do acervo do KIRO Editor.</p>
        </div>
        <div className="library-admin-top-actions">
          {session && (
            <button onClick={() => void logout()}>
              <LogOut size={16} /> Sair
            </button>
          )}
          <button aria-label="Voltar ao editor" onClick={onClose}>
            <X size={18} /> Voltar ao editor
          </button>
        </div>
      </header>

      {!configured && (
        <section className="library-admin-card warning-card">
          <ShieldCheck size={24} />
          <div>
            <strong>Backend ainda não conectado neste deploy</strong>
            <p>
              O painel está pronto, mas precisa das variáveis do Supabase e da
              migration da KIRO Library aplicada para autenticar e armazenar arquivos.
            </p>
          </div>
        </section>
      )}

      {!session ? (
        <main className="library-admin-login-wrap">
          <form className="library-admin-card library-admin-login" onSubmit={login}>
            <ShieldCheck size={30} />
            <h2>Acesso administrativo</h2>
            <p>
              Use uma conta que tenha a role <strong>admin</strong> no Supabase.
            </p>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="primary" disabled={!configured || loading}>
              {loading ? "Entrando…" : "Entrar no Admin"}
            </button>
            {notice && <p className="library-admin-notice">{notice}</p>}
          </form>
        </main>
      ) : (
        <main className="library-admin-main">
          <section className="library-admin-card library-admin-upload-card">
            <div className="library-admin-section-heading">
              <div>
                <span className="eyebrow">NOVO ASSET</span>
                <h2>Adicionar à biblioteca</h2>
              </div>
              <CloudUpload size={24} />
            </div>

            <form onSubmit={publish} className="library-admin-form">
              <label className="library-admin-file">
                Arquivo
                <input
                  type="file"
                  accept="video/*,audio/*,image/*"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                  required
                />
                <small>{file ? file.name : "Vídeo, áudio ou imagem"}</small>
              </label>

              <label>
                Nome
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>

              <div className="library-admin-form-grid">
                <label>
                  Categoria
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as Category,
                      }))
                    }
                  >
                    <option value="video">Vídeo</option>
                    <option value="image">Imagem</option>
                    <option value="audio">Áudio</option>
                    <option value="overlay">Overlay</option>
                    <option value="template">Template</option>
                  </select>
                </label>
                <label>
                  Plano
                  <select
                    value={form.tier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tier: event.target.value as "free" | "plus",
                      }))
                    }
                  >
                    <option value="free">Free</option>
                    <option value="plus">Plus</option>
                  </select>
                </label>
                <label>
                  Acesso
                  <select
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        visibility: event.target.value as LibraryVisibility,
                      }))
                    }
                  >
                    <option value="internal">Interno · KIRO Produções</option>
                    <option value="public">Público · usuários do editor</option>
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as LibraryStatus,
                      }))
                    }
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicado</option>
                  </select>
                </label>
              </div>

              <label>
                Coleção
                <input
                  placeholder="Ex.: Guardiões da Origem"
                  value={form.collection}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      collection: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Tags
                <input
                  placeholder="portal, roxo, overlay"
                  value={form.tags}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tags: event.target.value }))
                  }
                />
              </label>

              <button className="primary" disabled={loading || !file}>
                <CloudUpload size={16} />
                {loading ? "Salvando…" : "Enviar e salvar asset"}
              </button>
            </form>
          </section>

          <section className="library-admin-card library-admin-catalog-card">
            <div className="library-admin-section-heading">
              <div>
                <span className="eyebrow">ACERVO</span>
                <h2>{assets.length} assets cadastrados</h2>
              </div>
              <button onClick={() => void reload()} disabled={loading}>
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>

            {notice && <p className="library-admin-notice">{notice}</p>}

            <div className="library-admin-assets">
              {visibleAssets.map((asset) => (
                <article key={asset.id} className="library-admin-asset-row">
                  <div>
                    <strong>{asset.name}</strong>
                    <span>
                      {asset.category} · {asset.tier.toUpperCase()} · {prettyStatus(asset)}
                    </span>
                    {asset.collection && <small>{asset.collection}</small>}
                  </div>
                  <div className="library-admin-asset-actions">
                    {asset.status !== "published" && (
                      <button
                        disabled={loading}
                        onClick={() =>
                          void changeStatus(asset, { status: "published" })
                        }
                      >
                        Publicar
                      </button>
                    )}
                    {asset.status === "published" && (
                      <button
                        disabled={loading}
                        onClick={() => void changeStatus(asset, { status: "draft" })}
                      >
                        Voltar a rascunho
                      </button>
                    )}
                    <button
                      disabled={loading}
                      onClick={() =>
                        void changeStatus(asset, {
                          visibility:
                            asset.visibility === "public" ? "internal" : "public",
                        })
                      }
                    >
                      {asset.visibility === "public" ? "Tornar interno" : "Tornar público"}
                    </button>
                    <button
                      disabled={loading || asset.status === "archived"}
                      onClick={() => void archive(asset)}
                    >
                      <Archive size={14} /> Arquivar
                    </button>
                  </div>
                </article>
              ))}
              {!visibleAssets.length && !loading && (
                <div className="library-admin-empty">
                  Nenhum asset cadastrado ainda.
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
