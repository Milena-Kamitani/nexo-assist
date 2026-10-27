import { describe, expect, it } from "vitest";
import { runAgent } from "../server/agent";
import type { KnowledgeArticle, Ticket, TicketDraft } from "../server/types";

const employeeId = "employee-a";
const articles: KnowledgeArticle[] = [
  {
    id: "vpn-809",
    title: "Erro 809 na VPN",
    category: "Rede e VPN",
    keywords: ["vpn", "809", "windows"],
    content: "No Windows 10, reinstale o cliente pelo Portal de Softwares.",
  },
  {
    id: "hours",
    title: "Horário do service desk",
    category: "Outros",
    keywords: ["horário", "atendimento"],
    content: "De segunda a sexta, das 8h às 18h.",
  },
];
const ticket: Ticket = {
  id: "INC-20311",
  ownerId: employeeId,
  title: "Notebook lento",
  description: "O notebook ficou lento após atualização.",
  type: "INC",
  category: "Hardware",
  priority: "Média",
  status: "Em atendimento",
  assignee: "Service desk",
  affectedPeople: 1,
  createdAt: "2026-10-20T08:00:00.000Z",
  updatedAt: "2026-10-20T08:00:00.000Z",
  dueAt: "2026-11-01T08:00:00.000Z",
  history: [],
};
const hiddenTicket: Ticket = { ...ticket, id: "INC-20999", ownerId: "employee-b", title: "Notebook quebrado" };

function input(message: string, extra: Partial<Parameters<typeof runAgent>[0]> = {}) {
  return {
    message,
    employeeId,
    employeeName: "Ana Souza",
    tickets: [ticket],
    articles,
    ...extra,
  };
}

