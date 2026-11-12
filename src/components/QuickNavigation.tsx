import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { Modal } from "./UI";

export default function QuickNavigation({
  trainer,
  admin,
}: {
  trainer: boolean;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const entries = [
    ["Visão geral", "/app", "Seu resumo e próximos atendimentos"],
    ["Treinos", "/app/treinos", "Prescrições e sessões"],
    ["Agenda", "/app/agenda", "Horários e confirmações"],
    ["Rotina semanal", "/app/rotina", "Treinos organizados por dia"],
    ["Lembretes", "/app/lembretes", "Avisos por e-mail e WhatsApp"],
    ["Mensagens", "/app/mensagens", "Conversas do acompanhamento"],
    ["Financeiro", "/app/financeiro", "Cobranças e recebimentos"],
    ["Notificações", "/app/notificacoes", "Novidades do seu espaço"],
    ["Configurações", "/app/configuracoes", "Perfil e segurança da conta"],
    ...(trainer
      ? [
          ["Alunos", "/app/alunos", "Cadastros, objetivos e convites"],
          ["Modelos de treino", "/app/modelos", "Prescrições reutilizáveis"],
          ["Exercícios", "/app/exercicios", "Sua biblioteca de movimentos"],
          ["Avaliações", "/app/avaliacoes", "Medidas e acompanhamento"],
          ["Relatórios", "/app/relatorios", "Resultados e exportações"],
          ["Assinatura", "/app/assinatura", "Plano e capacidade do espaço"],
        ]
      : [
          ["Minha evolução", "/app/evolucao", "Histórico e avaliações"],
          ["Check-in", "/app/checkin", "Registre como você está hoje"],
        ]),
    ...(admin
      ? [["Plataforma", "/app/plataforma", "Administração do Evolva"]]
      : []),
  ];
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results = entries.filter((entry) =>
    normalize(entry.join(" ")).includes(normalize(query.trim())),
  );
  function go(path: string) {
    setOpen(false);
    navigate(path);
  }
  return (
    <>
      <button
        className="secondary navigation-trigger"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        aria-label="Buscar páginas"
      >
        <Search size={17} />
        <span>Ir para...</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <Modal title="Aonde vamos?" onClose={() => setOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (results[0]) go(results[0][1]);
            }}
          >
            <label className="navigation-search">
              Buscar página
              <input
                autoFocus
                placeholder="Ex.: alunos, agenda, financeiro..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </form>
          <div className="navigation-results">
            {results.map(([label, path, description]) => (
              <button
                className="navigation-result secondary"
                key={path}
                onClick={() => go(path)}
              >
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
            {!results.length && (
              <p className="muted" role="status">
                Nenhuma página encontrada. Tente outro termo.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
