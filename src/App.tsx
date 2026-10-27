import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  FilePlus2,
  FileText,
  Headphones,
  Inbox,
  Laptop,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";
import { api } from "./api";
import type {
  ChatMessage,
  Conversation,
  ConversationStatus,
  Employee,
  Ticket,
  TicketDraft,
} from "../server/types";

type ConversationSummary = Conversation & { owner?: Employee };
type QueueFilter = "all" | "waiting" | "analyst" | "closed";
type ChatMode = "chat" | "tickets";

const demoAccounts = [
  { email: "ana.souza@nexo.com", label: "Ana Souza · Funcionária", role: "employee" },
  { email: "caio.mendes@nexo.com", label: "Caio Mendes · Funcionário", role: "employee" },
  { email: "marina.analista@nexo.com", label: "Marina Costa · Analista", role: "analyst" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(date));
}

function isOverdue(ticket: Ticket): boolean {
  return !["Resolvido", "Aprovado"].includes(ticket.status) && Date.parse(ticket.dueAt) < Date.now();
}

function priorityClass(priority: Ticket["priority"]): string {
  return `priority priority-${priority.toLowerCase().replace("í", "i").replace("é", "e")}`;
}

function statusClass(status: Ticket["status"]): string {
  if (status === "Resolvido" || status === "Aprovado") return "status status-done";
  if (status === "Aguardando analista") return "status status-waiting";
  return "status status-open";
}

function statusLabel(status: ConversationStatus): string {
  return {
    agent: "Com o Nexo Assist",
    waiting: "Aguardando analista",
    analyst: "Em atendimento",
    closed: "Encerrada",
  }[status];
}

function formatMessageText(text: string) {
  return text.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("•")) {
      return (
        <div className="message-list-item" key={`${index}-${line}`}>
          <span className="message-bullet" />
          <span>{trimmed.slice(1).trim()}</span>
        </div>
      );
    }
    return trimmed ? (
      <p className="message-paragraph" key={`${index}-${line}`}>
        {line}
      </p>
    ) : (
      <div className="message-break" key={`${index}-break`} />
    );
  });
}

function priorityFromDraft(draft: TicketDraft): string {
  const responseHours = { Crítica: 1, Alta: 4, Média: 72, Baixa: 120 } as const;
  const due = new Date(Date.now() + responseHours[draft.priority] * 60 * 60 * 1000);
  return `Primeira resposta até ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(due)}`;
}

function LoginScreen({ onLogin, initialError = "" }: { onLogin: (employee: Employee) => void; initialError?: string }) {
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { employee } = await api.login(email, password);
      onLogin(employee);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-left">
        <div className="brand-lockup">
          <div className="brand-symbol"><Command size={19} strokeWidth={2.6} /></div>
          <span>nexo<span className="brand-dot">.</span></span>
        </div>
        <div className="login-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> SERVICE DESK INTELIGENTE</div>
          <h1>Seu trabalho<br />não pode parar.</h1>
          <p>Conte o que aconteceu. A gente resolve com você, do primeiro passo até a solução.</p>
          <div className="login-proof">
            <div className="proof-icon"><ShieldCheck size={18} /></div>
            <div><strong>Suporte sempre por perto</strong><span>Seguro, simples e feito para o seu dia.</span></div>
          </div>
        </div>
        <div className="login-footer">© 2026 Nexo Tecnologia <span>•</span> Feito para ir mais longe</div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-icon"><Sparkles size={20} /></div>
          <div className="login-heading">
            <div className="eyebrow muted">BEM-VINDA(O) À NEXO</div>
            <h2>Entre na sua conta</h2>
            <p>Acesse o Nexo Assist com seu e-mail corporativo.</p>
          </div>
          <form onSubmit={submit} className="login-form">
            <label htmlFor="email">E-mail corporativo</label>
            <div className="input-with-icon">
              <UserRound size={17} />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="nome@nexo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <label htmlFor="password">Senha</label>
            <div className="input-with-icon">
              <LockKeyhole size={17} />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <button type="submit" className="primary-button login-submit" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin" /> : <>Entrar <ArrowUpRight size={17} /></>}
            </button>
          </form>
          <div className="login-divider"><span /> <small>ACESSO DE DEMONSTRAÇÃO</small> <span /></div>
          <div className="demo-list">
            {demoAccounts.map((account) => (
              <button
                type="button"
                className={`demo-account ${account.role === "analyst" ? "demo-analyst" : ""}`}
                key={account.email}
                onClick={() => setEmail(account.email)}
              >
                <span className="demo-avatar">{account.role === "analyst" ? <Headphones size={14} /> : initials(account.label.split(" · ")[0])}</span>
                <span>{account.label}</span>
                <ChevronRight size={15} />
              </button>
            ))}
            <p>Use qualquer senha. Os dados são locais e fictícios.</p>
          </div>
        </div>
        <div className="login-right-footer"><LockKeyhole size={12} /> Conexão protegida <span>•</span> Dados da demonstração</div>
      </div>
    </main>
  );
}

