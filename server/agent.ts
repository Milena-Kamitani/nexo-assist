import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type {
  AgentDecision,
  KnowledgeArticle,
  Ticket,
  TicketDraft,
} from "./types";
import { dueDate } from "./store";

type Intent =
  | "knowledge"
  | "consultation"
  | "creation"
  | "update"
  | "escalation"
  | "confirmation"
  | "cancellation"
  | "collection"
  | "fallback";

export interface AgentInput {
  message: string;
  employeeId: string;
  employeeName: string;
  tickets: Ticket[];
  articles: KnowledgeArticle[];
  pendingDraft?: TicketDraft;
}

export interface AgentOutput {
  reply: string;
  decision: AgentDecision;
  ticketIds: string[];
  draft?: TicketDraft;
  clearPending?: boolean;
  transfer?: boolean;
}

const State = Annotation.Root({
  input: Annotation<AgentInput>(),
  intent: Annotation<Intent>(),
  outcome: Annotation<AgentOutput>(),
});

const affirmative = /^(sim|confirmo|confirmar|pode|pode confirmar|isso|está certo|esta certo|ok|criar|atualizar)\b/i;
const negative = /^(não|nao|cancelar|cancela|deixa|voltar)\b/i;
const transferRequest =
  /\b(quero falar com|falar com|conversar com|chamar|chame|chama|transferir|encaminhar para|quero um analista|pessoa real|atendente humano)\b/i;
const consultation =
  /\b(meus chamados|meu chamado|status|andamento|acompanhar|consultar|ver chamado|chamados abertos|chamado atrasado)\b/i;
const updateRequest =
  /\b(complementar|atualizar|adicionar (uma )?informação|informar que|acrescentar|novidade no chamado)\b/i;
const creationRequest =
  /\b(abrir|criar|registrar|preciso de|solicitar|solicitação|solicitacao|quero um chamado|novo chamado|não funciona|nao funciona|não conecta|nao conecta|não imprime|nao imprime|parou(?: de)?|erro|travou|travando|sem acesso|sem internet|caiu|quebrou|quebrado|lento|bloqueada|bloqueado|impressora)\b/i;
const categoryRules: Array<[RegExp, TicketDraft["category"]]> = [
  [/\b(vpn|wi-?fi|internet|rede|conexão|conexao)\b/i, "Rede e VPN"],
  [/\b(acesso|senha|login|conta|permissão|permissao)\b/i, "Acesso"],
  [/\b(notebook|monitor|mouse|teclado|impressora|equipamento|computador)\b/i, "Hardware"],
  [/\b(software|programa|aplicativo|instalar|licença|licenca)\b/i, "Software"],
  [/\b(email|e-mail|outlook|correio)\b/i, "E-mail"],
];
const criticalImpact = /\b(equipe|todos|empresa|andar|departamento|14 pessoas|várias pessoas|varias pessoas|time inteiro)\b/i;
const workBlocked =
  /\b(sem conseguir trabalhar|não consigo trabalhar|nao consigo trabalhar|ninguém consegue trabalhar|ninguem consegue trabalhar|impede o trabalho|parado|parada|sem acesso)\b/i;
const sameDayCommitment =
  /\b(hoje|até o fim do dia|ate o fim do dia|prazo de hoje|reunião hoje|reuniao hoje|apresentação hoje|apresentacao hoje|cliente hoje)\b/i;
