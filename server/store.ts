import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ChatMessage,
  Conversation,
  Database,
  Employee,
  KnowledgeArticle,
  Ticket,
  TicketDraft,
} from "./types";

const dataDirectory = path.resolve(process.cwd(), "data");
const runtimePath = path.join(dataDirectory, "runtime.json");
const employee: Employee = {
  id: "emp-ana",
  email: "ana.souza@nexo.com",
  name: "Ana Souza",
  team: "Produto",
  role: "employee",
};
const secondEmployee: Employee = {
  id: "emp-caio",
  email: "caio.mendes@nexo.com",
  name: "Caio Mendes",
  team: "Vendas",
  role: "employee",
};
const thirdEmployee: Employee = {
  id: "emp-luiza",
  email: "luiza.rocha@nexo.com",
  name: "Luiza Rocha",
  team: "Operações",
  role: "employee",
};
const analyst: Employee = {
  id: "analyst-marina",
  email: "marina.analista@nexo.com",
  name: "Marina Costa",
  team: "Service desk · N1",
  role: "analyst",
};
const now = Date.now();
const hoursFromNow = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();

const articles: KnowledgeArticle[] = [
  {
    id: "kb-vpn-809",
    title: "Erro 809 ao conectar à VPN",
    category: "Rede e VPN",
    keywords: ["vpn", "809", "conexao", "conexão", "windows"],
    content:
      "No Windows 10, reinstale o cliente de VPN pelo Portal de Softwares e reinicie o computador. Essa orientação vale apenas para Windows 10. Se você usa Windows 11 ou o erro continuar, abra um chamado para o time de Redes.",
  },
  {
    id: "kb-password",
    title: "Desbloquear senha de rede",
    category: "Acesso",
    keywords: ["senha", "bloqueada", "bloqueio", "login", "desbloquear"],
    content:
      "Acesse o portal de identidade da Nexo em id.nexo.com e selecione “Desbloquear conta”. Você precisará confirmar sua identidade pelo segundo fator. Se não tiver acesso ao segundo fator, podemos encaminhar seu caso ao service desk.",
  },
  {
    id: "kb-wifi",
    title: "Conectar ao Wi-Fi corporativo",
    category: "Rede e VPN",
    keywords: ["wifi", "wi-fi", "rede", "internet"],
    content:
      "Selecione a rede Nexo-Corp e entre com seu e-mail corporativo e senha de rede. Dispositivos novos precisam ser cadastrados pelo Portal de Acessos.",
  },
  {
    id: "kb-email",
    title: "Configurar e-mail no celular",
    category: "E-mail",
    keywords: ["email", "e-mail", "celular", "outlook", "mail"],
    content:
      "Instale o Outlook pela loja corporativa, adicione sua conta @nexo.com e aprove a solicitação de acesso no aplicativo de autenticação.",
  },
  {
    id: "kb-software",
    title: "Instalar um software aprovado",
    category: "Software",
    keywords: ["instalar", "software", "programa", "aplicativo", "portal"],
    content:
      "Abra o Portal de Softwares no menu Iniciar, pesquise pelo aplicativo e selecione “Instalar”. Softwares que exigem licença ou aprovação precisam de um chamado do tipo requisição.",
  },
  {
    id: "kb-printer",
    title: "Adicionar impressora do escritório",
    category: "Hardware",
    keywords: ["impressora", "imprimir", "printer"],
    content:
      "Conecte-se à rede Nexo-Corp e adicione a impressora pelo Catálogo de Dispositivos. Se a impressora não aparecer, informe o andar e o nome da sala em um chamado.",
  },
  {
    id: "kb-hours",
    title: "Horário do service desk",
    category: "Outros",
    keywords: ["horario", "horário", "atendimento", "plantao", "plantão"],
    content:
      "O service desk atende de segunda a sexta-feira, das 8h às 18h. Chamados críticos contam com plantão 24 horas.",
  },
  {
    id: "kb-monitor",
    title: "Solicitar equipamento",
    category: "Hardware",
    keywords: ["monitor", "notebook", "equipamento", "mouse", "teclado"],
    content:
      "Equipamentos adicionais são solicitados pelo chat do Nexo Assist. Informe o equipamento desejado e a justificativa para receber uma previsão de atendimento.",
  },
];

