import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  Download,
} from "lucide-react";
import { errorText, exportCsv } from "../lib/utils";
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div className="feedback error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="feedback success" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}
    </>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">EVOLVA · PERSONAL & PERFORMANCE</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Empty({
  title = "Tudo pronto para começar",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <Inbox size={27} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      Carregando seu espaço...
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose),
    id = useId();
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) ?? [],
        );
        const first = all[0],
          last = all.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2 id={id}>{title}</h2>
          <button
            className="icon secondary"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ActionForm({
  children,
  onSubmit,
  label = "Salvar",
  onSuccess,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<unknown>;
  label?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSubmit(data);
      setMessage("Informações salvas.");
      onSuccess?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <Feedback error={error} message={message} />
      <fieldset disabled={busy}>
        {children}
        <button className="submit" type="submit">
          {busy ? "Salvando..." : label}
        </button>
      </fieldset>
    </form>
  );
}
export function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
  min,
  max,
  step,
  children,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: string;
  children?: ReactNode;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label>
      {label}
      {children ? (
        <select
          name={name}
          value={onChange ? (value ?? "") : undefined}
          defaultValue={onChange ? undefined : (value ?? "")}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          required={required}
        >
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={onChange ? (value ?? "") : undefined}
          defaultValue={onChange ? undefined : (value ?? "")}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          required={required}
          maxLength={Number(max) || 2000}
          placeholder={placeholder}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={onChange ? (value ?? "") : undefined}
          defaultValue={onChange ? undefined : (value ?? "")}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          required={required}
          min={min}
          max={max}
          step={step}
          maxLength={type === "text" ? 500 : undefined}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function CsvButton({
  name,
  headers,
  rows,
}: {
  name: string;
  headers: string[];
  rows: unknown[][];
}) {
  return (
    <button
      className="secondary"
      onClick={() => exportCsv(name, headers, rows)}
    >
      <Download size={16} />
      Exportar CSV
    </button>
  );
}
export const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const numberOrNull = (data: FormData, key: string) =>
  value(data, key) === "" ? null : Number(value(data, key));
