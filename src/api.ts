import type { Conversation, Employee, Ticket } from "../server/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao Nexo Assist. Verifique se o servidor está ativo.", 0);
  }
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      message = `O servidor respondeu com erro (${response.status}).`;
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  me: () => request<{ employee: Employee | null }>("/api/me"),
  login: (email: string, password: string) =>
    request<{ employee: Employee }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  conversations: () => request<{ conversations: Array<Conversation & { owner?: Employee }> }>("/api/conversations"),
  createConversation: () =>
    request<{ conversation: Conversation }>("/api/conversations", { method: "POST" }),
  conversation: (id: string) =>
    request<{ conversation: Conversation; owner?: Employee; tickets: Ticket[] }>(
      `/api/conversations/${encodeURIComponent(id)}`,
    ),
  sendMessage: (id: string, content: string) =>
    request<{ conversation: Conversation; ticket?: Ticket }>(
      `/api/conversations/${encodeURIComponent(id)}/messages`,
      { method: "POST", body: JSON.stringify({ content }) },
    ),
  tickets: (ownerId?: string) =>
    request<{ tickets: Ticket[] }>(
      ownerId ? `/api/tickets?ownerId=${encodeURIComponent(ownerId)}` : "/api/tickets",
    ),
  take: (id: string) =>
    request<{ conversation: Conversation }>(`/api/analyst/conversations/${encodeURIComponent(id)}/take`, {
      method: "POST",
    }),
  returnToAgent: (id: string) =>
    request<{ conversation: Conversation }>(`/api/analyst/conversations/${encodeURIComponent(id)}/return`, {
      method: "POST",
    }),
  close: (id: string) =>
    request<{ conversation: Conversation }>(`/api/analyst/conversations/${encodeURIComponent(id)}/close`, {
      method: "POST",
    }),
  analystMessage: (id: string, content: string) =>
    request<{ conversation: Conversation }>(
      `/api/analyst/conversations/${encodeURIComponent(id)}/messages`,
      { method: "POST", body: JSON.stringify({ content }) },
    ),
};
