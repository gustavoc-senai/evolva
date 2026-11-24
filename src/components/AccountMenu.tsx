import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { errorText } from "../lib/utils";
export default function AccountMenu({ email }: { email?: string }) {
  const [open,setOpen]=useState(false),[error,setError]=useState("");
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',escape);};},[]);
  return <div className="account-menu" ref={root}><button className="account-trigger" aria-label="Abrir menu da conta" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="topbar-avatar">{email?.slice(0,1).toUpperCase()}</span><ChevronDown size={13}/></button>{open&&<div className="account-popover"><span className="overline">SUA CONTA</span><strong>{email}</strong><Link to="/app/configuracoes" onClick={()=>setOpen(false)}><Settings size={16}/>Configurações</Link><button className="secondary" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError(errorText(error));}}><LogOut size={16}/>Sair da conta</button>{error&&<p role="alert">{error}</p>}</div>}</div>;
}
