import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

async function main() {
  if (!existsSync(".env"))
    throw Error(
      "Copie .env.example para .env e preencha as duas variáveis públicas.",
    );
  const env = { ...parseEnv(readFileSync(".env", "utf8")), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (
    !url ||
    !key ||
    url.includes("SEU-PROJETO") ||
    key.includes("SUA_CHAVE")
  ) {
    throw Error("Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
  }
  if (!URL.canParse(url) || new URL(url).protocol !== "https:")
    throw Error("A URL do Supabase deve ser HTTPS.");
  let role;
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    ).role;
  } catch {}
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw Error(
      "Use somente a chave pública no .env. Chaves administrativas não podem ir para o navegador.",
    );
  console.log("OK: configuração pública encontrada (chave ocultada).");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  const { error } = await db.from("evolva_exercises").select("id").limit(1);
  if (error && error.code !== "42501") {
    if (error.code === "PGRST205" || error.code === "42P01")
      throw Error(
        "Banco ainda não instalado. Execute sql/INSTALAR_COMPLETO.sql no SQL Editor do Supabase.",
      );
    throw Error(
      `Não foi possível consultar o banco (${error.code || "conexão"}). Confira a URL, a chave pública e a instalação SQL no Supabase.`,
    );
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      "O serviço de autenticação recusou a chave pública. Confira as credenciais do projeto.",
    );
  const settings = await response.json();
  console.log("OK: API e autenticação acessíveis com a chave pública.");
  console.log(
    error
      ? "OK: acesso anônimo à tabela bloqueado, conforme previsto nas migrações."
      : "ATENÇÃO: consulta anônima permitida; confira as permissões nas migrações.",
  );
  console.log(
    `Cadastro por e-mail: ${settings.external?.email ? "habilitado" : "desabilitado"}.`,
  );
  console.log(
    `Confirmação de e-mail: ${settings.mailer_autoconfirm ? "dispensada" : "exigida"}.`,
  );
  const advanced = await Promise.all([
    db.from("evolva_exercises").select("video_path").limit(1),
    db.from("evolva_templates").select("id").limit(1),
    db.from("evolva_reminders").select("id").limit(1),
    db.from("evolva_reminder_preferences").select("student_id").limit(1),
  ]);
  if (advanced.some((result) => result.error && result.error.code !== "42501"))
    throw Error(
      "Os recursos avançados ainda não puderam ser verificados. Execute sql/008_recursos_avancados.sql inteiro no SQL Editor e repita o diagnóstico.",
    );
  console.log(
    advanced.some((result) => result.error)
      ? "Recursos avançados: consultas anônimas bloqueadas. Confirme a instalação executando sql/008_recursos_avancados.sql no SQL Editor; este teste não comprova a existência de todas as tabelas."
      : "OK: recursos avançados respondem na API. Confira se as permissões anônimas correspondem à sua instalação.",
  );
  console.log(
    "Próximo passo: npm run dev. Valide cadastro, convite e sessão com contas separadas.",
  );
  console.log(
    "Este diagnóstico não verifica SMTP, redirecionamentos, Storage ou permissões de contas autenticadas.",
  );
}
main().catch((error) => {
  console.error(`Configuração pendente: ${error.message}`);
  process.exitCode = 1;
});
