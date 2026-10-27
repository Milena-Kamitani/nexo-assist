export type EmployeeRole = "employee" | "analyst";
export type TicketType = "INC" | "REQ";
export type TicketCategory =
  | "Acesso"
  | "Rede e VPN"
  | "Hardware"
  | "Software"
  | "E-mail"
  | "Outros";
export type TicketPriority = "Crítica" | "Alta" | "Média" | "Baixa";
export type TicketStatus =
  | "Aberto"
  | "Em atendimento"
  | "Aguardando analista"
  | "Resolvido"
  | "Aprovado";
export type ConversationStatus = "agent" | "waiting" | "analyst" | "closed";
export type MessageRole = "employee" | "agent" | "analyst" | "system";
export type PendingAction = "create" | "update";

export interface Employee {
  id: string;
  email: string;
  name: string;
  team: string;
  role: EmployeeRole;
}

export interface TicketHistoryEntry {
  at: string;
  author: string;
  text: string;
}

export interface Ticket {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: TicketType;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  affectedPeople: number;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  history: TicketHistoryEntry[];
}

export interface TicketDraft {
  action: PendingAction;
  title: string;
  description: string;
  type: TicketType;
  category: TicketCategory;
  priority: TicketPriority;
  affectedPeople: number;
  existingTicketId?: string;
  missing: string[];
}

export interface AgentDecision {
  intent: string;
  action: string;
  confidence: number;
  reason: string;
  toolCalls: string[];
  sources: string[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  actions?: string[];
  decision?: AgentDecision;
  ticketIds?: string[];
  draft?: TicketDraft;
}

export interface Conversation {
  id: string;
  ownerId: string;
  assignedAnalystId?: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pendingDraft?: TicketDraft;
  transcriptSummary?: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: TicketCategory;
  keywords: string[];
  content: string;
}

export interface Database {
  employees: Employee[];
  tickets: Ticket[];
  conversations: Conversation[];
  articles: KnowledgeArticle[];
}
