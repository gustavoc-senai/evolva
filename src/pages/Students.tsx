import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowUpRight,
  Mail,
  Phone,
  Target,
  Link2,
  Copy,
  ShieldOff,
} from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import type { Student } from "../lib/types";
import { date, errorText } from "../lib/utils";
import {
  Heading,
  Feedback,
  Empty,
  Loading,
  Modal,
  ActionForm,
  Field,
  value,
  CsvButton,
} from "../components/UI";
import ProgressGallery from "../components/ProgressGallery";
function StudentForm({ row, onDone }: { row?: Student; onDone: () => void }) {
  const { access } = useWorkspace();
  return (
    <ActionForm
      label={row ? "Salvar aluno" : "Cadastrar aluno"}
      onSuccess={onDone}
      onSubmit={(d) =>
        rpc("evolva_save_student", {
          p_workspace: access?.workspace.id,
          p_student: row?.id ?? null,
          p_name: value(d, "name"),
          p_email: value(d, "email"),
          p_phone: value(d, "phone") || null,
          p_goal: value(d, "goal") || null,
          p_active: value(d, "active") === "true",
        })
      }
    >
      <div className="form-grid">
        <Field name="name" label="Nome completo" value={row?.name} required />
        <Field
          name="email"
          label="E-mail de acesso"
          type="email"
          value={row?.email}
          required
        />
        <Field name="phone" label="Telefone" value={row?.phone} />
        <Field
          name="active"
          label="Situação"
          value={String(row?.active ?? true)}
        >
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </Field>
      </div>
      <Field
        name="goal"
        label="Objetivo do acompanhamento"
        type="textarea"
        value={row?.goal}
        max={1000}
      />
      <p className="muted small">
        Para mudar o e-mail de um aluno vinculado, revogue o acesso primeiro.
        Inativar suspende o acesso; reativar restaura um vínculo ainda
        existente.
      </p>
    </ActionForm>
  );
}
export default function Students() {
  const { access } = useWorkspace();
  const { rows, loading, error } = useRows<Student>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("active"),
    [edit, setEdit] = useState<Student | null | undefined>(undefined),
    [token, setToken] = useState(""),
    [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [sort,setSort]=useState("newest"),[page,setPage]=useState(1);
  const filtered = rows.filter(
    (s) =>
      (status === "all" || s.active === (status === "active")) &&
      `${s.name} ${s.email}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"pt-BR"):(b.created_at || "").localeCompare(a.created_at || ""));
  const pages=Math.max(1,Math.ceil(filtered.length/12));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*12,currentPage*12);
  async function invite(s: Student) {
    setBusy(true);
    setError("");
    try {
      setToken(await rpc("evolva_invite_student", { p_student: s.id }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Seus alunos"
        description="Histórias diferentes. Um acompanhamento próximo para cada uma."
      >
        <button onClick={() => setEdit(null)}>
          <Plus size={17} />
          Novo aluno
        </button>
      </Heading>
      <Feedback error={error || actionError} />
      <section className="panel">
        <div className="filters">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Buscar aluno"
              placeholder="Buscar por nome ou e-mail"
              value={search}
              onChange={(e) => {setSearch(e.target.value);setPage(1);}}
            />
          </div>
          <select
            aria-label="Situação dos alunos"
            value={status}
            onChange={(e) => {setStatus(e.target.value);setPage(1);}}
          >
            <option value="active">Ativos</option>
            <option value="all">Todos os alunos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select aria-label="Ordenar alunos" value={sort} onChange={event=>{setSort(event.target.value);setPage(1);}}><option value="newest">Mais recentes</option><option value="name">Nome A–Z</option></select>
          <CsvButton
            name="evolva-alunos.csv"
            headers={["Nome", "E-mail", "Telefone", "Situação"]}
            rows={filtered.map((s) => [
              s.name,
              s.email,
              s.phone,
              s.active ? "Ativo" : "Inativo",
            ])}
          />
        </div>
        {loading ? (
          <Loading />
        ) : !filtered.length ? (
          <Empty title="Seu próximo aluno começa aqui">
            Cadastre um aluno para montar o acompanhamento e enviar o convite.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Contato</th>
                  <th>Acesso</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="person-cell" to={"/app/alunos/" + s.id}>
                        <span className="avatar pastel">{s.name[0]}</span>
                        <span>
                          <strong>{s.name}</strong>
                          <small>
                            {s.active ? "Acompanhamento ativo" : "Inativo"}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {s.email}
                      <small>{s.phone || "Sem telefone"}</small>
                    </td>
                    <td>
                      <span
                        className={
                          "badge " + (s.account_id ? "green" : "amber")
                        }
                      >
                        {s.account_id ? "Vinculado" : "Sem vínculo"}
                      </span>
                    </td>
                    <td>{date(s.created_at)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="secondary small"
                          onClick={() => setEdit(s)}
                        >
                          Editar
                        </button>
                        {!s.account_id && s.active && (
                          <button
                            className="secondary small"
                            disabled={busy}
                            onClick={() => void invite(s)}
                          >
                            <Link2 size={14} />
                            Convidar
                          </button>
                        )}
                        <Link
                          className="icon secondary"
                          aria-label={"Abrir " + s.name}
                          to={"/app/alunos/" + s.id}
                        >
                          <ArrowUpRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length>12&&<div className="pagination"><span>{filtered.length} alunos · Página {currentPage} de {pages}</span><div className="actions"><button className="secondary small" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button><button className="secondary small" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Próxima</button></div></div>}
      </section>
      {edit !== undefined && (
        <Modal
          title={edit ? "Editar aluno" : "Adicionar aluno"}
          onClose={() => setEdit(undefined)}
        >
          <StudentForm
            row={edit ?? undefined}
            onDone={() => setEdit(undefined)}
          />
        </Modal>
      )}
      {token && (
        <Modal title="Convite do aluno" onClose={() => setToken("")}>
          <p>
            Compartilhe este link com o aluno. Ele deve usar o e-mail
            cadastrado. O convite expira em 48 horas; gerar outro revoga o
            anterior.
          </p>
          <input
            readOnly
            aria-label="Link de convite"
            value={window.location.origin + "/convite/" + token}
          />
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(window.location.origin + "/convite/" + token)
                .catch(() => setError("Selecione o link e copie manualmente."))
            }
          >
            <Copy size={16} />
            Copiar link
          </button>
        </Modal>
      )}
    </>
  );
}
export function StudentProfile() {
  const { id } = useParams();
  const { access } = useWorkspace();
  const { rows, loading, error } = useRows<Student>("evolva_students", {
    id,
    workspace_id: access?.workspace.id,
  });
  const notes = useRows<any>(
      "evolva_student_notes",
      { student_id: id },
      "updated_at",
    ),
    sessions = useRows<any>(
      "evolva_sessions",
      { student_id: id },
      "completed_at",
    ),
    workouts = useRows<any>("evolva_workouts", { student_id: id });
  const [edit, setEdit] = useState(false),
    [message, setMessage] = useState(""),
    [actionError, setError] = useState("");
  const [tab,setTab]=useState("overview");
  const s = rows[0];
  if (loading) return <Loading />;
  if (!s)
    return (
      <>
        <Feedback error={error} />
        <Empty title="Aluno indisponível" />
      </>
    );
  return (
    <>
      <Heading title={s.name} description="Visão completa do acompanhamento.">
        <Link className="button secondary" to="/app/alunos">
          Voltar
        </Link>
        <button onClick={() => setEdit(true)}>Editar cadastro</button>
      </Heading>
      <Feedback
        error={actionError || notes.error || sessions.error || workouts.error}
        message={message}
      />
      <div className="profile-banner">
        <span className="avatar profile-avatar">{s.name[0]}</span>
        <div>
          <h2>{s.name}</h2>
          <p>
            <Mail size={14} />
            {s.email} <Phone size={14} />
            {s.phone || "Sem telefone"}
          </p>
          <span className={"badge " + (s.active ? "green" : "gray")}>
            {s.active ? "Ativo" : "Inativo"}
          </span>
        </div>
        <div className="profile-stats">
          <span>
            <strong>
              {workouts.rows.filter((w) => w.status === "PUBLISHED").length}
            </strong>
            Treinos publicados
          </span>
          <span>
            <strong>{sessions.rows.length}</strong>Sessões registradas
          </span>
        </div>
      </div>
      <div className="tabs profile-tabs" aria-label="Seções do aluno">{[["overview","Visão geral"],["notes","Anotações"],["photos","Fotos"],["history","Histórico"]].map(([key,label])=><button key={key} className={tab===key?"active":""} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}<Link to={`/app/treinos?aluno=${s.id}`}>Treinos ↗</Link><Link to={`/app/avaliacoes?aluno=${s.id}`}>Avaliações ↗</Link><Link to={`/app/evolucao?aluno=${s.id}`}>Evolução ↗</Link><Link to={`/app/rotina?aluno=${s.id}`}>Rotina ↗</Link></div>
      <div className="profile-sections">
        <section className="panel" hidden={tab!=="overview"}>
          <div className="panel-heading">
            <h2>
              <Target size={18} />
              Objetivo
            </h2>
          </div>
          <p>{s.goal || "Objetivo ainda não registrado."}</p>
          <div className="actions">
            <Link
              className="button secondary"
              to={"/app/treinos?aluno=" + s.id}
            >
              Prescrições
            </Link>
            <Link
              className="button secondary"
              to={"/app/avaliacoes?aluno=" + s.id}
            >
              Avaliações
            </Link>
            <Link
              className="button secondary"
              to={"/app/mensagens?aluno=" + s.id}
            >
              Conversar
            </Link>
          </div>
        </section>
        <section className="panel" hidden={tab!=="notes"}>
          <h2>Anotações internas</h2>
          <p className="muted small">Visíveis somente para o personal.</p>
          <ActionForm
            key={notes.rows[0]?.updated_at || s.id}
            label="Salvar anotação"
            onSubmit={(d) =>
              rpc("evolva_save_private_note", {
                p_student: s.id,
                p_body: value(d, "body"),
              })
            }
          >
            <Field
              name="body"
              label="Registro interno"
              type="textarea"
              value={notes.rows[0]?.body}
              max={10000}
            />
          </ActionForm>
        </section>
      </div>
      {tab==="photos"&&<ProgressGallery studentId={s.id} />}
      <section className="panel" hidden={tab!=="history"}>
        <h2>Histórico de sessões</h2>
        {sessions.rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Treino</th>
                  <th>Data</th>
                  <th>Esforço informado</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {sessions.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {workouts.rows.find((w) => w.id === r.workout_id)
                        ?.title || "Treino"}
                    </td>
                    <td>{date(r.completed_at, true)}</td>
                    <td>{r.effort ?? "—"}</td>
                    <td>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Ainda não há sessões registradas" />
        )}
      </section>
      {s.account_id && (
        <section className="panel danger-zone" hidden={tab!=="overview"}>
          <h2>Acesso do aluno</h2>
          <p>
            Revogar remove o vínculo da conta e invalida os convites,
            preservando os registros do acompanhamento.
          </p>
          <button
            className="danger"
            onClick={async () => {
              if (!confirm("Revogar o acesso deste aluno?")) return;
              try {
                await rpc("evolva_revoke_access", { p_student: s.id });
                setMessage("Acesso revogado.");
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            <ShieldOff size={16} />
            Revogar acesso
          </button>
        </section>
      )}
      {edit && (
        <Modal title="Editar aluno" onClose={() => setEdit(false)}>
          <StudentForm row={s} onDone={() => setEdit(false)} />
        </Modal>
      )}
    </>
  );
}