describe("Nexo Assist routing", () => {
  it("answers known IT questions from the help center without opening a ticket", async () => {
    const result = await runAgent(input("Como resolvo o erro 809 da VPN no Windows?"));

    expect(result.decision.action).toBe("buscar na central de ajuda");
    expect(result.reply).toContain("Portal de Softwares");
    expect(result.decision.sources).toContain("Central de ajuda · Erro 809 na VPN");
    expect(result.ticketIds).toEqual([]);
  });

  it("answers service desk hours instead of mistaking the phrase for a transfer request", async () => {
    const result = await runAgent(input("Qual é o horário do service desk?"));

    expect(result.decision.action).toBe("buscar na central de ajuda");
    expect(result.reply).toContain("das 8h às 18h");
    expect(result.transfer).toBeUndefined();
  });

  it("consults only the authenticated employee's tickets and automatically escalates overdue cases", async () => {
    const overdueTicket: Ticket = { ...ticket, dueAt: "2026-10-26T08:00:00.000Z" };
    const result = await runAgent(
      input("Quero consultar meus chamados", { tickets: [overdueTicket, hiddenTicket] }),
    );

    expect(result.ticketIds).toEqual([ticket.id]);
    expect(result.reply).toContain(ticket.id);
    expect(result.reply).not.toContain(hiddenTicket.id);
    expect(result.transfer).toBe(true);
    expect(result.decision.toolCalls).toContain("tickets.list");
  });

  it("prepares a confirmed draft and calculates a critical priority for team-wide impact", async () => {
    const result = await runAgent(
      input("A VPN caiu para a equipe inteira e ninguém consegue trabalhar"),
    );

    expect(result.draft).toMatchObject({
      action: "create",
      type: "INC",
      category: "Rede e VPN",
      priority: "Crítica",
      affectedPeople: 2,
    });
    expect(result.reply).toContain("rascunho");
    expect(result.decision.action).toBe("preparar rascunho");
  });

  it("does not mistake a broken device for an equipment FAQ", async () => {
    const result = await runAgent(input("Meu notebook está quebrado e não consigo trabalhar"));

    expect(result.decision.action).toBe("preparar rascunho");
    expect(result.draft).toMatchObject({
      action: "create",
      category: "Hardware",
      priority: "Alta",
    });
  });

  it("uses a high priority only when an incident risks work or a same-day commitment", async () => {
    const sameDay = await runAgent(input("A VPN caiu e tenho uma reunião importante hoje"));
    const later = await runAgent(input("A VPN caiu e tenho uma reunião importante na próxima semana"));

    expect(sameDay.draft?.priority).toBe("Alta");
    expect(later.draft?.priority).toBe("Média");
  });

  it("updates a similar open ticket instead of creating a duplicate", async () => {
    const result = await runAgent(input("Quero abrir chamado: meu notebook lento após atualização"));

    expect(result.draft).toMatchObject({
      action: "update",
      existingTicketId: ticket.id,
    });
    expect(result.ticketIds).toContain(ticket.id);
    expect(result.reply).toContain("evitar duplicidade");
  });

  it("does not commit an update until the user confirms the displayed draft", async () => {
    const draft: TicketDraft = {
      action: "update",
      title: ticket.title,
      description: "A lentidão piorou hoje.",
      type: ticket.type,
      category: ticket.category,
      priority: ticket.priority,
      affectedPeople: 1,
      existingTicketId: ticket.id,
      missing: [],
    };
    const result = await runAgent(input("Confirmo", { pendingDraft: draft }));

    expect(result.clearPending).toBe(true);
    expect(result.draft).toEqual(draft);
    expect(result.decision.toolCalls).toContain("tickets.update");
  });

  it("lets an employee choose a ticket by its ID before collecting update details", async () => {
    const selected = await runAgent(input(ticket.id));

    expect(selected.draft).toMatchObject({
      action: "update",
      existingTicketId: ticket.id,
      missing: ["description"],
    });
    expect(selected.reply).toContain("O que você gostaria de acrescentar?");
  });

  it("recognizes an update request before the broader ticket-consultation intent", async () => {
    const result = await runAgent(input("Quero complementar meu chamado INC-20311: piorou hoje"));

    expect(result.decision.action).toBe("preparar atualização");
    expect(result.draft).toMatchObject({
      action: "update",
      existingTicketId: ticket.id,
    });
  });

  it("classifies an access request as a low-priority requisition", async () => {
    const result = await runAgent(input("Quero solicitar acesso ao software de design"));

    expect(result.draft).toMatchObject({
      action: "create",
      type: "REQ",
      category: "Acesso",
      priority: "Baixa",
    });
  });

  it("allows a recently resolved ticket to be reopened with a new update", async () => {
    const recentlyResolved: Ticket = {
      ...ticket,
      status: "Resolvido",
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = await runAgent(
      input("Quero complementar meu chamado INC-20311: o problema voltou", {
        tickets: [recentlyResolved],
      }),
    );

    expect(result.draft).toMatchObject({
      action: "update",
      existingTicketId: ticket.id,
    });
  });

  it("discards a draft on cancellation without taking a ticket action", async () => {
    const draft: TicketDraft = {
      action: "create",
      title: "Novo chamado",
      description: "Detalhes",
      type: "INC",
      category: "Outros",
      priority: "Média",
      affectedPeople: 1,
      missing: [],
    };
    const result = await runAgent(input("Cancelar", { pendingDraft: draft }));

    expect(result.clearPending).toBe(true);
    expect(result.decision.action).toBe("descartar rascunho");
    expect(result.decision.toolCalls).toEqual([]);
  });

  it("transfers explicit requests for a human and stops the automated agent", async () => {
    const result = await runAgent(input("Quero falar com um analista"));

    expect(result.transfer).toBe(true);
    expect(result.decision.toolCalls).toContain("conversations.transfer");
  });

  it("asks for clarification instead of guessing on unrelated requests", async () => {
    const result = await runAgent(input("Qual restaurante você recomenda para o almoço?"));

    expect(result.decision.confidence).toBeLessThan(0.5);
    expect(result.decision.action).toBe("pedir esclarecimento");
    expect(result.decision.toolCalls).toEqual([]);
  });

  it("transfers an unclear IT issue rather than inventing a diagnosis", async () => {
    const result = await runAgent(input("Meu Outlook está estranho"));

    expect(result.transfer).toBe(true);
    expect(result.decision.action).toBe("transferir por baixa confiança");
    expect(result.decision.confidence).toBeLessThan(0.5);
  });

  it("redirects non-IT topics without creating a ticket or transferring the conversation", async () => {
    const result = await runAgent(input("Tenho uma dúvida sobre reembolso"));

    expect(result.transfer).toBeUndefined();
    expect(result.decision.action).toBe("redirecionar para a área responsável");
    expect(result.decision.toolCalls).toEqual([]);
  });
});
