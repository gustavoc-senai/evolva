import { useState } from "react";
import { Moon, Sun } from "lucide-react";
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  return <button className="icon secondary theme-toggle" aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={theme === "dark" ? "Tema claro" : "Tema escuro"} onClick={() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; setTheme(next);
    try { localStorage.setItem("evolva-theme", next); } catch {}
  }}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
