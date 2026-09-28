import { CircleDot, RotateCcw } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Clip } from "../editor/types";

interface Props {
  clip?: Clip;
  disabled?: boolean;
  onChange: (patch: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

export default function ColorWheelControl({
  clip,
  disabled,
  onChange,
  onBegin,
  onEnd,
}: Props) {
  const unavailable =
    !clip || clip.type === "text" || clip.type === "audio" || !!disabled;
  const hue = Math.round(Math.max(-180, Math.min(180, clip?.hueRotate ?? 0)));

  const setFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const fromTop = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const normalized = ((fromTop % 360) + 360) % 360;
    onChange({ hueRotate: Math.round(normalized > 180 ? normalized - 360 : normalized) });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (unavailable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onBegin();
    setFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!unavailable && event.currentTarget.hasPointerCapture(event.pointerId))
      setFromPointer(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (unavailable) return;
    let next = hue;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 5;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 5;
    else if (event.key === "Home") next = 0;
    else return;
    event.preventDefault();
    onBegin();
    onChange({ hueRotate: Math.max(-180, Math.min(180, next)) });
  };

  const reset = () => {
    if (unavailable || hue === 0) return;
    onBegin();
    onChange({ hueRotate: 0 });
    onEnd();
  };

  return (
    <div className={`color-wheel-control ${unavailable ? "is-disabled" : ""}`}>
      <div
        className="color-wheel"
        role="slider"
        aria-label="Matiz da imagem"
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={hue}
        aria-valuetext={`${hue} graus`}
        aria-disabled={unavailable}
        tabIndex={unavailable ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home") onEnd();
        }}
        onBlur={onEnd}
      >
        <span
          className="color-wheel-marker"
          style={{ transform: `translate(-50%, -50%) rotate(${hue}deg) translateY(-31px)` }}
        />
        <span className="color-wheel-center" aria-hidden="true">
          <small>MATIZ</small>
          <strong>{hue}°</strong>
        </span>
      </div>
      <div className="color-wheel-copy">
        <div className="color-wheel-title">
          <CircleDot size={14} aria-hidden="true" />
          <strong>Ajuste de cores</strong>
          {clip && <span title={clip.name}>{clip.name}</span>}
        </div>
        <p>
          {unavailable
            ? "Selecione um vídeo ou imagem para liberar a roda de cores."
            : "Arraste o marcador para mudar a matiz. O centro mantém o tom original."}
        </p>
        <button type="button" onClick={reset} disabled={unavailable || hue === 0}>
          <RotateCcw size={12} aria-hidden="true" />
          <span>Restaurar cor</span>
        </button>
      </div>
    </div>
  );
}