function initialDatabase(): Database {
  const tickets: Ticket[] = [
    {
      id: "INC-20311",
      ownerId: employee.id,
      title: "Notebook lento após atualização do Windows",
      description: "O notebook ficou muito lento depois da última atualização.",
      type: "INC",
      category: "Hardware",
      priority: "Média",
      status: "Em atendimento",
      assignee: "Rafael Lima",
      affectedPeople: 1,
      createdAt: hoursAgo(144),
      updatedAt: hoursAgo(30),
      dueAt: hoursAgo(72),
      history: [
        { at: hoursAgo(144), author: employee.name, text: "Chamado aberto pelo portal." },
        { at: hoursAgo(30), author: "Rafael Lima", text: "Analisando o desempenho do equipamento." },
      ],
    },
    {
      id: "REQ-10442",
      ownerId: employee.id,
      title: "Segundo monitor para home office",
      description: "Solicitação de monitor adicional para trabalho remoto.",
      type: "REQ",
      category: "Hardware",
      priority: "Baixa",
      status: "Aprovado",
      assignee: "Service desk",
      affectedPeople: 1,
      createdAt: hoursAgo(192),
      updatedAt: hoursAgo(18),
      dueAt: hoursFromNow(96),
      history: [{ at: hoursAgo(18), author: "Service desk", text: "Solicitação aprovada." }],
    },
    {
      id: "INC-20150",
      ownerId: employee.id,
      title: "Senha do SAP bloqueada",
      description: "Acesso ao SAP bloqueado após tentativas de login.",
      type: "INC",
      category: "Acesso",
      priority: "Média",
      status: "Resolvido",
      assignee: "Beatriz Alves",
      affectedPeople: 1,
      createdAt: hoursAgo(120),
      updatedAt: hoursAgo(72),
      dueAt: hoursAgo(96),
      history: [
        { at: hoursAgo(120), author: employee.name, text: "Chamado aberto pelo portal." },
        { at: hoursAgo(72), author: "Beatriz Alves", text: "Senha redefinida e acesso validado." },
      ],
    },
    {
      id: "INC-20408",
      ownerId: secondEmployee.id,
      title: "VPN indisponível para equipe comercial",
      description: "Equipe de vendas não consegue acessar os sistemas pela VPN.",
      type: "INC",
      category: "Rede e VPN",
      priority: "Crítica",
      status: "Aguardando analista",
      assignee: "Service desk · N2",
      affectedPeople: 14,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(1),
      dueAt: hoursFromNow(-1),
      history: [{ at: hoursAgo(2), author: "Caio Mendes", text: "Quatorze pessoas estão sem acesso à VPN." }],
    },
    {
      id: "REQ-10319",
      ownerId: thirdEmployee.id,
      title: "Acesso ao Figma",
      description: "Solicitação de acesso ao workspace de Design.",
      type: "REQ",
      category: "Acesso",
      priority: "Baixa",
      status: "Resolvido",
      assignee: "Service desk",
      affectedPeople: 1,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(24),
      dueAt: hoursFromNow(48),
      history: [{ at: hoursAgo(24), author: "Service desk", text: "Acesso concedido." }],
    },
  ];
  const waitingConversation: Conversation = {
    id: "conv-demo-escalation",
    ownerId: secondEmployee.id,
    title: "VPN indisponível para equipe comercial",
    status: "waiting",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1),
    transcriptSummary: "VPN indisponível para 14 pessoas do time de Vendas; chamados críticos foram escalados para N2.",
    messages: [
      {
        id: "msg-demo-1",
        role: "employee",
        content: "A VPN caiu para todo o time de vendas, somos 14 pessoas sem conseguir acessar os sistemas.",
        createdAt: hoursAgo(2),
      },
      {
        id: "msg-demo-2",
        role: "agent",
        content:
          "Entendi. Como o problema afeta uma equipe inteira e impede o trabalho, classifiquei como crítico e acionei o plantão. Um analista vai assumir esta conversa.",
        createdAt: hoursAgo(1),
        actions: ["Classificou impacto e urgência", "Consultou chamados", "Transferiu para o service desk"],
        decision: {
          intent: "incidente crítico",
          action: "transferência para analista",
          confidence: 0.96,
          reason: "14 pessoas de uma equipe estão sem acesso a um serviço essencial; incidente crítico conforme a política.",
          toolCalls: ["tickets.search", "tickets.create", "conversations.transfer"],
          sources: ["Política de prioridade · Anexo A"],
        },
        ticketIds: ["INC-20408"],
      },
    ],
  };
  return {
    employees: [employee, secondEmployee, thirdEmployee, analyst],
    tickets,
    conversations: [waitingConversation],
    articles,
  };
}

let database: Database | undefined;
let writeQueue: Promise<void> = Promise.resolve();

