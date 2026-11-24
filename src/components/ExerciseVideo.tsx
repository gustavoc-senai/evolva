import { ExternalLink, Play } from "lucide-react";
import { videoUrl } from "../lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ExerciseVideo({
  url,
  name,
  path,
}: {
  url?: string | null;
  name: string;
  path?: string | null;
}) {
  const [signed, setSigned] = useState({ path: "", url: "" });
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!path || !opened) return;
    let active = true;
    async function resolve() {
      const { data, error } = await supabase.storage
        .from("evolva-videos")
        .createSignedUrl(path!, 900);
      if (active) {
        setSigned({ path: path!, url: error ? "" : data?.signedUrl || "" });
        setFailed(Boolean(error || !data?.signedUrl));
      }
    }
    void resolve().catch(() => active && setFailed(true));
    const interval = setInterval(
      () => void resolve().catch(() => active && setFailed(true)),
      12 * 60 * 1000,
    );
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [path, opened]);
  const safe = path
    ? signed.path === path
      ? signed.url
      : ""
    : videoUrl(url ?? null);
  if (path && !safe)
    return (
      <details
        className="exercise-video"
        onToggle={(event) => setOpened(event.currentTarget.open)}
      >
        <summary>
          <Play size={17} />
          Ver demonstração <span>· {name}</span>
        </summary>
        <div className="exercise-video-body" role="status">
          {failed
            ? "Não foi possível carregar o vídeo. Confira a conexão e tente novamente."
            : "Carregando vídeo privado..."}
          {failed && (
            <button
              type="button"
              className="secondary small"
              onClick={() => {
                setFailed(false);
                setOpened(false);
                setTimeout(() => setOpened(true), 0);
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      </details>
    );
  if (!safe) return null;
  const parsed = new URL(safe);
  let embed: string | null = null;
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
      parsed.hostname,
    )
  ) {
    const id =
      parsed.hostname === "youtu.be"
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get("v") ||
          parsed.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
      embed = `https://www.youtube-nocookie.com/embed/${id}`;
  }
  const direct =
    Boolean(path) || /\.(mp4|webm|ogv|mov)$/i.test(parsed.pathname);
  return (
    <details
      className="exercise-video"
      open={path ? opened : undefined}
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>
        <Play size={17} />
        Ver demonstração <span>· {name}</span>
      </summary>
      <div className="exercise-video-body">
        {embed ? (
          <iframe
            src={embed}
            title={`Demonstração de ${name}`}
            loading="lazy"
            allow="fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : direct ? (
          <video
            controls
            preload="none"
            src={safe}
            aria-label={`Demonstração de ${name}`}
          />
        ) : (
          <p>Abra o vídeo enviado pelo professor para conferir a execução.</p>
        )}
        <a href={safe} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} />
          Abrir vídeo em outra aba
        </a>
        {(embed || direct) && (
          <small className="muted">
            Se o vídeo não carregar aqui, abra em outra aba.
          </small>
        )}
      </div>
    </details>
  );
}