function TicketCard({
  ticket,
  compact = false,
  selected = false,
  onSelect,
}: {
  ticket: Ticket;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (ticket: Ticket) => void;
}) {
  return (
    <button
      type="button"
      className={`ticket-card ${compact ? "ticket-card-compact" : ""} ${selected ? "ticket-selected" : ""} ${onSelect ? "ticket-card-clickable" : ""}`}
      onClick={onSelect ? () => onSelect(ticket) : undefined}
      disabled={!onSelect}
    >
      <div className="ticket-card-top">
        <span className="ticket-id">{ticket.id}</span>
        {isOverdue(ticket) && <span className="overdue-label"><Clock3 size={11} /> Vencido</span>}
        {!isOverdue(ticket) && <ChevronRight size={14} className="ticket-chevron" />}
      </div>
      <strong className="ticket-title">{ticket.title}</strong>
      <div className="ticket-card-bottom">
        <span className={statusClass(ticket.status)}><i />{ticket.status}</span>
        <span className={priorityClass(ticket.priority)}>{ticket.priority}</span>
      </div>
      {!compact && <div className="ticket-card-meta">{ticket.category}<span>·</span> Atualizado {formatDate(ticket.updatedAt)}</div>}
    </button>
  );
}

function DraftCard({
  draft,
  ownerName,
  onConfirm,
  onCancel,
  disabled,
}: {
  draft: TicketDraft;
  ownerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="draft-card">
      <div className="draft-card-heading">
        <div className="draft-icon"><FileText size={17} /></div>
        <div><strong>{draft.action === "create" ? "Confira seu chamado" : "Confira a atualização"}</strong><span>Rascunho · ainda não registrado</span></div>
        <span className="draft-status">RASCUNHO</span>
      </div>
      <div className="draft-fields">
        <div><span>TÍTULO</span><strong>{draft.title}</strong></div>
        <div className="draft-grid">
          <div><span>TIPO</span><strong>{draft.type === "INC" ? "Incidente" : "Requisição"}</strong></div>
          <div><span>CATEGORIA</span><strong>{draft.category}</strong></div>
          <div><span>PRIORIDADE</span><strong className={priorityClass(draft.priority)}>{draft.priority}</strong></div>
        </div>
        <div className="draft-affected"><span>PESSOAS AFETADAS</span><strong>{ownerName}{draft.affectedPeople > 1 ? ` + ${draft.affectedPeople - 1} ${draft.affectedPeople === 2 ? "pessoa" : "pessoas"}` : ""}</strong></div>
        <p>{draft.description}</p>
      </div>
      <div className="draft-sla"><Clock3 size={14} /> {priorityFromDraft(draft)}</div>
      <div className="draft-actions">
        <button type="button" className="primary-button draft-confirm" onClick={onConfirm} disabled={disabled}>
          <Check size={15} /> Confirmar {draft.action === "create" ? "abertura" : "atualização"}
        </button>
        <button type="button" className="text-button" onClick={onCancel} disabled={disabled}>Cancelar</button>
      </div>
    </div>
  );
}

function DecisionDetails({ message }: { message: ChatMessage }) {
  if (!message.decision) return null;
  const decision = message.decision;
  return (
    <details className="decision-details">
      <summary><Activity size={13} /> Entenda a decisão <ChevronDown size={13} className="details-chevron" /></summary>
      <div className="decision-body">
        <div className="decision-row"><span>O que entendi</span><strong>{decision.intent}</strong></div>
        <div className="decision-row"><span>Ação</span><strong>{decision.action}</strong></div>
        <div className="confidence-line"><span>Confiança</span><div className="confidence-meter"><i style={{ width: `${Math.round(decision.confidence * 100)}%` }} /></div><strong>{Math.round(decision.confidence * 100)}%</strong></div>
        <p>{decision.reason}</p>
        {decision.toolCalls.length > 0 && <div className="decision-tools"><span>ETAPAS</span>{decision.toolCalls.map((tool) => <code key={tool}>{tool}</code>)}</div>}
        {decision.sources.length > 0 && <div className="decision-source"><FileText size={12} /> {decision.sources.join(" · ")}</div>}
      </div>
    </details>
  );
}