const explicitCreation =
  /\b(abrir chamado|criar chamado|registrar chamado|novo chamado|abrir um chamado|criar um chamado|solicitar|solicitação|solicitacao)\b/i;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function decideIntent(input: AgentInput): Intent {
  const text = input.message.trim();
  const pending = input.pendingDraft;
  if (pending) {
    if (affirmative.test(text)) return "confirmation";
    if (negative.test(text)) return "cancellation";
    return "collection";
  }
  if (transferRequest.test(text)) return "escalation";
  if (updateRequest.test(text) || /\b(?:INC|REQ)-\d+\b/i.test(text)) return "update";
  if (consultation.test(text)) return "consultation";
  const normalizedText = normalize(text);
  const articleMatch = input.articles
    .map((article) => ({
      article,
      score: article.keywords.filter((keyword) =>
        normalizedText.includes(normalize(keyword)),
      ).length,
    }))
    .sort((a, b) => b.score - a.score)[0];
  const matchingArticle = Boolean(articleMatch?.score);
  const asksQuestion = /\b(como|qual|quais|onde|quando|horário|horario|por que|o que|posso|dá para|da para)\b/i.test(text);
  if (explicitCreation.test(text)) return "creation";
  if (criticalImpact.test(text) && workBlocked.test(text)) return "creation";
  if (matchingArticle && (asksQuestion || (articleMatch?.score ?? 0) >= 2)) return "knowledge";
  if (creationRequest.test(text)) return "creation";
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad[oa])\b/i.test(text)) return "knowledge";
  return "fallback";
}

function categorize(text: string): TicketDraft["category"] {
  return categoryRules.find(([pattern]) => pattern.test(text))?.[1] ?? "Outros";
}

function isRequest(text: string): boolean {
  return /\b(solicitar|solicitação|solicitacao|preciso de|quero acesso|quero um|comprar|equipamento|licença|licenca|instalar)\b/i.test(
    text,
  );
}

function priorityFor(text: string, type: TicketDraft["type"], affectedPeople: number): TicketDraft["priority"] {
  if (affectedPeople > 1 && criticalImpact.test(text)) return "Crítica";
  if (type === "INC" && workBlocked.test(text)) return "Alta";
  if (type === "INC" && sameDayCommitment.test(text)) return "Alta";
  if (type === "REQ") return "Baixa";
  if (/\b(alternativa|contorno|quebra-galho|quebra galho)\b/i.test(text)) return "Média";
  return "Média";
}

function createDraft(text: string): TicketDraft {
  const count = text.match(/\b(\d{1,3})\s+(?:pessoas|usuários|usuarios|colaboradores)\b/i);
  const affectedPeople = count
    ? Math.max(1, Number(count[1]))
    : criticalImpact.test(text)
      ? 2
      : 1;
  const type = isRequest(text) ? "REQ" : "INC";
  const title = text.length > 72 ? `${text.slice(0, 69).trimEnd()}…` : text;
  const missing = text.trim().split(/\s+/).length < 4 ? ["description"] : [];
  return {
    action: "create",
    title,
    description: text,
    type,
    category: categorize(text),
    priority: priorityFor(text, type, affectedPeople),
    affectedPeople,
    missing,
  };
}

function duplicateFor(draft: TicketDraft, tickets: Ticket[], ownerId: string): Ticket | undefined {
  const stopWords = new Set(["quero", "abrir", "criar", "chamado", "meu", "minha", "para", "uma", "que", "com"]);
  const terms = normalize(draft.title)
    .split(/\W+/)
    .filter((term) => term.length > 3 && !stopWords.has(term));
  return tickets.find((ticket) => {
    if (ticket.ownerId !== ownerId) return false;
    const active =
      ["Aberto", "Em atendimento", "Aguardando analista", "Aprovado"].includes(ticket.status) ||
      (ticket.status === "Resolvido" &&
        Date.now() - Date.parse(ticket.updatedAt) <= 7 * 24 * 60 * 60 * 1000);
    if (!active) return false;
    if (ticket.category !== draft.category) return false;
    const existing = normalize(`${ticket.title} ${ticket.description}`);
    return terms.length > 0 && terms.filter((term) => existing.includes(term)).length / terms.length >= 0.6;
  });
}

function dueLabel(ticket: Pick<Ticket, "dueAt">): string {
  const remaining = Date.parse(ticket.dueAt) - Date.now();
  if (remaining < 0) return `Vencido há ${Math.max(1, Math.floor(Math.abs(remaining) / 3_600_000))}h`;
  if (remaining < 3_600_000) return `Vence em ${Math.max(1, Math.ceil(remaining / 60_000))} min`;
  return `Prazo ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(ticket.dueAt))}`;
}

