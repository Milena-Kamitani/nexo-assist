import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { runAgent } from "./agent";
import {
  addConversationMessage,
  appendMessage,
  createConversation,
  createTicket,
  getConversation,
  getEmployee,
  getEmployeeById,
  getTicket,
  initializeStore,
  listArticles,
  listConversations,
  listTickets,
  makeMessage,
  saveConversation,
  updateTicket,
} from "./store";
import type { Conversation, Employee } from "./types";

declare global {
  namespace Express {
    interface Request {
      employee?: Employee;
    }
  }
}

const app = express();
const port = Number(process.env.PORT ?? 3001);
const cookieName = "nexo_session";
const sessionSecret =
  process.env.SESSION_SECRET ?? "local-development-secret-do-not-use-in-production";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("Defina SESSION_SECRET antes de iniciar em produção.");
}

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

function sign(value: string): string {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createSession(employeeId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ employeeId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sessionEmployee(token: unknown): Employee | undefined {
  if (typeof token !== "string") return undefined;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return undefined;
  const payload = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(payload));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined;
  try {
    const parsed: { employeeId: string; expiresAt: number } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (parsed.expiresAt <= Date.now()) return undefined;
    return getEmployeeById(parsed.employeeId);
  } catch {
    return undefined;
  }
}

function authenticate(request: Request, response: Response, next: NextFunction): void {
  const employee = sessionEmployee(request.cookies[cookieName]);
  if (!employee) {
    response.status(401).json({ error: "Sua sessão expirou. Entre novamente para continuar." });
    return;
  }
  request.employee = employee;
  next();
}

function requireRole(role: Employee["role"]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.employee?.role !== role) {
      response.status(403).json({ error: "Você não tem permissão para realizar esta ação." });
      return;
    }
    next();
  };
}

function requireString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function routeId(request: Request): string {
  const id = request.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id;
}

function actionLabel(tool: string): string {
  const labels: Record<string, string> = {
    "knowledge.search": "Consultou a central de ajuda",
    "tickets.list": "Consultou seus chamados",
    "tickets.search": "Verificou chamados parecidos",
    "tickets.classify": "Classificou tipo e prioridade",
    "tickets.create": "Criou o chamado",
    "tickets.update": "Atualizou o chamado",
    "tickets.update (aguardando confirmação)": "Preparou atualização",
    "tickets.commit": "Registrou a alteração",
    "sla.check": "Verificou o prazo",
    "sla.estimate": "Calculou o prazo",
    "conversations.transfer": "Encaminhou para o analista",
  };
  return labels[tool] ?? tool;
}

function conversationFor(
  request: Request,
  response: Response,
  id: string,
): Conversation | undefined {
  const conversation = getConversation(id);
  if (!conversation) {
    response.status(404).json({ error: "Conversa não encontrada." });
    return undefined;
  }
  if (request.employee?.role !== "analyst" && conversation.ownerId !== request.employee?.id) {
    response.status(404).json({ error: "Conversa não encontrada." });
    return undefined;
  }
  return conversation;
}

app.get("/api/me", (request, response) => {
  response.json({ employee: sessionEmployee(request.cookies[cookieName]) ?? null });
});

