import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, Activity, Dumbbell, CalendarDays, MessageSquare, ShieldCheck, Check, Play } from "lucide-react";
import { Brand } from "./Public";
import ThemeToggle from "../components/ThemeToggle";

export default function Landing() {
  return <div className="landing premium-landing">
    <header><Brand /><nav><a href="#produto">Plataforma</a><a href="#rotina">Seu método</a><Link to="/login">Entrar</Link><ThemeToggle /><Link className="button" to="/cadastro">Criar meu espaço <ArrowUpRight size={16} /></Link></nav></header>
    <main>
      <section className="editorial-hero">
        <img className="editorial-photo" src="/images/training-editorial.png" alt="Personal trainer acompanhando a execução de um exercício em um estúdio" fetchPriority="high" />
        <div className="editorial-shade" />
        <div className="editorial-copy"><span className="overline"><span />A PLATAFORMA DO SEU PRÓXIMO NÍVEL</span><h1>Seu método.<br />Mais <em>resultado.</em></h1><p>Menos tempo entre planilhas.<br />Mais presença em cada evolução.</p><Link className="button" to="/cadastro">Começar meu acompanhamento <ArrowUpRight size={18} /></Link><a className="editorial-secondary" href="#produto"><Play size={14} />Conheça a plataforma</a><div className="editorial-assurance"><ShieldCheck size={16} /><span>Acessos individuais. Dados protegidos.</span></div></div>
        <div className="editorial-caption"><span>EVOLVA / PERSONAL & PERFORMANCE</span><strong>O cuidado está<br />nos detalhes.</strong></div>
      </section>
      <section className="capability-strip" aria-label="Recursos da plataforma">{["PRESCRIÇÃO INTELIGENTE", "ACOMPANHAMENTO PRÓXIMO", "ROTINA ORGANIZADA", "EVOLUÇÃO VISÍVEL"].map((text,index) => <span key={text}><span>0{index+1}</span>{text}<ArrowUpRight size={16} /></span>)}</section>
      <section id="produto" className="product-section"><div className="product-heading"><div><span className="overline">FEITO PARA QUEM ACOMPANHA</span><h2>Seu trabalho é pessoal.<br />Sua gestão também.</h2></div><p>Da primeira avaliação ao próximo treino. Tudo conectado em um espaço que acompanha o seu jeito de trabalhar.</p></div><div className="product-feature-grid">
        {[[Dumbbell,"01","Prescreva com intenção.","Treinos organizados, vídeos de demonstração e orientações que chegam ao aluno com clareza."],[Activity,"02","Enxergue a evolução.","Sessões, cargas, avaliações e check-ins para acompanhar o caminho de cada aluno."],[CalendarDays,"03","Abra espaço no seu dia.","Atendimentos, cobranças e rotina semanal organizados para você focar no acompanhamento."],[MessageSquare,"04","Esteja mais perto.","Conversas e histórico no contexto certo. Um acesso individual para cada aluno."]].map(([Icon,n,title,body]:any)=><article key={n}><div><Icon size={24}/><span>{n}</span></div><h3>{title}</h3><p>{body}</p></article>)}
      </div></section>
      <section id="rotina" className="method-section"><div className="method-photo"><img src="/images/strength-detail.png" alt="Detalhe de equipamentos de musculação em um estúdio" loading="lazy" /><span>CONSTRUÍDO NA ROTINA.<br />PERCEBIDO NA EVOLUÇÃO.</span></div><div className="method-copy"><span className="overline">DO SEU MÉTODO PARA O DIA A DIA</span><h2>Mais simples de gerir.<br />Mais próximo de acompanhar.</h2>{[["Convide.","Cadastre o aluno e compartilhe um acesso individual ao acompanhamento."],["Prescreva.","Organize exercícios, demonstrações e orientações em cada treino."],["Acompanhe.","Consulte os registros e use o histórico para planejar o próximo passo."]].map(([title,body],index)=><article key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></section>
      <section className="premium-cta"><div><span className="overline">O PRÓXIMO MOVIMENTO É SEU</span><h2>Profissionalize a gestão.<br />Preserve a conexão.</h2><p>Seu espaço. Seu método. Cada aluno, mais perto.</p></div><Link className="button" to="/cadastro">Criar meu espaço <ArrowRight size={18}/></Link></section>
    </main><footer><Brand/><span>Personal & Performance</span><Link to="/login">Acessar minha conta <ArrowUpRight size={14}/></Link></footer>
  </div>;
}