export async function initializeStore(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    const raw = await readFile(runtimePath, "utf8");
    database = JSON.parse(raw) as Database;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Não foi possível ler o banco local: ${String(error)}`);
    }
    database = initialDatabase();
    await persist();
  }
}

function db(): Database {
  if (!database) throw new Error("O banco local ainda não foi inicializado.");
  return database;
}

async function persist(): Promise<void> {
  const serialized = JSON.stringify(db(), null, 2);
  const temporaryPath = `${runtimePath}.tmp`;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await writeFile(temporaryPath, serialized, "utf8");
      await rename(temporaryPath, runtimePath);
    });
  await writeQueue;
}

export function getEmployee(email: string): Employee | undefined {
  return db().employees.find((person) => person.email.toLowerCase() === email.toLowerCase());
}

export function getEmployeeById(id: string): Employee | undefined {
  return db().employees.find((person) => person.id === id);
}

export function listEmployees(): Employee[] {
  return db().employees;
}

export function listArticles(): KnowledgeArticle[] {
  return db().articles;
}

export function listTickets(ownerId?: string): Ticket[] {
  return db().tickets.filter((ticket) => !ownerId || ticket.ownerId === ownerId);
}

export function getTicket(id: string): Ticket | undefined {
  return db().tickets.find((ticket) => ticket.id === id);
}

export function listConversations(ownerId?: string): Conversation[] {
  return db()
    .conversations.filter((conversation) => !ownerId || conversation.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation(id: string): Conversation | undefined {
  return db().conversations.find((conversation) => conversation.id === id);
}

export async function createConversation(ownerId: string, name: string): Promise<Conversation> {
  const at = new Date().toISOString();
  const conversation: Conversation = {
    id: randomUUID(),
    ownerId,
    title: "Nova conversa",
    status: "agent",
    createdAt: at,
    updatedAt: at,
    messages: [
      {
        id: randomUUID(),
        role: "agent",
        content: `Oi, ${name.split(" ")[0]}! Sou o Nexo Assist. Posso tirar uma dúvida, consultar ou atualizar um chamado, ou abrir um novo. Como posso ajudar?`,
        createdAt: at,
        actions: ["Sessão iniciada"],
      },
    ],
  };
  db().conversations.push(conversation);
  await persist();
  return conversation;
}

export async function appendMessage(
  conversation: Conversation,
  message: ChatMessage,
): Promise<void> {
  conversation.messages.push(message);
  conversation.updatedAt = message.createdAt;
  if (message.role === "employee" && conversation.title === "Nova conversa") {
    conversation.title = message.content.slice(0, 62);
  }
  await persist();
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  conversation.updatedAt = new Date().toISOString();
  await persist();
}

export async function createTicket(ownerId: string, draft: TicketDraft): Promise<Ticket> {
  const at = new Date().toISOString();
  const ticket: Ticket = {
    id: `${draft.type}-${String(
      db().tickets.reduce((max, existing) => {
        if (existing.type !== draft.type) return max;
        const number = Number(existing.id.split("-")[1]);
        return Number.isFinite(number) ? Math.max(max, number) : max;
      }, draft.type === "INC" ? 20500 : 10500) + 1,
    )}`,
    ownerId,
    title: draft.title,
    description: draft.description,
    type: draft.type,
    category: draft.category,
    priority: draft.priority,
    status: "Aberto",
    assignee: "Service desk · N1",
    affectedPeople: draft.affectedPeople,
    createdAt: at,
    updatedAt: at,
    dueAt: dueDate(draft.priority, at),
    history: [{ at, author: "Nexo Assist", text: "Chamado criado após confirmação da pessoa solicitante." }],
  };
  db().tickets.push(ticket);
  await persist();
  return ticket;
}

export async function updateTicket(id: string, text: string, author: string): Promise<Ticket | undefined> {
  const ticket = getTicket(id);
  if (!ticket) return undefined;
  const at = new Date().toISOString();
  const previousUpdatedAt = ticket.updatedAt;
  ticket.description = `${ticket.description}\n\nAtualização: ${text}`;
  ticket.updatedAt = at;
  ticket.dueAt = dueDate(ticket.priority, at);
  if (
    ticket.status === "Resolvido" &&
    Date.now() - Date.parse(previousUpdatedAt) <= 7 * 24 * 60 * 60 * 1000
  ) {
    ticket.status = "Aberto";
  }
  ticket.history.push({ at, author, text: `Complemento: ${text}` });
  await persist();
  return ticket;
}

export async function updateTicketStatus(
  id: string,
  status: Ticket["status"],
  author: string,
): Promise<Ticket | undefined> {
  const ticket = getTicket(id);
  if (!ticket) return undefined;
  const at = new Date().toISOString();
  ticket.status = status;
  ticket.updatedAt = at;
  ticket.history.push({ at, author, text: `Status atualizado para ${status}.` });
  await persist();
  return ticket;
}

export async function addConversationMessage(
  conversation: Conversation,
  role: ChatMessage["role"],
  content: string,
): Promise<ChatMessage> {
  const message: ChatMessage = { id: randomUUID(), role, content, createdAt: new Date().toISOString() };
  conversation.messages.push(message);
  conversation.updatedAt = message.createdAt;
  await persist();
  return message;
}

export function makeMessage(
  content: string,
  options: Omit<ChatMessage, "id" | "role" | "content" | "createdAt"> & { role?: ChatMessage["role"] } = {},
): ChatMessage {
  const { role = "agent", ...metadata } = options;
  return { id: randomUUID(), role, content, createdAt: new Date().toISOString(), ...metadata };
}

export function dueDate(priority: Ticket["priority"], from: string): string {
  const hours: Record<Ticket["priority"], number> = {
    Crítica: 1,
    Alta: 4,
    Média: 72,
    Baixa: 120,
  };
  return new Date(Date.parse(from) + hours[priority] * 60 * 60 * 1000).toISOString();
}