app.post("/api/auth/login", (request, response) => {
  const { email, password } = request.body as { email?: unknown; password?: unknown };
  if (!requireString(email) || !requireString(password)) {
    response.status(400).json({ error: "Informe seu e-mail corporativo e uma senha." });
    return;
  }
  const employee = getEmployee(email.trim());
  if (!employee) {
    response.status(401).json({
      error: "E-mail não cadastrado. Use uma das contas de demonstração exibidas na tela.",
    });
    return;
  }
  response.cookie(cookieName, createSession(employee.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  response.json({ employee });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", path: "/" });
  response.status(204).end();
});

app.get("/api/conversations", authenticate, (request, response) => {
  const employee = request.employee!;
  const conversations = listConversations(employee.role === "analyst" ? undefined : employee.id).map(
    (conversation) => ({
      ...conversation,
      owner: getEmployeeById(conversation.ownerId),
      messages: conversation.messages.slice(-1),
    }),
  );
  response.json({ conversations });
});

app.post("/api/conversations", authenticate, requireRole("employee"), async (request, response) => {
  const employee = request.employee!;
  const conversation = await createConversation(employee.id, employee.name);
  response.status(201).json({ conversation });
});

app.get("/api/conversations/:id", authenticate, (request, response) => {
  const conversation = conversationFor(request, response, routeId(request));
  if (!conversation) return;
  response.json({
    conversation,
    owner: getEmployeeById(conversation.ownerId),
    tickets: listTickets(conversation.ownerId),
  });
});

app.post(
  "/api/conversations/:id/messages",
  authenticate,
  requireRole("employee"),
  async (request, response) => {
    const employee = request.employee!;
    const conversation = conversationFor(request, response, routeId(request));
    if (!conversation) return;
    if (conversation.status === "waiting" || conversation.status === "closed") {
      response.status(409).json({
        error:
          conversation.status === "waiting"
            ? "Sua conversa está na fila do service desk. O agent está pausado até um analista assumir."
            : "Esta conversa está encerrada. Inicie uma nova para continuar.",
      });
      return;
    }
    const { content } = request.body as { content?: unknown };
    if (!requireString(content)) {
      response.status(400).json({ error: "Escreva uma mensagem antes de enviar." });
      return;
    }
    if (content.trim().length > 2000) {
      response.status(413).json({ error: "A mensagem deve ter no máximo 2.000 caracteres." });
      return;
    }
    const sentCount = conversation.messages.filter((message) => message.role === "employee").length;
    if (sentCount >= 30) {
      response.status(429).json({
        error: "Esta conversa atingiu o limite de 30 mensagens. Inicie uma nova conversa para continuar.",
      });
      return;
    }
    await appendMessage(
      conversation,
      makeMessage(content.trim(), { role: "employee" }),
    );
    if (conversation.status === "analyst") {
      response.json({ conversation });
      return;
    }

    const result = await runAgent({
      message: content.trim(),
      employeeId: employee.id,
      employeeName: employee.name,
      tickets: listTickets(employee.id),
      articles: listArticles(),
      pendingDraft: conversation.pendingDraft,
    });
    const assistantMessage = makeMessage(result.reply, {
      role: "agent",
      actions: result.decision.toolCalls.map(actionLabel),
      decision: result.decision,
      ticketIds: result.ticketIds,
      ...(result.draft ? { draft: result.draft } : {}),
    });
    let updatedTicketId: string | undefined;

    if (result.clearPending && result.draft) {
      const draft = result.draft;
      if (draft.action === "create") {
        const ticket = await createTicket(employee.id, draft);
        updatedTicketId = ticket.id;
        assistantMessage.ticketIds = [ticket.id];
        assistantMessage.content = `Chamado ${ticket.id} criado com sucesso. Você pode acompanhar o status por aqui.`;
        assistantMessage.draft = undefined;
      } else if (draft.existingTicketId) {
        const existingTicket = getTicket(draft.existingTicketId);
        if (!existingTicket || existingTicket.ownerId !== employee.id) {
          response.status(404).json({ error: "Não encontrei esse chamado no seu perfil." });
          return;
        }
        const ticket = await updateTicket(draft.existingTicketId, draft.description, employee.name);
        if (!ticket) {
          response.status(404).json({ error: "Não foi possível atualizar o chamado selecionado." });
          return;
        }
        updatedTicketId = ticket.id;
        assistantMessage.ticketIds = [ticket.id];
        assistantMessage.content = `Chamado ${ticket.id} atualizado. O novo contexto já está disponível para o analista responsável.`;
        assistantMessage.draft = undefined;
      }
      conversation.pendingDraft = undefined;
    } else if (result.clearPending) {
      conversation.pendingDraft = undefined;
    } else {
      conversation.pendingDraft = result.draft;
    }

    if (result.transfer || (updatedTicketId && result.draft?.priority === "Crítica")) {
      conversation.status = "waiting";
      conversation.transcriptSummary = [
        `Pessoa: ${employee.name} (${employee.team})`,
        `Motivo: ${conversation.title}`,
        `Resumo: ${conversation.messages
          .slice(-6)
          .map((message) => `${message.role}: ${message.content}`)
          .join(" | ")}`,
        ...(updatedTicketId ? [`Chamado: ${updatedTicketId}`] : []),
      ].join("\n");
      if (updatedTicketId) {
        assistantMessage.content +=
          "\n\nComo o impacto é crítico, encaminhei o caso para o plantão. O agent ficará pausado até um analista responder.";
      }
    }
    if (updatedTicketId) {
      assistantMessage.decision = {
        ...assistantMessage.decision!,
        toolCalls: [...assistantMessage.decision!.toolCalls, "tickets.commit"],
      };
    }
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = assistantMessage.createdAt;
    await saveConversation(conversation);
    const tickets = listTickets(employee.id);
    const updatedTicket = updatedTicketId
      ? tickets.find((ticket) => ticket.id === updatedTicketId)
      : undefined;
    response.json({ conversation, message: assistantMessage, ticket: updatedTicket });
  },
);

app.get("/api/tickets", authenticate, (request, response) => {
  if (request.employee?.role === "analyst") {
    const ownerId = request.query.ownerId;
    if (typeof ownerId !== "string" || !ownerId.trim()) {
      response.json({ tickets: [] });
      return;
    }
    response.json({ tickets: listTickets(ownerId) });
    return;
  }
  response.json({ tickets: listTickets(request.employee!.id) });
});

app.post(
  "/api/analyst/conversations/:id/take",
  authenticate,
  requireRole("analyst"),
  async (request, response) => {
    const analyst = request.employee!;
    const conversation = conversationFor(request, response, routeId(request));
    if (!conversation) return;
    if (conversation.status !== "waiting") {
      response.status(409).json({ error: "Só é possível assumir uma conversa aguardando analista." });
      return;
    }
    conversation.status = "analyst";
    conversation.assignedAnalystId = analyst.id;
    await addConversationMessage(conversation, "system", `${analyst.name} assumiu o atendimento. O Nexo Assist está pausado.`);
    response.json({ conversation });
  },
);

app.post(
  "/api/analyst/conversations/:id/return",
  authenticate,
  requireRole("analyst"),
  async (request, response) => {
    const conversation = conversationFor(request, response, routeId(request));
    if (!conversation) return;
    if (conversation.status !== "analyst") {
      response.status(409).json({ error: "A conversa não está em atendimento por um analista." });
      return;
    }
    if (conversation.assignedAnalystId !== request.employee?.id) {
      response.status(403).json({ error: "Esta conversa está sendo atendida por outro analista." });
      return;
    }
    conversation.status = "agent";
    conversation.assignedAnalystId = undefined;
    await addConversationMessage(conversation, "system", "O analista devolveu a conversa ao Nexo Assist.");
    response.json({ conversation });
  },
);

app.post(
  "/api/analyst/conversations/:id/close",
  authenticate,
  requireRole("analyst"),
  async (request, response) => {
    const conversation = conversationFor(request, response, routeId(request));
    if (!conversation) return;
    if (conversation.status !== "analyst") {
      response.status(409).json({ error: "Assuma a conversa antes de encerrá-la." });
      return;
    }
    if (conversation.assignedAnalystId !== request.employee?.id) {
      response.status(403).json({ error: "Esta conversa está sendo atendida por outro analista." });
      return;
    }
    conversation.status = "closed";
    conversation.assignedAnalystId = undefined;
    await addConversationMessage(conversation, "system", "O analista encerrou este atendimento.");
    response.json({ conversation });
  },
);

app.post(
  "/api/analyst/conversations/:id/messages",
  authenticate,
  requireRole("analyst"),
  async (request, response) => {
    const conversation = conversationFor(request, response, routeId(request));
    if (!conversation) return;
    if (conversation.status !== "analyst") {
      response.status(409).json({ error: "Assuma a conversa antes de responder." });
      return;
    }
    if (conversation.assignedAnalystId !== request.employee?.id) {
      response.status(403).json({ error: "Esta conversa está sendo atendida por outro analista." });
      return;
    }
    const { content } = request.body as { content?: unknown };
    if (!requireString(content) || content.trim().length > 2000) {
      response.status(400).json({ error: "Escreva uma mensagem de até 2.000 caracteres." });
      return;
    }
    const message = await addConversationMessage(conversation, "analyst", content.trim());
    response.json({ message, conversation });
  },
);

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "Rota da API não encontrada." });
});

if (process.env.NODE_ENV === "production") {
  const webDirectory = path.resolve(process.cwd(), "dist");
  app.use(express.static(webDirectory));
  app.get("/{*path}", (_request, response, next) => {
    response.sendFile(path.join(webDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error("Erro inesperado na API:", error);
  response.status(500).json({ error: "Ocorreu um erro interno. Tente novamente em instantes." });
});

await initializeStore();
app.listen(port, () => {
  console.log(`Nexo Assist API disponível em http://localhost:${port}`);
});