function ChatBubble({
  message,
  owner,
  tickets,
  activeDraftMessageId,
  onConfirm,
  onCancel,
  sending,
}: {
  message: ChatMessage;
  owner: Employee;
  tickets: Ticket[];
  activeDraftMessageId?: string;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  const isEmployee = message.role === "employee";
  const isSystem = message.role === "system";
  if (isSystem) return <div className="system-message"><span />{message.content}<span /></div>;
  const linkedTickets = (message.ticketIds ?? [])
    .map((id) => tickets.find((ticket) => ticket.id === id))
    .filter((ticket): ticket is Ticket => Boolean(ticket));
  const draft =
    message.id === activeDraftMessageId && message.draft && message.draft.missing.length === 0
      ? message.draft
      : undefined;
  return (
    <article className={`chat-message ${isEmployee ? "chat-message-outgoing" : ""}`}>
      {!isEmployee && (
        <div className={`message-avatar ${message.role === "analyst" ? "analyst-avatar" : ""}`}>
          {message.role === "analyst" ? initials("Marina Costa") : <Sparkles size={15} />}
        </div>
      )}
      <div className="message-column">
        {!isEmployee && <div className="message-byline">{message.role === "analyst" ? "Marina · Service desk" : "Nexo Assist"} <time>{formatTime(message.createdAt)}</time></div>}
        {message.actions && message.actions.length > 0 && !isEmployee && (
          <div className="action-tags">{message.actions.map((action) => <span key={action}><CheckCircle2 size={11} />{action}</span>)}</div>
        )}
        <div className={`message-bubble ${isEmployee ? "employee-bubble" : ""}`}>
          {formatMessageText(message.content)}
        </div>
        {linkedTickets.map((ticket) => <TicketCard ticket={ticket} key={ticket.id} />)}
        {draft && <DraftCard draft={draft} ownerName={owner.name} onConfirm={onConfirm} onCancel={onCancel} disabled={sending} />}
        {!isEmployee && <DecisionDetails message={message} />}
      </div>
      {isEmployee && <div className="message-avatar employee-avatar">{initials(owner.name)}</div>}
      {isEmployee && <time className="outgoing-time">{formatTime(message.createdAt)}</time>}
    </article>
  );
}

function EmployeeWorkspace({
  employee,
  onLogout,
}: {
  employee: Employee;
  onLogout: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initializationStarted = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(async (selectedId?: string) => {
    setLoading(true);
    setError("");
    try {
      const [conversationResponse, ticketResponse] = await Promise.all([api.conversations(), api.tickets()]);
      let all = conversationResponse.conversations;
      if (!all.length) {
        const created = await api.createConversation();
        all = [created.conversation];
      }
      setConversations(all);
      setTickets(ticketResponse.tickets);
      const selected = all.find((item) => item.id === selectedId) ?? all[0];
      const detail = await api.conversation(selected.id);
      setConversation(detail.conversation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o atendimento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    void reload();
  }, [reload]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [conversation?.messages.length, mode]);
  useEffect(() => {
    if (!conversation || !["waiting", "analyst"].includes(conversation.status)) return;
    let active = true;
    const timer = window.setInterval(() => {
      void api.conversation(conversation.id)
        .then((detail) => { if (active) setConversation(detail.conversation); })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a conversa.");
        });
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [conversation?.id, conversation?.status]);

  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.ownerId === employee.id), [tickets, employee.id]);
  const overdueCount = openTickets.filter(isOverdue).length;
  const pendingDraft = conversation?.pendingDraft;
  const usedMessages = conversation?.messages.filter((message) => message.role === "employee").length ?? 0;
  const isPaused = conversation?.status === "waiting" || conversation?.status === "closed";
  const isHumanHandling = conversation?.status === "analyst";
  const agentIsPaused = isPaused || isHumanHandling;
  const activeDraftMessageId = pendingDraft
    ? [...(conversation?.messages ?? [])].reverse().find((message) => message.role === "agent" && message.draft)?.id
    : undefined;

  async function selectConversation(item: ConversationSummary) {
    setError("");
    setNotice("");
    setContent("");
    try {
      const detail = await api.conversation(item.id);
      setConversation(detail.conversation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir a conversa.");
    }
  }

  async function newConversation() {
    setError("");
    setNotice("");
    setContent("");
    try {
      const { conversation: created } = await api.createConversation();
      setConversation(created);
      setConversations((current) => [created, ...current]);
      setMode("chat");
      window.setTimeout(() => inputRef.current?.focus(), 100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar uma conversa.");
    }
  }

  async function send(text = content) {
    if (!text.trim() || !conversation || sending || isPaused) return;
    setSending(true);
    setError("");
    setNotice("");
    setContent("");
    try {
      const result = await api.sendMessage(conversation.id, text.trim());
      setConversation(result.conversation);
      const [allConversations, ticketResponse] = await Promise.all([api.conversations(), api.tickets()]);
      setConversations(allConversations.conversations);
      setTickets(ticketResponse.tickets);
      if (result.conversation.status === "waiting") {
        setNotice("Sua conversa está na fila do service desk. O Nexo Assist ficará pausado até um analista assumir.");
      }
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } catch (caught) {
      setContent(text);
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    try {
      await api.logout();
      onLogout();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível encerrar a sessão.");
    }
  }

  const activeTickets = openTickets.filter((ticket) => ticket.status !== "Resolvido");
  const latestDecision = [...(conversation?.messages ?? [])].reverse().find((message) => message.decision);

  return (
    <div className="workspace">
      <aside className="employee-sidebar">
        <div className="sidebar-brand">
          <div className="brand-symbol"><Command size={16} strokeWidth={2.6} /></div>
          <span>nexo<span className="brand-dot">.</span></span>
          <span className="sidebar-product">assist</span>
        </div>
        <button type="button" className="sidebar-context"><div className="workspace-icon"><Laptop size={16} /></div><span><strong>Workspace</strong><small>Service desk</small></span><ChevronDown size={14} /></button>
        <div className="sidebar-label">ATENDIMENTO</div>
        <button type="button" className={`nav-item ${mode === "chat" ? "nav-item-active" : ""}`} onClick={() => setMode("chat")}><MessageCircle size={17} /><span>Assistente</span><span className="nav-shortcut">⌘ 1</span></button>
        <button type="button" className={`nav-item ${mode === "tickets" ? "nav-item-active" : ""}`} onClick={() => setMode("tickets")}><TicketCheck size={17} /><span>Meus chamados</span>{overdueCount > 0 && <span className="nav-count">{overdueCount}</span>}</button>
        <div className="sidebar-list-heading"><span>CONVERSAS RECENTES</span><button type="button" title="Nova conversa" onClick={newConversation}><Plus size={15} /></button></div>
        <div className="conversation-list">
          {conversations.map((item) => (
            <button type="button" key={item.id} className={`conversation-link ${conversation?.id === item.id ? "conversation-link-active" : ""}`} onClick={() => void selectConversation(item)}>
              <span className={`conversation-dot ${item.status}`} />
              <span className="conversation-text"><strong>{item.title}</strong><small>{item.messages[0]?.content.slice(0, 36) ?? statusLabel(item.status)}</small></span>
            </button>
          ))}
        </div>
        <div className="sidebar-help"><div className="help-mark"><LifeBuoy size={17} /></div><span><strong>Precisa de ajuda?</strong><small>Nosso time está por aqui.</small></span><ArrowUpRight size={14} /></div>
        <button type="button" className="sidebar-user" onClick={() => void signOut()}>
          <span className="employee-avatar-small">{initials(employee.name)}</span><span><strong>{employee.name}</strong><small>{employee.team}</small></span><LogOut size={15} />
        </button>
      </aside>

      <main className="employee-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Atendimento</span><ChevronRight size={14} /><strong>{mode === "chat" ? "Assistente" : "Meus chamados"}</strong></div>
          <div className="topbar-actions"><span className="availability"><i /> Todos os sistemas operacionais</span><button type="button" className="icon-button" title="Ajuda" onClick={() => { setMode("chat"); setContent("Qual é o horário do service desk?"); }}><CircleHelp size={17} /></button><button type="button" className="top-avatar" title={employee.name}>{initials(employee.name)}</button></div>
        </header>
        {error && <div className="toast error-toast" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}><X size={15} /></button></div>}
        {notice && <div className="toast notice-toast"><span>{notice}</span><button type="button" onClick={() => setNotice("")}><X size={15} /></button></div>}
        {loading ? <div className="loading-view"><LoaderCircle className="spin" size={24} /> Carregando seu atendimento...</div> : mode === "chat" ? (
          <div className="employee-content">
            <section className="chat-pane">
              <div className="chat-heading">
                <div className="chat-heading-title"><div className="assistant-mark"><Sparkles size={18} /></div><div><h1>Nexo Assist</h1><p>{conversation?.status === "waiting" ? "Na fila do service desk" : conversation?.status === "analyst" ? "Atendimento com analista" : "Seu parceiro de TI"} <span className={agentIsPaused ? "dot dot-waiting" : "dot"} /></p></div></div>
                <div className="chat-heading-controls"><span className={`session-status ${agentIsPaused ? "session-paused" : ""}`}><i /> {statusLabel(conversation?.status ?? "agent")}</span><button type="button" className="icon-button" title="Iniciar nova conversa" onClick={newConversation}><Plus size={17} /></button><button type="button" className="icon-button" title="Mais opções"><MoreHorizontal size={18} /></button></div>
              </div>
              <div className="message-scroll">
                <div className="conversation-date"><span /> HOJE, {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date()).toUpperCase()} <span /></div>
                {conversation?.messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    owner={employee}
                    tickets={openTickets}
                    activeDraftMessageId={activeDraftMessageId}
                    onConfirm={() => void send("Confirmo")}
                    onCancel={() => void send("Cancelar")}
                    sending={sending}
                  />
                ))}
                {sending && <div className="typing-indicator"><span className="message-avatar"><Sparkles size={15} /></span><span className="typing-dots"><i /><i /><i /></span><small>Nexo Assist está pensando</small></div>}
                {conversation?.messages.filter((message) => message.role === "employee").length === 0 && (
                  <div className="suggestion-block"><span>POR ONDE COMEÇAR?</span><div className="suggestion-grid">
                    <button type="button" onClick={() => void send("Quero consultar meus chamados")}><Search size={15} /> Consultar meus chamados <ArrowUpRight size={13} /></button>
                    <button type="button" onClick={() => void send("Como conecto à VPN?")}><CircleHelp size={15} /> Tenho uma dúvida de TI <ArrowUpRight size={13} /></button>
                    <button type="button" onClick={() => setContent("Meu notebook não funciona e não consigo trabalhar")}><Monitor size={15} /> Preciso de suporte <ArrowUpRight size={13} /></button>
                    <button type="button" onClick={() => void send("Quero falar com um analista")}><Headphones size={15} /> Falar com um analista <ArrowUpRight size={13} /></button>
                  </div></div>
                )}
                <div ref={endRef} />
              </div>
              <form className={`composer ${isPaused ? "composer-disabled" : ""}`} onSubmit={(event) => { event.preventDefault(); void send(); }}>
                {isPaused ? (
                  <div className="paused-composer"><Headphones size={17} /><span>{conversation?.status === "waiting" ? "Sua conversa está na fila do service desk. O Nexo Assist está pausado." : "Esta conversa foi encerrada. Inicie uma nova para continuar."}</span></div>
                ) : (
                  <>
                    <textarea
                      ref={inputRef}
                      rows={1}
                      maxLength={2000}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={isHumanHandling ? "Escreva uma mensagem para o analista..." : "Escreva sua mensagem..."}
                      aria-label="Mensagem para o Nexo Assist"
                    />
                    <div className="composer-bottom"><button type="button" className="composer-attach" title="Anexos indisponíveis nesta demonstração"><Paperclip size={16} /></button><span><kbd>↵</kbd> para enviar · <kbd>⇧ ↵</kbd> nova linha <small>{usedMessages}/30</small></span><button type="submit" className="send-button" disabled={!content.trim() || sending}><Send size={15} /></button></div>
                  </>
                )}
              </form>
              <p className="chat-disclaimer"><ShieldCheck size={12} /> O Nexo Assist pode cometer erros. Confira o rascunho antes de confirmar.</p>
            </section>

            <aside className="context-pane">
              <div className="context-header"><div><span className="eyebrow muted">SEU ATENDIMENTO</span><h2>Visão geral</h2></div><button type="button" className="icon-button" title="Mais opções"><MoreHorizontal size={17} /></button></div>
              <div className="overview-card"><div className="overview-card-top"><div className="overview-icon"><TicketCheck size={16} /></div><span>{activeTickets.length} EM ABERTO</span></div><strong>{overdueCount ? `${overdueCount} chamado${overdueCount === 1 ? "" : "s"} com prazo vencido` : "Tudo em dia por aqui"}</strong><p>{activeTickets.length ? "Acompanhe seus chamados sem sair desta conversa." : "Seus chamados ativos vão aparecer aqui."}</p><button type="button" className="overview-link" onClick={() => setMode("tickets")}>Ver meus chamados <ArrowUpRight size={13} /></button></div>
              <div className="context-section-heading"><span>CHAMADOS RECENTES</span><button type="button" onClick={() => setMode("tickets")}>Ver todos <ChevronRight size={13} /></button></div>
              <div className="recent-ticket-list">
                {activeTickets.slice(0, 3).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} compact onSelect={() => { setMode("tickets"); }} />)}
                {activeTickets.length === 0 && <div className="empty-sidebar"><FilePlus2 size={19} /><span>Você não tem chamados em aberto.</span></div>}
              </div>
              <div className="decision-preview"><div className="decision-preview-head"><div className="decision-mini-icon"><Activity size={14} /></div><span>DECISÃO RECENTE</span></div>{latestDecision ? <><strong>{latestDecision.decision?.action}</strong><p>{latestDecision.decision?.reason}</p><span className="confidence-pill">{Math.round((latestDecision.decision?.confidence ?? 0) * 100)}% de confiança</span></> : <p>Aqui você acompanha o que o assistente entendeu e por que escolheu cada ação.</p>}</div>
              <div className="privacy-note"><LockKeyhole size={13} /><span>Seus dados são privados e só você e o time de suporte podem acessar seus chamados.</span></div>
            </aside>
          </div>
        ) : (
          <div className="tickets-page">
            <div className="page-title-row"><div><span className="eyebrow muted">ACOMPANHAMENTO</span><h1>Meus chamados</h1><p>Acompanhe cada solicitação e o prazo de atendimento.</p></div><button type="button" className="primary-button" onClick={() => { setMode("chat"); setContent(""); window.setTimeout(() => inputRef.current?.focus(), 50); }}><Plus size={16} /> Novo chamado</button></div>
            <div className="ticket-summary-grid"><div><span className="summary-icon"><Inbox size={16} /></span><small>EM ABERTO</small><strong>{activeTickets.length}</strong></div><div><span className="summary-icon summary-icon-alert"><Clock3 size={16} /></span><small>PRAZO VENCIDO</small><strong>{overdueCount}</strong></div><div><span className="summary-icon summary-icon-done"><CheckCircle2 size={16} /></span><small>RESOLVIDOS</small><strong>{openTickets.filter((ticket) => ticket.status === "Resolvido").length}</strong></div></div>
            <div className="tickets-table-wrap"><div className="tickets-table-head"><span>CHAMADO</span><span>STATUS</span><span>PRIORIDADE</span><span>ATUALIZADO</span></div>{activeTickets.map((ticket) => <div className="ticket-table-row" key={ticket.id}><div className="ticket-table-name"><span className="table-ticket-icon"><FileText size={15} /></span><span><strong>{ticket.title}</strong><small>{ticket.id} · {ticket.category}</small></span></div><span className={statusClass(ticket.status)}><i />{ticket.status}</span><span className={priorityClass(ticket.priority)}>{ticket.priority}</span><span className={isOverdue(ticket) ? "table-overdue" : "table-date"}>{isOverdue(ticket) ? "Prazo vencido" : formatDate(ticket.updatedAt)}</span></div>)}</div>
            <div className="ticket-history-heading"><h2>Histórico</h2><span>Chamados concluídos</span></div>
            {openTickets.filter((ticket) => ticket.status === "Resolvido").map((ticket) => <div className="resolved-row" key={ticket.id}><div><CheckCircle2 size={15} /><strong>{ticket.title}</strong><span>{ticket.id}</span></div><span>{ticket.status}</span><span>{formatDate(ticket.updatedAt)}</span></div>)}
            {openTickets.filter((ticket) => ticket.status === "Resolvido").length === 0 && <div className="empty-history">Seus chamados concluídos aparecerão aqui.</div>}
          </div>
        )}
      </main>
    </div>
  );
}

