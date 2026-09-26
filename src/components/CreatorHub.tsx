import {
  Bot,
  Boxes,
  Image as ImageIcon,
  Library,
  Link2,
  PlugZap,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { KiroProject } from "../editor/types";
import {
  connectorRegistry,
  editorPermissionCatalog,
  type ConnectorDefinition,
} from "../editor/connectors";
import KiroAiPanel from "./KiroAiPanel";

type HubTab = "chat" | "generate" | "agents" | "connections" | "library";

interface Props {
  project: KiroProject;
  currentTime: number;
  selectedClipId?: string;
  onApplyProject: (project: KiroProject, message: string) => void;
  onClose: () => void;
}

function statusLabel(connector: ConnectorDefinition) {
  if (connector.status === "ready") return "Disponível";
  if (connector.status === "provider-dependent") return "Aguardando conexão do provedor";
  return "Em preparação";
}

export default function CreatorHub({
  project,
  currentTime,
  selectedClipId,
  onApplyProject,
  onClose,
}: Props) {
  const [tab, setTab] = useState<HubTab>("chat");
  const selectedClip = useMemo(
    () =>
      project.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === selectedClipId),
    [project, selectedClipId],
  );

  return (
    <div className="creator-hub-shell">
      <header className="creator-hub-topbar">
        <div>
          <span className="creator-hub-kicker">KIRO EDITOR</span>
          <h1>Creator Hub</h1>
          <p>
            Converse, gere mídia e conecte ferramentas sem sair do fluxo de criação.
          </p>
        </div>
        <button onClick={onClose} className="creator-hub-close">
          <X size={18} /> Voltar ao editor
        </button>
      </header>

      <nav className="creator-hub-tabs" aria-label="Creator Hub">
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          <Bot size={17} /> Chat
        </button>
        <button className={tab === "generate" ? "active" : ""} onClick={() => setTab("generate")}>
          <WandSparkles size={17} /> Gerar
        </button>
        <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
          <Boxes size={17} /> Agentes
        </button>
        <button className={tab === "connections" ? "active" : ""} onClick={() => setTab("connections")}>
          <PlugZap size={17} /> Conexões
        </button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>
          <Library size={17} /> Biblioteca
        </button>
      </nav>

      <main className="creator-hub-main">
        {tab === "chat" && (
          <section className="creator-hub-chat-grid">
            <div className="creator-hub-context-card">
              <span className="creator-hub-kicker">CONTEXTO ATUAL</span>
              <strong>{project.name}</strong>
              <span>{project.tracks.length} trilhas</span>
              <span>
                {project.tracks.reduce((count, track) => count + track.clips.length, 0)} clipes
              </span>
              <span>Agulha em {currentTime.toFixed(1)} s</span>
              <span>{selectedClip ? `Selecionado: ${selectedClip.name}` : "Nenhum clipe selecionado"}</span>
            </div>
            <KiroAiPanel
              project={project}
              currentTime={currentTime}
              selectedClipId={selectedClipId}
              onApply={onApplyProject}
              onClose={() => setTab("connections")}
            />
          </section>
        )}

        {tab === "generate" && (
          <section className="creator-hub-section">
            <div className="creator-hub-section-heading">
              <div>
                <span className="creator-hub-kicker">GERAÇÃO</span>
                <h2>Crie mídia com o provedor que você conectar</h2>
              </div>
              <Sparkles size={23} />
            </div>
            <div className="creator-hub-card-grid">
              <article className="creator-hub-feature-card">
                <ImageIcon size={23} />
                <strong>Imagem</strong>
                <p>Prompt, referência, edição e envio direto para a KIRO Library.</p>
                <small>Disponível quando um conector com image.generate estiver autenticado.</small>
              </article>
              <article className="creator-hub-feature-card">
                <Video size={23} />
                <strong>Vídeo</strong>
                <p>Texto para vídeo, imagem para vídeo e edição por IA quando o provedor suportar.</p>
                <small>Projetado para Grok/xAI e outros conectores compatíveis.</small>
              </article>
              <article className="creator-hub-feature-card">
                <Link2 size={23} />
                <strong>Adicionar ao projeto</strong>
                <p>O resultado poderá ir para a Library ou entrar diretamente na timeline.</p>
                <small>Nenhum upload externo é executado enquanto a conexão não estiver ativa.</small>
              </article>
            </div>
          </section>
        )}

        {tab === "agents" && (
          <section className="creator-hub-section">
            <div className="creator-hub-section-heading">
              <div>
                <span className="creator-hub-kicker">AGENTES</span>
                <h2>Um mesmo motor de edição para diferentes IAs</h2>
              </div>
              <Boxes size={23} />
            </div>
            <div className="creator-hub-card-grid">
              {connectorRegistry
                .filter((connector) => connector.capabilities.includes("agent"))
                .map((connector) => (
                  <article className="creator-hub-feature-card" key={connector.id}>
                    <Bot size={22} />
                    <strong>{connector.name}</strong>
                    <p>{connector.description}</p>
                    <small>{statusLabel(connector)}</small>
                  </article>
                ))}
            </div>
          </section>
        )}

        {tab === "connections" && (
          <section className="creator-hub-section">
            <div className="creator-hub-section-heading">
              <div>
                <span className="creator-hub-kicker">CONEXÕES</span>
                <h2>Conecte suas próprias ferramentas</h2>
                <p>OAuth e MCP serão preferidos. Chave manual fica somente como fallback.</p>
              </div>
              <PlugZap size={23} />
            </div>
            <div className="creator-hub-connectors">
              {connectorRegistry.map((connector) => (
                <article className="creator-hub-connector" key={connector.id}>
                  <div>
                    <strong>{connector.name}</strong>
                    <span>{connector.description}</span>
                  </div>
                  <div className="creator-hub-badges">
                    {connector.authModes.map((mode) => (
                      <span key={mode}>{mode.toUpperCase()}</span>
                    ))}
                  </div>
                  <div className="creator-hub-connector-footer">
                    <small>{statusLabel(connector)}</small>
                    <button disabled={connector.status !== "ready" || !connector.userConnectable}>
                      {connector.userConnectable ? "Conectar" : "Gerenciado pela KIRO"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="creator-hub-permissions">
              <span className="creator-hub-kicker">PERMISSÕES DO EDITOR</span>
              {editorPermissionCatalog.map((permission) => (
                <div key={permission.id}>
                  <strong>{permission.label}</strong>
                  <span>{permission.description}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "library" && (
          <section className="creator-hub-section">
            <div className="creator-hub-section-heading">
              <div>
                <span className="creator-hub-kicker">KIRO LIBRARY</span>
                <h2>Uma saída comum para tudo que for criado</h2>
              </div>
              <Library size={23} />
            </div>
            <div className="creator-hub-library-flow">
              <span>IA conectada</span>
              <b>→</b>
              <span>Gera imagem / vídeo / áudio</span>
              <b>→</b>
              <span>KIRO Library</span>
              <b>→</b>
              <span>Timeline</span>
            </div>
            <p className="creator-hub-muted">
              A biblioteca continuará separando arquivos do usuário, conteúdo público e acervo interno da KIRO Produções.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
