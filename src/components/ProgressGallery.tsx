import { useEffect, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { useRows } from "../lib/hooks";
import { rpc, supabase } from "../lib/supabase";
import { useWorkspace } from "../contexts/Workspace";
import { useAuth } from "../contexts/Auth";
import { date, errorText } from "../lib/utils";
import { Feedback, Empty } from "./UI";
export default function ProgressGallery({ studentId }: { studentId: string }) {
  const { access } = useWorkspace(),
    { user } = useAuth();
  const assets = useRows<any>("evolva_assets", { student_id: studentId });
  const [urls, setUrls] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [compare,setCompare]=useState(false);
  const [left,setLeft]=useState(""),[right,setRight]=useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const entries = await Promise.all(
        assets.rows.map(async (a) => {
          const { data } = await supabase.storage
            .from("evolva-progress")
            .createSignedUrl(a.path, 900);
          return [a.id, data?.signedUrl ?? ""];
        }),
      );
      if (active) setUrls(Object.fromEntries(entries));
    }
    void load();
    const timer = setInterval(() => void load(), 12 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [assets.rows]);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw Error("Use JPEG, PNG ou WebP de até 5 MB.");
      const extension =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
            ? "png"
            : "webp";
      const path = `${access?.workspace.id}/${studentId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("evolva-progress")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      await rpc("evolva_register_asset", {
        p_student: studentId,
        p_path: path,
        p_title: file.name.slice(0, 150),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">REGISTROS VISUAIS</span>
          <h2>Fotos do acompanhamento</h2>
        </div>
        <label className="button secondary file-button">
          <Upload size={16} />
          {busy ? "Enviando..." : "Adicionar foto"}
          <input
            aria-label="Enviar foto de evolução"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <Feedback error={error || assets.error} />
      <p className="muted small">
        Arquivos privados, acessíveis ao aluno vinculado e ao personal. Envie
        apenas imagens pertinentes ao acompanhamento.
      </p>
      {assets.rows.length>=2&&<button className="secondary small" onClick={()=>setCompare(!compare)}>{compare?"Fechar comparação":"Comparar fotos"}</button>}
      {compare&&assets.rows.length>=2&&<div className="photo-comparison">{[0,1].map(side=>{const selected=assets.rows.find(asset=>asset.id===(side===0?left:right))||assets.rows[side===0?0:assets.rows.length-1];return <div key={side}><label>{side===0?"Primeira foto":"Segunda foto"}<select value={selected.id} onChange={event=>side===0?setLeft(event.target.value):setRight(event.target.value)}>{assets.rows.map(asset=><option key={asset.id} value={asset.id}>{date(asset.created_at)} · {asset.title}</option>)}</select></label>{urls[selected.id]?<img src={urls[selected.id]} alt={`${selected.title} · ${date(selected.created_at)}`}/>:<p className="muted">Carregando foto privada...</p>}</div>;})}</div>}
      {assets.rows.length ? (
        <div className="photo-grid">
          {assets.rows.map((a) => (
            <article key={a.id}>
              <a
                href={urls[a.id] || undefined}
                target="_blank"
                rel="noreferrer"
              >
                {urls[a.id] ? (
                  <img src={urls[a.id]} alt={a.title} loading="lazy" />
                ) : (
                  <Camera size={28} />
                )}
              </a>
              <div>
                <span>
                  <strong>{a.title}</strong>
                  <small>{date(a.created_at)}</small>
                </span>
                {(access?.role === "TRAINER" || a.uploaded_by === user?.id) && (
                  <button
                    className="icon secondary"
                    aria-label={"Remover " + a.title}
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm("Remover esta foto definitivamente?"))
                        return;
                      setBusy(true);
                      try {
                        const { error } = await supabase.storage
                          .from("evolva-progress")
                          .remove([a.path]);
                        if (error) throw error;
                        await rpc("evolva_unregister_asset", { p_asset: a.id });
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Uma evolução também pode ser visual">
          Adicione fotos para manter o histórico do acompanhamento.
        </Empty>
      )}
    </section>
  );
}
