import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Activity, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, today } from "../lib/utils";
import {
  Heading,
  Feedback,
  Empty,
  Loading,
  Modal,
  ActionForm,
  Field,
  value,
  numberOrNull,
  CsvButton,
} from "../components/UI";
export default function Assessments() {
  const { access } = useWorkspace(),
    [params] = useSearchParams();
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const [selected, setSelected] = useState(params.get("aluno") || ""),
    [open, setOpen] = useState(false);
  const rows = useRows<any>(
    "evolva_assessments",
    { workspace_id: access?.workspace.id },
    "assessed_on",
  );
  const visible = rows.rows.filter(
    (a) => !selected || a.student_id === selected,
  );
  return (
    <>
      <Heading
        title="Avaliações"
        description="Registre o ponto de partida e preserve cada etapa do acompanhamento."
      >
        <button onClick={() => setOpen(true)}>
          <Plus size={17} />
          Nova avaliação
        </button>
      </Heading>
      <Feedback error={rows.error || students.error} />
      <section className="panel">
        <div className="filters">
          <select
            aria-label="Filtrar avaliações por aluno"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Todos os alunos</option>
            {students.rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <CsvButton
            name="evolva-avaliacoes.csv"
            headers={[
              "Data",
              "Aluno",
              "Peso (kg)",
              "Altura (cm)",
              "Cintura (cm)",
              "Quadril (cm)",
              "Compartilhada",
            ]}
            rows={visible.map((a) => [
              date(a.assessed_on),
              students.rows.find((s) => s.id === a.student_id)?.name,
              a.weight_kg,
              a.height_cm,
              a.waist_cm,
              a.hip_cm,
              a.shared ? "Sim" : "Não",
            ])}
          />
        </div>
        {rows.loading ? (
          <Loading />
        ) : !visible.length ? (
          <Empty title="Cada avaliação conta uma parte da história">
            Adicione o primeiro registro do seu aluno.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Data</th>
                  <th>Peso</th>
                  <th>Altura</th>
                  <th>Cintura</th>
                  <th>Quadril</th>
                  <th>Visibilidade</th>
                  <th>Histórico</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>
                        {students.rows.find((s) => s.id === a.student_id)?.name}
                      </strong>
                      <small>{a.notes}</small>
                    </td>
                    <td>{date(a.assessed_on)}</td>
                    <td>{a.weight_kg ?? "—"} kg</td>
                    <td>{a.height_cm ?? "—"} cm</td>
                    <td>{a.waist_cm ?? "—"} cm</td>
                    <td>{a.hip_cm ?? "—"} cm</td>
                    <td>
                      <span
                        className={"badge " + (a.shared ? "green" : "gray")}
                      >
                        {a.shared ? "Compartilhada" : "Interna"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={"/app/evolucao?aluno=" + a.student_id}
                        className="icon secondary"
                        aria-label="Ver evolução"
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <Modal title="Registrar avaliação" onClose={() => setOpen(false)}>
          <p className="muted">
            Medidas são registros do acompanhamento. A interpretação é
            responsabilidade do profissional.
          </p>
          <ActionForm
            onSuccess={() => setOpen(false)}
            onSubmit={(d) =>
              rpc("evolva_add_assessment", {
                p_student: value(d, "student"),
                p_date: value(d, "date"),
                p_weight: numberOrNull(d, "weight"),
                p_height: numberOrNull(d, "height"),
                p_waist: numberOrNull(d, "waist"),
                p_hip: numberOrNull(d, "hip"),
                p_notes: value(d, "notes") || null,
                p_shared: value(d, "shared") === "true",
              })
            }
          >
            <div className="form-grid">
              <Field name="student" label="Aluno" required value={selected}>
                <option value="">Selecione</option>
                {students.rows
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Field>
              <Field
                name="date"
                label="Data da avaliação"
                type="date"
                value={today()}
                max={today()}
                required
              />
              <Field
                name="weight"
                label="Peso (kg)"
                type="number"
                min={0.01}
                max={999}
                step="0.01"
              />
              <Field
                name="height"
                label="Altura (cm)"
                type="number"
                min={30}
                max={300}
                step="0.01"
              />
              <Field
                name="waist"
                label="Cintura (cm)"
                type="number"
                min={10}
                max={500}
                step="0.01"
              />
              <Field
                name="hip"
                label="Quadril (cm)"
                type="number"
                min={10}
                max={500}
                step="0.01"
              />
            </div>
            <Field
              name="notes"
              label="Observações da avaliação"
              type="textarea"
              max={3000}
            />
            <Field name="shared" label="Visibilidade" value="true">
              <option value="true">Compartilhar com o aluno</option>
              <option value="false">Somente o personal</option>
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
