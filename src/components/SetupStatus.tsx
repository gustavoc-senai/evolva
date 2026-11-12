import { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { rpc } from "../lib/supabase";
import { errorText } from "../lib/utils";
import { Feedback } from "./UI";

type Check = { label: string; migration: string; ready: boolean };
export default function SetupStatus() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CONFIGURAÇÃO</span>
          <h2>Status do sistema</h2>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setChecks([]);
            try {
              setChecks(await rpc<Check[]>("evolva_setup_status"));
            } catch (err) {
              setError(
                (err as { code?: string })?.code === "PGRST202"
                  ? "O diagnóstico ainda não está instalado. Execute sql/011_rotina_e_diagnostico.sql inteiro no SQL Editor do Supabase."
                  : errorText(err),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={16} />
          {busy ? "Verificando..." : "Verificar configuração"}
        </button>
      </div>
      <p className="muted">
        Confira quais atualizações estão instaladas antes de usar os novos
        recursos.
      </p>
      <Feedback error={error} />
      {checks.map((check) => (
        <div className="setup-check" key={check.migration}>
          {check.ready ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div>
            <strong>{check.label}</strong>
            <small>
              {check.ready
                ? "Instalado"
                : `Pendente: execute sql/${check.migration} no SQL Editor.`}
            </small>
          </div>
          <span className={"badge " + (check.ready ? "green" : "amber")}>
            {check.ready ? "Pronto" : "Pendente"}
          </span>
        </div>
      ))}
      <p className="muted small">
        O diagnóstico verifica a estrutura do banco. Envio de e-mails/WhatsApp,
        permissões de contas e reprodução real de vídeos precisam de validação
        própria.
      </p>
    </section>
  );
}