function decision(
  intent: string,
  action: string,
  confidence: number,
  reason: string,
  toolCalls: string[] = [],
  sources: string[] = [],
): AgentDecision {
  return { intent, action, confidence, reason, toolCalls, sources };
}

function routeResult(
  reply: string,
  intent: string,
  action: string,
  confidence: number,
  reason: string,
  options: Partial<Pick<AgentOutput, "ticketIds" | "draft" | "clearPending" | "transfer">> = {},
  toolCalls: string[] = [],
  sources: string[] = [],
): AgentOutput {
  return {
    reply,
    decision: decision(intent, action, confidence, reason, toolCalls, sources),
    ticketIds: options.ticketIds ?? [],
    ...options,
  };
}

function articleResponse(input: AgentInput): AgentOutput {
  const normalizedText = normalize(input.message);
  const article = input.articles
    .map((item) => ({
      item,
      score: item.keywords.reduce(
        (total, keyword) => total + (normalizedText.includes(normalize(keyword)) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (!article || article.score === 0) {
    return routeResult(
      `Olá, ${input.employeeName.split(" ")[0]}! Posso ajudar com dúvidas de TI, VPN, acessos, equipamentos ou chamados. O que você precisa?`,
      "saudação",
      "orientação",
      0.89,
      "A mensagem parece uma saudação, sem uma solicitação específica.",
      {},
      [],
    );
  }
  return routeResult(
    `${article.item.content}\n\nIsso resolveu? Se o problema continuar, posso abrir um chamado para você.`,
    "dúvida de TI",
    "buscar na central de ajuda",
    0.94,
    `Encontrei uma orientação que corresponde aos termos da sua dúvida.`,
    {},
    ["knowledge.search"],
    [`Central de ajuda · ${article.item.title}`],
  );
}

function consultationResponse(input: AgentInput): AgentOutput {
  const activeTickets = input.tickets.filter(
    (ticket) => ticket.ownerId === input.employeeId && ticket.status !== "Resolvido",
  );
  if (activeTickets.length === 0) {
    return routeResult(
      "Não encontrei chamados em aberto no seu perfil. Se quiser, posso ajudar a abrir um novo.",
      "consulta de chamados",
      "consultar chamados do funcionário",
      0.99,
      "A consulta foi limitada aos chamados pertencentes à pessoa autenticada.",
      {},
      ["tickets.list"],
    );
  }
  const overdue = activeTickets.filter((ticket) => Date.parse(ticket.dueAt) < Date.now());
  const summary = activeTickets
    .map((ticket) => `• ${ticket.id} — ${ticket.title} · ${ticket.status} · ${dueLabel(ticket)}`)
    .join("\n");
  return routeResult(
    `Encontrei ${activeTickets.length} chamado${activeTickets.length > 1 ? "s" : ""} em aberto:\n\n${summary}\n\n${overdue.length ? "Há um prazo vencido. Encaminhei esta conversa para um analista acompanhar o chamado." : "Quer complementar algum deles ou falar com um analista?"}`,
    "consulta de chamados",
    "consultar chamados do funcionário",
    0.99,
    "Os chamados foram filtrados pelo identificador da pessoa autenticada; prazos vencidos são destacados.",
    { ticketIds: activeTickets.map((ticket) => ticket.id), ...(overdue.length ? { transfer: true } : {}) },
    ["tickets.list", "sla.check"],
    ["Sistema de chamados · chamados da pessoa autenticada", "Política de prioridade · Anexo A"],
  );
}

function creationResponse(input: AgentInput): AgentOutput {
  let draft = createDraft(input.message);
  if (draft.missing.length) {
    return routeResult(
      "Claro. O que aconteceu, em qual sistema ou equipamento e desde quando? Com esses detalhes eu preparo um chamado para você revisar.",
      "abertura de chamado",
      "coletar informações",
      0.82,
      "A descrição inicial é curta demais para abrir um chamado que ajude o analista a investigar.",
      { draft },
      [],
      ["Política de abertura · Anexo A"],
    );
  }
  const duplicate = duplicateFor(draft, input.tickets, input.employeeId);
  if (duplicate) {
    draft = {
      ...draft,
      action: "update",
      existingTicketId: duplicate.id,
      title: duplicate.title,
      type: duplicate.type,
      category: duplicate.category,
      priority: duplicate.priority,
      description: input.message,
    };
  }
  const prefix = duplicate
    ? `Encontrei um chamado aberto que parece tratar do mesmo problema (${duplicate.id}). Para evitar duplicidade, vou complementar esse chamado.`
    : "Preparei um rascunho para você revisar. Só vou registrar depois da sua confirmação.";
  const dueAt = dueDate(draft.priority, new Date().toISOString());
  return routeResult(
    `${prefix}\n\nPrazo inicial estimado: ${dueLabel({ dueAt })}.`,
    duplicate ? "atualização de chamado existente" : "abertura de chamado",
    duplicate ? "evitar duplicidade e preparar atualização" : "preparar rascunho",
    duplicate ? 0.91 : 0.88,
    duplicate
      ? "Há um chamado aberto com a mesma categoria e descrição semelhante; a política exige atualizar, não duplicar."
      : "Classifiquei o tipo, a categoria e a prioridade pela descrição e pelas regras de impacto e urgência.",
    { draft, ...(duplicate ? { ticketIds: [duplicate.id] } : {}) },
    duplicate ? ["tickets.search", "tickets.update (aguardando confirmação)"] : ["tickets.classify", "sla.estimate"],
    ["Política de abertura e duplicidade · Anexo A"],
  );
}

function updateResponse(input: AgentInput): AgentOutput {
  const openTickets = input.tickets.filter(
    (ticket) =>
      ticket.ownerId === input.employeeId &&
      (["Aberto", "Em atendimento", "Aguardando analista", "Aprovado"].includes(ticket.status) ||
        (ticket.status === "Resolvido" &&
          Date.now() - Date.parse(ticket.updatedAt) <= 7 * 24 * 60 * 60 * 1000)),
  );
  const keywords = normalize(input.message).split(/\W+/).filter((word) => word.length > 3);
  const ticketReference = input.message.match(/\b(?:INC|REQ)-\d+\b/i)?.[0];
  const matching = openTickets.filter((ticket) => {
    if (ticketReference) return ticket.id.toLowerCase() === ticketReference.toLowerCase();
    const haystack = normalize(`${ticket.id} ${ticket.title} ${ticket.description}`);
    return keywords.some((word) => haystack.includes(word));
  });
  const ticket = matching.length === 1 ? matching[0] : openTickets.length === 1 ? openTickets[0] : undefined;
  if (!ticket) {
    return routeResult(
      openTickets.length
        ? `Qual chamado você quer complementar? Selecione um dos seus chamados em aberto:\n${openTickets.map((item) => `• ${item.id} — ${item.title}`).join("\n")}`
        : "Não encontrei chamados em aberto para complementar. Quer abrir um novo?",
      "atualização de chamado",
      "identificar chamado",
      0.71,
      openTickets.length
        ? "Há mais de um chamado possível; preciso que a pessoa escolha para evitar atualizar o registro errado."
        : "Não existe chamado em aberto no perfil autenticado.",
      { ticketIds: openTickets.map((item) => item.id) },
      ["tickets.list"],
    );
  }
  if (/^(?:INC|REQ)-\d+[.!? ]*$/i.test(input.message.trim())) {
    const draft: TicketDraft = {
      action: "update",
      title: ticket.title,
      description: "",
      type: ticket.type,
      category: ticket.category,
      priority: ticket.priority,
      affectedPeople: ticket.affectedPeople,
      existingTicketId: ticket.id,
      missing: ["description"],
    };
    return routeResult(
      `Certo, vou complementar o chamado ${ticket.id} — “${ticket.title}”. O que você gostaria de acrescentar?`,
      "atualização de chamado",
      "coletar informações",
      0.9,
      "A pessoa selecionou um chamado pelo número; preciso receber o conteúdo do complemento antes de preparar a atualização.",
      { ticketIds: [ticket.id], draft },
      ["tickets.search"],
      ["Chamados da pessoa autenticada"],
    );
  }
  const draft: TicketDraft = {
    action: "update",
    title: ticket.title,
    description: input.message,
    type: ticket.type,
    category: ticket.category,
    priority: ticket.priority,
    affectedPeople: ticket.affectedPeople,
    existingTicketId: ticket.id,
    missing: [],
  };
  return routeResult(
    `Vou adicionar essa informação ao chamado ${ticket.id} — “${ticket.title}”. Confirma a atualização?`,
    "atualização de chamado",
    "preparar atualização",
    0.93,
    "Identifiquei um chamado em aberto da própria pessoa; a atualização só será gravada após confirmação.",
    { ticketIds: [ticket.id], draft },
    ["tickets.search", "tickets.update (aguardando confirmação)"],
    ["Política de duplicidade e atualização · Anexo A"],
  );
}

function confirmationResponse(input: AgentInput): AgentOutput {
  const draft = input.pendingDraft;
  if (!draft) {
    return routeResult(
      "Não há nenhuma alteração aguardando confirmação. Como posso ajudar?",
      "confirmação",
      "pedir esclarecimento",
      0.99,
      "Não existe rascunho pendente nesta conversa.",
    );
  }
  if (draft.missing.length > 0) {
    return routeResult(
      "Ainda faltam detalhes para preparar um chamado útil para o analista. Conte o que aconteceu, em qual sistema ou equipamento e desde quando.",
      "abertura de chamado",
      "coletar informações",
      0.99,
      "A confirmação não substitui os campos obrigatórios que ainda não foram preenchidos.",
      { draft },
      [],
      ["Política de abertura · Anexo A"],
    );
  }
  return routeResult(
    draft.action === "create"
      ? "Rascunho confirmado. Vou registrar o chamado agora."
      : "Atualização confirmada. Vou complementar o chamado agora.",
    draft.action === "create" ? "abertura de chamado" : "atualização de chamado",
    draft.action === "create" ? "criar chamado" : "atualizar chamado",
    0.99,
    "A pessoa confirmou explicitamente o rascunho que foi apresentado antes da alteração.",
    { draft, clearPending: true },
    [draft.action === "create" ? "tickets.create" : "tickets.update"],
    ["Confirmação explícita da pessoa solicitante"],
  );
}

function cancellationResponse(): AgentOutput {
  return routeResult(
    "Tudo bem — descartei o rascunho sem alterar nenhum chamado.",
    "cancelamento",
    "descartar rascunho",
    0.99,
    "A pessoa recusou o rascunho pendente.",
    { clearPending: true },
  );
}

function collectionResponse(input: AgentInput): AgentOutput {
  const previous = input.pendingDraft;
  if (!previous) return routeResult("Me conte mais para eu entender o que precisa.", "esclarecimento", "coletar contexto", 0.65, "Informações insuficientes.");
  const draft: TicketDraft = {
    ...previous,
    description: `${previous.description} ${input.message}`.trim(),
    title:
      previous.title === previous.description || previous.title === "Novo chamado"
        ? input.message.slice(0, 72)
        : previous.title,
    missing: [],
  };
  return routeResult(
    `Atualizei o rascunho com os detalhes. ${draft.action === "create" ? "Revise antes de confirmar o chamado." : "Confirme se posso complementar o chamado."}`,
    draft.action === "create" ? "abertura de chamado" : "atualização de chamado",
    "completar rascunho",
    0.83,
    "Usei os detalhes enviados para preencher a descrição, sem alterar o sistema de chamados.",
    { draft },
    [],
    ["Política de abertura · Anexo A"],
  );
}

function escalationResponse(): AgentOutput {
  return routeResult(
    "Vou chamar um analista e compartilhar o contexto desta conversa. O atendimento automático ficará pausado até o analista devolver ou encerrar o caso.",
    "solicitação de atendimento humano",
    "transferir para analista",
    0.99,
    "A pessoa pediu explicitamente para falar com um analista. A conversa será transferida com um resumo e o agent ficará pausado.",
    { transfer: true },
    ["conversations.transfer"],
    ["Política de transferência · Anexo A"],
  );
}

function fallbackResponse(input: AgentInput): AgentOutput {
  if (/\b(rh|recursos humanos|financeiro|reembolso|férias|ferias|facilities|manutenção predial)\b/i.test(input.message)) {
    return routeResult(
      "O Nexo Assist atende apenas assuntos de TI. Para esse tema, procure o canal de atendimento da área responsável.",
      "solicitação fora do escopo de TI",
      "redirecionar para a área responsável",
      0.99,
      "O assunto mencionado não pertence ao escopo do service desk de TI.",
      {},
      [],
      ["Escopo do service desk · Anexo A"],
    );
  }
  if (/\b(vpn|rede|notebook|computador|outlook|email|e-mail|senha|sistema|software|acesso|impressora|wi-?fi)\b/i.test(input.message)) {
    return routeResult(
      "Não consegui identificar com segurança o problema de TI. Vou encaminhar esta conversa para um analista, que poderá entender melhor o contexto.",
      "intenção de TI incerta",
      "transferir por baixa confiança",
      0.38,
      "A mensagem menciona tecnologia, mas não há contexto suficiente nem uma orientação segura na central de ajuda.",
      { transfer: true },
      ["conversations.transfer"],
      ["Política de transferência por baixa confiança · Anexo A"],
    );
  }
  return routeResult(
    "Posso ajudar com assuntos de TI. Você quer tirar uma dúvida, consultar ou atualizar um chamado, abrir um novo, ou falar com um analista?",
    "intenção não identificada",
    "pedir esclarecimento",
    0.42,
    "Não encontrei uma intenção confiável nem uma resposta na central de ajuda. Pedi esclarecimento em vez de alterar um chamado.",
  );
}

const workflow = new StateGraph(State)
  .addNode("classify", (state) => ({ intent: decideIntent(state.input) }))
  .addNode("knowledge", (state) => ({ outcome: articleResponse(state.input) }))
  .addNode("consultation", (state) => ({ outcome: consultationResponse(state.input) }))
  .addNode("creation", (state) => ({ outcome: creationResponse(state.input) }))
  .addNode("update", (state) => ({ outcome: updateResponse(state.input) }))
  .addNode("confirmation", (state) => ({ outcome: confirmationResponse(state.input) }))
  .addNode("cancellation", () => ({ outcome: cancellationResponse() }))
  .addNode("collection", (state) => ({ outcome: collectionResponse(state.input) }))
  .addNode("escalation", () => ({ outcome: escalationResponse() }))
  .addNode("fallback", (state) => ({ outcome: fallbackResponse(state.input) }))
  .addEdge(START, "classify")
  .addConditionalEdges("classify", (state) => state.intent, {
    knowledge: "knowledge",
    consultation: "consultation",
    creation: "creation",
    update: "update",
    escalation: "escalation",
    confirmation: "confirmation",
    cancellation: "cancellation",
    collection: "collection",
    fallback: "fallback",
  })
  .addEdge("knowledge", END)
  .addEdge("consultation", END)
  .addEdge("creation", END)
  .addEdge("update", END)
  .addEdge("confirmation", END)
  .addEdge("cancellation", END)
  .addEdge("collection", END)
  .addEdge("escalation", END)
  .addEdge("fallback", END)
  .compile();

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const result = await workflow.invoke({ input });
  return result.outcome;
}