function AnalystWorkspace({
  employee,
  onLogout,
}: {
  employee: Employee;
  onLogout: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [owner, setOwner] = useState<Employee | undefined>();
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadQueue = useCallback(async (selected?: string) => {
    setLoading(true);
    setError("");
    try {
      const conversationResponse = await api.conversations();
      const items = conversationResponse.conversations;
      setConversations(items);
      const selectedConversation = items.find((item) => item.id === selected) ?? items.find((item) => item.status === "waiting") ?? items[0];
      if (selectedConversation) {
        const [detail, ticketResponse] = await Promise.all([
          api.conversation(selectedConversation.id),
          api.tickets(selectedConversation.ownerId),
        ]);
        setSelectedId(selectedConversation.id);
        setConversation(detail.conversation);
        setOwner(detail.owner);
        setTickets(ticketResponse.tickets);
      } else {
        setConversation(null);
        setSelectedId("");
        setOwner(undefined);
        setTickets([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadQueue(); }, [loadQueue]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages.length]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const conversationResponse = await api.conversations();
        if (!active) return;
        setConversations(conversationResponse.conversations);
        if (selectedId) {
          const current = conversationResponse.conversations.find((item) => item.id === selectedId);
          const [detail, ticketResponse] = await Promise.all([
            api.conversation(selectedId),
            current ? api.tickets(current.ownerId) : Promise.resolve({ tickets: [] }),
          ]);
          if (active) {
            setConversation(detail.conversation);
            setOwner(detail.owner);
            setTickets(ticketResponse.tickets);
          }
        } else {
          setTickets([]);
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a fila.");
      }
    };
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  const filtered = conversations.filter((item) => {
    if (filter === "all") return item.status !== "closed";
    return item.status === filter;
  });
  const ownerTickets = tickets.filter((ticket) => ticket.ownerId === conversation?.ownerId);

  async function signOut() {
    try {
      await api.logout();
      onLogout();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível encerrar a sessão.");
    }
  }

  async function select(item: ConversationSummary) {
    setError("");
    try {
      const [detail, ticketResponse] = await Promise.all([
        api.conversation(item.id),
        api.tickets(item.ownerId),
      ]);
      setSelectedId(item.id);
      setConversation(detail.conversation);
      setOwner(detail.owner);
      setTickets(ticketResponse.tickets);
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir a conversa.");
    }
  }

  async function perform(action: "take" | "return" | "close") {
    if (!conversation) return;
    setError("");
    setNotice("");
    try {
      const result = action === "take" ? await api.take(conversation.id) : action === "return" ? await api.returnToAgent(conversation.id) : await api.close(conversation.id);
      setConversation(result.conversation);
      setNotice(action === "take" ? "Atendimento assumido. O agente está pausado." : action === "return" ? "Conversa devolvida ao Nexo Assist." : "Atendimento encerrado.");
      await loadQueue(conversation.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o atendimento.");
    }
  }

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!conversation || !content.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await api.analystMessage(conversation.id, content.trim());
      setConversation(result.conversation);
      setContent("");
      await loadQueue(conversation.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a resposta.");
    } finally {
      setSending(false);
    }
  }

  const waitingCount = conversations.filter((item) => item.status === "waiting").length;
  const agentCount = conversations.filter((item) => item.status === "agent").length;
  const analystCount = conversations.filter((item) => item.status === "analyst").length;

  return (
    <div className="analyst-app">
      <header className="analyst-topbar">
        <div className="sidebar-brand analyst-brand"><div className="brand-symbol"><Command size={16} strokeWidth={2.6} /></div><span>nexo<span className="brand-dot">.</span></span><span className="sidebar-product">service desk</span></div>
        <div className="analyst-top-meta"><span><i /> Workspace de suporte</span><button type="button" className="analyst-profile" onClick={() => void signOut()}><span className="analyst-avatar-small">{initials(employee.name)}</span><span>{employee.name}</span><LogOut size={14} /></button></div>
      </header>
      {error && <div className="toast analyst-toast error-toast" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}><X size={15} /></button></div>}
      {notice && <div className="toast analyst-toast notice-toast"><span>{notice}</span><button type="button" onClick={() => setNotice("")}><X size={15} /></button></div>}
      <div className="analyst-body">
        <aside className="queue-panel">
          <div className="queue-title"><div><span className="eyebrow muted">OPERAÇÃO</span><h1>Fila de atendimento</h1><p>Conversas e chamados em tempo real.</p></div><button type="button" className="icon-button" title="Atualizar fila" onClick={() => void loadQueue(selectedId)}><Activity size={16} /></button></div>
          <div className="queue-stats"><div><span className="queue-stat-dot waiting" /><span>Aguardando</span><strong>{waitingCount}</strong></div><div><span className="queue-stat-dot active" /><span>Em atendimento</span><strong>{analystCount}</strong></div><div><span className="queue-stat-dot agent" /><span>Com o agent</span><strong>{agentCount}</strong></div></div>
          <div className="queue-filters">{([
            ["all", "Todas"],
            ["waiting", "Aguardando"],
            ["analyst", "Em atendimento"],
            ["closed", "Encerradas"],
          ] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? "filter-active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <div className="queue-list">
            {loading && <div className="queue-empty"><LoaderCircle size={18} className="spin" /> Carregando fila...</div>}
            {!loading && filtered.map((item) => (
              <button type="button" className={`queue-item ${selectedId === item.id ? "queue-item-selected" : ""}`} key={item.id} onClick={() => void select(item)}>
                <div className="queue-item-avatar">{initials(item.owner?.name ?? "Nexo")}</div>
                <div className="queue-item-main"><div className="queue-item-name"><strong>{item.owner?.name ?? "Funcionário"}</strong><time>{formatTime(item.updatedAt)}</time></div><p>{item.title}</p><div className="queue-item-bottom"><span className={`queue-status-badge queue-${item.status}`}>{statusLabel(item.status)}</span>{item.status === "waiting" && <span className="queue-priority"><i /> prioridade</span>}</div></div>
              </button>
            ))}
            {!loading && !filtered.length && <div className="queue-empty"><Inbox size={20} /><strong>Nenhuma conversa nesta fila</strong><span>As conversas aparecerão aqui quando alguém precisar de suporte.</span></div>}
          </div>
          <div className="queue-footer"><ShieldCheck size={14} /> Acesso restrito ao service desk</div>
        </aside>

        <main className="analyst-main">
          {!conversation || !owner ? <div className="analyst-empty"><div><Inbox size={25} /></div><h2>Selecione uma conversa</h2><p>Escolha uma solicitação na fila para ver o histórico e os chamados relacionados.</p></div> : (
            <>
              <header className="analyst-conversation-head"><div className="analyst-person"><div className="person-avatar">{initials(owner.name)}</div><div><div className="analyst-person-name"><h2>{owner.name}</h2><span className={`queue-status-badge queue-${conversation.status}`}>{statusLabel(conversation.status)}</span></div><p>{owner.team} <span>·</span> {owner.email}</p></div></div><div className="analyst-head-actions">{conversation.status === "waiting" && <button type="button" className="primary-button" onClick={() => void perform("take")}><CheckCircle2 size={15} /> Assumir conversa</button>}{conversation.status === "analyst" && <><button type="button" className="secondary-button" onClick={() => void perform("return")}><ArrowLeft size={15} /> Devolver ao agent</button><button type="button" className="close-button" onClick={() => void perform("close")}><Check size={15} /> Encerrar</button></>}</div></header>
              {conversation.transcriptSummary && <div className="handoff-banner"><div className="handoff-icon"><ArrowDown size={15} /></div><span><strong>Resumo da transferência</strong>{conversation.transcriptSummary}</span></div>}
              <div className="analyst-thread">
                <div className="conversation-date"><span /> HISTÓRICO DA CONVERSA <span /></div>
                {conversation.messages.map((message) => <ChatBubble key={message.id} message={message} owner={owner} tickets={ownerTickets} onConfirm={() => undefined} onCancel={() => undefined} sending={sending} />)}
                <div ref={endRef} />
              </div>
              <form className={`analyst-composer ${conversation.status !== "analyst" ? "analyst-composer-disabled" : ""}`} onSubmit={(event) => void reply(event)}>
                <textarea rows={2} placeholder={conversation.status === "analyst" ? "Escreva uma resposta para o funcionário..." : conversation.status === "closed" ? "Atendimento encerrado." : "Assuma a conversa para responder."} value={content} disabled={conversation.status !== "analyst"} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void reply(event); } }} />
                <div className="analyst-composer-bottom"><span><kbd>↵</kbd> enviar resposta</span><button type="submit" className="send-button" disabled={!content.trim() || sending || conversation.status !== "analyst"}><Send size={15} /></button></div>
              </form>
            </>
          )}
        </main>

        <aside className="analyst-detail">
          <div className="detail-heading"><div><span className="eyebrow muted">CONTEXTO</span><h2>Chamados do funcionário</h2></div><span className="detail-count">{ownerTickets.length}</span></div>
          {ownerTickets.length ? (
            <div className="analyst-ticket-list">
              {ownerTickets.map((ticket) => (
                <div key={ticket.id} className="analyst-ticket">
                  <TicketCard ticket={ticket} compact />
                  <div className="analyst-ticket-info">
                    <span>{ticket.type} <i>·</i> {ticket.category}</span>
                    <span>Atualizado {formatDate(ticket.updatedAt)}</span>
                    <p>{ticket.description}</p>
                    {ticket.history.slice(-2).map((entry) => (
                      <div className="ticket-history-entry" key={entry.at}>
                        <span>{formatDate(entry.at)} · {entry.author}</span>
                        <p>{entry.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-sidebar"><FileText size={19} /><span>Nenhum chamado vinculado.</span></div>}
          <div className="analyst-privacy-note"><LockKeyhole size={13} /> Visível apenas para o service desk.</div>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    api.me()
      .then(({ employee: current }) => setEmployee(current))
      .catch((caught: unknown) => {
        setEmployee(null);
        setStartupError(caught instanceof Error ? caught.message : "Não foi possível conectar ao servidor.");
      })
      .finally(() => setChecking(false));
  }, []);

  const logout = () => setEmployee(null);
  const login = (current: Employee) => {
    setStartupError("");
    setEmployee(current);
  };
  if (checking) return <div className="initial-loading"><div className="brand-symbol"><Command size={18} /></div><LoaderCircle size={20} className="spin" /></div>;
  if (!employee) return <LoginScreen onLogin={login} initialError={startupError} />;
  return employee.role === "analyst"
    ? <AnalystWorkspace employee={employee} onLogout={logout} />
    : <EmployeeWorkspace employee={employee} onLogout={logout} />;
}
