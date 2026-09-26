import { Bot, Check, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { applyKiroAiCommands, type KiroAiCommand } from "../editor/aiCommands";
import type { KiroProject } from "../editor/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  detail?: string;
};

interface Props {
  project: KiroProject;
  currentTime: number;
  selectedClipId?: string;
  onApply: (project: KiroProject, message: string) => void;
  onClose: () => void;
}

function projectContext(project: KiroProject, currentTime: number, selectedClipId?: string) {
  return {
    id: project.id,
    name: project.name,
    settings: project.settings,
    currentTime,
    selectedClipId,
    tracks: project.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      muted: track.muted,
      locked: track.locked,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        assetId: clip.assetId,
        name: clip.name,
        type: clip.type,
        start: clip.start,
        duration: clip.duration,
        text: clip.text,
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

export default function KiroAiPanel({
  project,
  currentTime,
  selectedClipId,
  onApply,
  onClose,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Estou conectado ao projeto aberto. Você pode pedir cortes, ajustes de áudio, texto, posição, velocidade e outras ações que o editor já suporta.",
    },
  ]);
  const selected = useMemo(
    () =>
      project.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === selectedClipId),
    [project, selectedClipId],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: "user", text },
    ]);

    try {
      const response = await fetch("/api/kiro-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          project: projectContext(project, currentTime, selectedClipId),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Não foi possível consultar a KIRO IA.");

      const commands = Array.isArray(body.actions) ? (body.actions as KiroAiCommand[]) : [];
      if (!commands.length) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: body.reply || "Não encontrei uma alteração segura para aplicar.",
          },
        ]);
        return;
      }

      const result = applyKiroAiCommands(project, commands);
      const detail = result.rejected.length
        ? `${result.applied} aplicada(s) · ${result.rejected.length} rejeitada(s) por segurança.`
        : `${result.applied} alteração(ões) aplicada(s).`;
      if (result.applied) {
        onApply(result.project, body.summary || body.reply || "Alterações da KIRO IA");
      }
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: body.reply || body.summary || "Edição concluída.",
          detail,
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Falha inesperada na KIRO IA.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="kiro-ai-panel" aria-label="KIRO IA">
      <header className="kiro-ai-heading">
        <div>
          <span className="kiro-ai-icon"><Sparkles size={16} /></span>
          <div>
            <strong>KIRO IA</strong>
            <small>{selected ? `Selecionado: ${selected.name}` : "Projeto inteiro disponível"}</small>
          </div>
        </div>
        <button aria-label="Fechar KIRO IA" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="kiro-ai-messages">
        {messages.map((message) => (
          <div key={message.id} className={`kiro-ai-message ${message.role}`}>
            <span className="kiro-ai-avatar">
              {message.role === "assistant" ? <Bot size={15} /> : <span>Você</span>}
            </span>
            <div>
              <p>{message.text}</p>
              {message.detail && <small><Check size={13} /> {message.detail}</small>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="kiro-ai-message assistant pending">
            <span className="kiro-ai-avatar"><Bot size={15} /></span>
            <div><p><LoaderCircle className="spin" size={15} /> Analisando a timeline…</p></div>
          </div>
        )}
      </div>

      <div className="kiro-ai-context">
        <span>{project.tracks.length} trilhas</span>
        <span>{project.tracks.reduce((n, track) => n + track.clips.length, 0)} clipes</span>
        <span>{currentTime.toFixed(1)} s</span>
      </div>

      <div className="kiro-ai-compose">
        <textarea
          value={input}
          maxLength={4000}
          rows={3}
          placeholder="Ex.: corte o clipe selecionado aqui, abaixe o volume para 70% e deixe a legenda maior."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button className="primary" onClick={() => void send()} disabled={!input.trim() || sending}>
          {sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
          Enviar
        </button>
      </div>
    </aside>
  );
}
