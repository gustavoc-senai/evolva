import { useRef, useState } from "react";
import { useWorkspace } from "../contexts/Workspace";
import { rpc, supabase } from "../lib/supabase";
import { videoUrl } from "../lib/utils";
import type { Exercise } from "../lib/types";
import ExerciseVideo from "./ExerciseVideo";
import { Modal, ActionForm, Field, value } from "./UI";
export default function ExerciseEditor({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { access } = useWorkspace();
  const [edit, setEdit] = useState(exercise);
  const [videoDraft, setVideoDraft] = useState(exercise?.video_url || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const savedId = useRef("");
  return (
    <Modal
      title={edit?.id ? "Editar exercício" : "Adicionar exercício"}
      onClose={onClose}
    >
      <ActionForm
        onSuccess={() => {
          onSaved?.(savedId.current);
          onClose();
        }}
        onSubmit={async (d) => {
          const video = value(d, "video");
          if (video && !videoUrl(video))
            throw Error(
              "Informe um link de vídeo válido começando com https://.",
            );
          const initial = Boolean(edit?.id && !edit.workspace_id);
          const saved = await (initial
            ? rpc("evolva_customize_exercise", {
                p_workspace: access?.workspace.id,
                p_source: edit!.id,
                p_name: value(d, "name"),
                p_muscle: value(d, "muscle"),
                p_equipment: value(d, "equipment"),
                p_instructions: value(d, "instructions") || null,
                p_video: video || null,
                p_active: value(d, "active") === "true",
              }).catch((error) => {
                if (error?.code === "PGRST202")
                  throw Error(
                    "Falta atualizar o banco para editar exercícios iniciais. Execute sql/010_edicao_exercicios.sql inteiro no SQL Editor do Supabase.",
                  );
                throw error;
              })
            : edit?.id
              ? rpc("evolva_save_exercise", {
                  p_exercise: edit.id,
                  p_name: value(d, "name"),
                  p_muscle: value(d, "muscle"),
                  p_equipment: value(d, "equipment"),
                  p_instructions: value(d, "instructions") || null,
                  p_video: value(d, "video") || null,
                  p_active: value(d, "active") === "true",
                })
              : rpc("evolva_add_exercise", {
                  p_workspace: access?.workspace.id,
                  p_name: value(d, "name"),
                  p_muscle: value(d, "muscle"),
                  p_equipment: value(d, "equipment"),
                  p_instructions: value(d, "instructions") || null,
                  p_video: value(d, "video") || null,
                }));
          const exerciseId = initial ? saved : edit?.id || saved;
          savedId.current = String(exerciseId);
          if ((!edit?.id || initial) && videoFile)
            setEdit({
              id: String(exerciseId),
              workspace_id: access?.workspace.id || null,
              name: value(d, "name"),
              muscle_group: value(d, "muscle"),
              equipment: value(d, "equipment"),
              instructions: value(d, "instructions") || null,
              video_url: video || null,
              video_path: null,
              active: true,
            });
          if (videoFile) {
            const extension =
              videoFile.type === "video/webm"
                ? "webm"
                : videoFile.type === "video/quicktime"
                  ? "mov"
                  : "mp4";
            const path = `${access?.workspace.id}/${crypto.randomUUID()}.${extension}`;
            const uploaded = await supabase.storage
              .from("evolva-videos")
              .upload(path, videoFile, {
                contentType: videoFile.type,
                upsert: false,
              });
            if (uploaded.error)
              throw Error(
                "O exercício foi salvo, mas o vídeo não foi enviado. Confira a instalação do SQL 008 e o limite de 50 MB. Edite o exercício salvo para tentar novamente.",
              );
            try {
              await rpc("evolva_attach_video", {
                p_exercise: exerciseId,
                p_path: path,
              });
            } catch (error) {
              await supabase.storage.from("evolva-videos").remove([path]);
              throw error;
            }
          } else if (edit?.video_path && (removeVideo || video)) {
            await rpc("evolva_attach_video", {
              p_exercise: exerciseId,
              p_path: null,
            });
          }
          if (edit?.video_path && (videoFile || removeVideo || video))
            await supabase.storage
              .from("evolva-videos")
              .remove([edit.video_path]);
        }}
      >
        <Field
          label="Nome do exercício"
          name="name"
          value={edit?.name}
          required
        />
        <div className="form-grid">
          <Field
            label="Grupo muscular"
            name="muscle"
            value={edit?.muscle_group}
            required
          />
          <Field
            label="Equipamento"
            name="equipment"
            value={edit?.equipment ?? "Peso corporal"}
            required
          />
        </div>
        <Field
          name="instructions"
          label="Orientações"
          type="textarea"
          value={edit?.instructions}
          max={3000}
        />
        {edit?.id && (
          <p className="notice">
            {!edit.workspace_id ? (
              "Este exercício é da biblioteca inicial. As alterações serão salvas no seu espaço e aplicadas aos seus treinos e modelos. A biblioteca dos outros professores será preservada."
            ) : (
              <>
                As alterações do exercício, incluindo o vídeo, aparecem também
                nos treinos que já o utilizam. Para criar uma variação separada,
                use Duplicar na biblioteca.
              </>
            )}
          </p>
        )}
        <label>
          Enviar vídeo do exercício (até 50 MB)
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (
                file &&
                (!["video/mp4", "video/webm", "video/quicktime"].includes(
                  file.type,
                ) ||
                  file.size > 50 * 1024 * 1024 ||
                  file.size === 0)
              ) {
                event.target.setCustomValidity(
                  "Use MP4, WebM ou MOV de até 50 MB.",
                );
                setVideoFile(null);
              } else {
                event.target.setCustomValidity("");
                setVideoFile(file || null);
                if (file) {
                  setVideoDraft("");
                  setRemoveVideo(false);
                }
              }
            }}
          />
        </label>
        {videoFile && (
          <p className="notice">
            Selecionado: {videoFile.name} ·{" "}
            {(videoFile.size / 1024 / 1024).toFixed(1)} MB. O envio ocorre ao
            salvar.
          </p>
        )}
        {edit?.video_path && !videoFile && (
          <>
            <ExerciseVideo path={edit.video_path} name={edit.name} />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={removeVideo}
                onChange={(e) => setRemoveVideo(e.target.checked)}
              />
              Remover vídeo enviado
            </label>
          </>
        )}
        <label>
          Link de vídeo (HTTPS)
          <input
            name="video"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoDraft}
            disabled={Boolean(videoFile)}
            onChange={(e) => setVideoDraft(e.target.value)}
          />
        </label>
        {videoDraft && !videoUrl(videoDraft) && (
          <p className="feedback error">
            Use um endereço válido começando com https://.
          </p>
        )}
        <ExerciseVideo
          url={videoDraft}
          name={edit?.name || "Prévia do exercício"}
        />
        <p className="muted small">
          Cole um link do YouTube, de um vídeo MP4/WebM ou de outra plataforma
          HTTPS. O aluno poderá consultar a demonstração no treino e durante as
          séries. Use um link que ele tenha permissão para abrir.
        </p>
        {edit?.id && (
          <Field name="active" label="Situação" value={String(edit.active)}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Field>
        )}
      </ActionForm>
    </Modal>
  );
}
