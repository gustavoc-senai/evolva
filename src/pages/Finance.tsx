import { useRef, useState } from "react";
import { Plus, Wallet, ArrowDownLeft, Clock, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, money, today, statusLabel, errorText } from "../lib/utils";
import { monthlyReceipts } from "../lib/analytics";
import { TrendChart } from "../components/EvolutionCharts";
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
const methods: Record<string, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  TRANSFER: "Transferência",
};
export default function Finance() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const charges = useRows<any>(
      "evolva_charges",
      trainer
        ? { workspace_id: access?.workspace.id }
        : { student_id: access?.studentId },
    ),
    receipts = useRows<any>("evolva_receipts", {
      workspace_id: access?.workspace.id,
    });
  const [newCharge, setNew] = useState(false),
    [receive, setReceive] = useState<any | null>(null),
    [status, setStatus] = useState(""),
    [student, setStudent] = useState(""),
    [error, setError] = useState(""),
    [reverse, setReverse] = useState<any | null>(null);
  const request = useRef({ signature: "", id: "" });
  const paid = (id: string) =>
    receipts.rows
      .filter((r) => r.charge_id === id && !r.reversed_at)
      .reduce((n, r) => n + Number(r.amount), 0);
  const balance = (c: any) =>
    c.status === "CANCELLED" ? 0 : Math.max(0, Number(c.amount) - paid(c.id));
  const visible = charges.rows.filter(
    (c) =>
      (!status || c.status === status) &&
      (!student || c.student_id === student),
  );
  const outstanding = charges.rows.reduce((n, c) => n + balance(c), 0),
    overdue = charges.rows
      .filter((c) => c.due_on < today())
      .reduce((n, c) => n + balance(c), 0),
    received = receipts.rows
      .filter((r) => !r.reversed_at)
      .reduce((n, r) => n + Number(r.amount), 0);
  function argsWithId(args: Record<string, unknown>) {
    const signature = JSON.stringify(args);
    if (request.current.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    return { ...args, p_request: request.current.id };
  }
  return (
    <>
      <Heading
        title={trainer ? "Financeiro do acompanhamento" : "Minhas cobranças"}
        description={
          trainer
            ? "Cobranças, recebimentos e pendências do seu atendimento."
            : "Consulte os valores e combine o pagamento com seu personal."
        }
      >
        {trainer && (
          <button onClick={() => setNew(true)}>
            <Plus size={17} />
            Nova cobrança
          </button>
        )}
      </Heading>
      <Feedback
        error={error || charges.error || receipts.error || students.error}
      />
      <div className="metric-grid three">
        {[
          [ArrowDownLeft, "Recebimentos registrados", received],
          [Wallet, "Saldo em aberto", outstanding],
          [Clock, "Saldo vencido", overdue],
        ].map(([Icon, label, total]: any) => (
          <article className="metric" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{money(total)}</strong>
            <small>Conforme registros disponíveis</small>
          </article>
        ))}
      </div>
      {!trainer && (
        <p className="notice">
          O pagamento é combinado com o seu personal. Esta área não faz
          cobranças automáticas nem processa cartão.
        </p>
      )}
      {!receipts.loading && !receipts.error && <TrendChart title="Recebimentos registrados · últimos 6 meses" points={monthlyReceipts(receipts.rows)} unit="R$"/>}
      <section className="panel">
        <div className="filters">
          {trainer && (
            <select
              aria-label="Filtrar cobranças por aluno"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="">Todos os alunos</option>
              {students.rows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Status das cobranças"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {["OPEN", "PAID", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <CsvButton
            name="evolva-cobrancas.csv"
            headers={[
              "Aluno",
              "Descrição",
              "Vencimento",
              "Valor",
              "Recebido",
              "Saldo",
              "Situação",
            ]}
            rows={visible.map((c) => [
              students.rows.find((s) => s.id === c.student_id)?.name,
              c.description,
              c.due_on,
              c.amount,
              paid(c.id),
              balance(c),
              statusLabel(c.status),
            ])}
          />
        </div>
        {charges.loading ? (
          <Loading />
        ) : !visible.length ? (
          <Empty title="Tudo organizado por aqui">
            As cobranças do acompanhamento aparecerão nesta área.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Recebido</th>
                  <th>Saldo</th>
                  <th>Situação</th>
                  {trainer && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.description}</strong>
                      <small>
                        {students.rows.find((s) => s.id === c.student_id)?.name}
                      </small>
                    </td>
                    <td
                      className={
                        c.due_on < today() && balance(c) > 0
                          ? "text-danger"
                          : ""
                      }
                    >
                      {date(c.due_on)}
                    </td>
                    <td>{money(c.amount)}</td>
                    <td>{money(paid(c.id))}</td>
                    <td>{money(balance(c))}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (c.status === "PAID"
                            ? "green"
                            : c.status === "OPEN"
                              ? "amber"
                              : "gray")
                        }
                      >
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    {trainer && (
                      <td>
                        <div className="actions">
                          {c.status === "OPEN" && (
                            <button
                              className="secondary small"
                              onClick={() => setReceive(c)}
                            >
                              Receber
                            </button>
                          )}
                          {c.status !== "CANCELLED" && (
                            <button
                              className="secondary small"
                              onClick={async () => {
                                if (
                                  !confirm(
                                    "Cancelar esta cobrança? Recebimentos ativos precisam ser estornados antes.",
                                  )
                                )
                                  return;
                                try {
                                  await rpc("evolva_cancel_charge", {
                                    p_charge: c.id,
                                  });
                                } catch (e) {
                                  setError(errorText(e));
                                }
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Histórico de recebimentos</h2>
        {!receipts.rows.length ? (
          <Empty title="Nenhum recebimento registrado" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cobrança</th>
                  <th>Forma</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  {trainer && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {receipts.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{date(r.created_at, true)}</td>
                    <td>
                      {charges.rows.find((c) => c.id === r.charge_id)
                        ?.description || "Cobrança"}
                    </td>
                    <td>{methods[r.method] || r.method}</td>
                    <td>{money(r.amount)}</td>
                    <td>
                      {r.reversed_at ? (
                        <span className="badge gray">
                          Estornado · {r.reversal_reason}
                        </span>
                      ) : (
                        <span className="badge green">Registrado</span>
                      )}
                    </td>
                    {trainer && (
                      <td>
                        {!r.reversed_at && (
                          <button
                            className="secondary small"
                            onClick={() => setReverse(r)}
                          >
                            Estornar registro
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {newCharge && (
        <Modal title="Criar cobrança" onClose={() => setNew(false)}>
          <ActionForm
            onSuccess={() => setNew(false)}
            onSubmit={(d) =>
              rpc(
                "evolva_add_charge",
                argsWithId({
                  p_student: value(d, "student"),
                  p_description: value(d, "description"),
                  p_amount: Number(value(d, "amount")),
                  p_due: value(d, "due"),
                }),
              )
            }
          >
            <Field name="student" label="Aluno" required>
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
              name="description"
              label="Descrição"
              placeholder="Ex.: Acompanhamento mensal"
              required
            />
            <div className="form-grid">
              <Field
                name="amount"
                label="Valor (R$)"
                type="number"
                min={0.01}
                step="0.01"
                required
              />
              <Field
                name="due"
                label="Vencimento"
                type="date"
                value={today()}
                required
              />
            </div>
            <p className="muted small">
              Criar a cobrança não envia boleto nem movimenta dinheiro.
            </p>
          </ActionForm>
        </Modal>
      )}
      {receive && (
        <Modal title="Registrar recebimento" onClose={() => setReceive(null)}>
          <p>
            {receive.description} · Saldo {money(balance(receive))}
          </p>
          <ActionForm
            label="Confirmar recebimento"
            onSuccess={() => setReceive(null)}
            onSubmit={(d) =>
              rpc(
                "evolva_record_receipt",
                argsWithId({
                  p_charge: receive.id,
                  p_amount: Number(value(d, "amount")),
                  p_method: value(d, "method"),
                }),
              )
            }
          >
            <Field
              name="amount"
              label="Valor recebido (R$)"
              type="number"
              min={0.01}
              max={balance(receive)}
              step="0.01"
              value={balance(receive).toFixed(2)}
              required
            />
            <Field name="method" label="Forma de pagamento" value="PIX">
              {Object.entries(methods).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Field>
            <p className="notice">
              Confirme o recebimento no banco, em dinheiro ou na maquininha
              antes de registrar.
            </p>
          </ActionForm>
        </Modal>
      )}
      {reverse && (
        <Modal title="Estornar registro" onClose={() => setReverse(null)}>
          <p>
            Este estorno corrige o registro interno e reabre o saldo da
            cobrança. Não devolve dinheiro automaticamente.
          </p>
          <ActionForm
            label="Estornar registro"
            onSuccess={() => setReverse(null)}
            onSubmit={(d) =>
              rpc("evolva_reverse_receipt", {
                p_receipt: reverse.id,
                p_reason: value(d, "reason"),
              })
            }
          >
            <Field name="reason" label="Motivo do estorno" required />
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
