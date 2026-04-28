/**
 * Persistência local (localStorage) para clientes e orçamentos salvos.
 *
 * Estrutura desenhada para migrar para Lovable Cloud sem alterar a API
 * pública: basta trocar a implementação interna por chamadas Supabase.
 */
import type { Client, ClientPriceTable, SavedQuote } from "@/types/commercial";

const CLIENTS_KEY = "maxcut.clients.v1";
const QUOTES_KEY = "maxcut.quotes.v1";
const QUOTE_COUNTER_KEY = "maxcut.quotes.counter.v1";

export const DEFAULT_PRICE_TABLE: ClientPriceTable = {
  corte: 3.0,
  cortePeca: 2.0,
  fita: 4.5,
  fitaManual: 8.0,
  furo: 0.10,
  fresaMetro: 8.0,
  serraMetro: 5.0,
  chapaM2: 0,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// -------- CLIENTS --------

export function listClients(): Client[] {
  return safeParse<Client[]>(localStorage.getItem(CLIENTS_KEY), [])
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getClient(id: string): Client | undefined {
  return listClients().find(c => c.id === id);
}

export function saveClient(input: Omit<Client, "id" | "createdAt" | "updatedAt"> & { id?: string }): Client {
  const all = listClients();
  const now = new Date().toISOString();
  let saved: Client;
  if (input.id) {
    const existing = all.find(c => c.id === input.id);
    saved = {
      ...(existing as Client),
      ...input,
      id: input.id,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    };
    const next = all.map(c => c.id === saved.id ? saved : c);
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(next));
  } else {
    saved = { ...input, id: uid(), createdAt: now, updatedAt: now };
    localStorage.setItem(CLIENTS_KEY, JSON.stringify([...all, saved]));
  }
  return saved;
}

export function deleteClient(id: string): void {
  const next = listClients().filter(c => c.id !== id);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(next));
}

// -------- QUOTES --------

function nextQuoteNumber(): number {
  const cur = parseInt(localStorage.getItem(QUOTE_COUNTER_KEY) || "0", 10) || 0;
  const next = cur + 1;
  localStorage.setItem(QUOTE_COUNTER_KEY, String(next));
  return next;
}

export function listQuotes(): SavedQuote[] {
  return safeParse<SavedQuote[]>(localStorage.getItem(QUOTES_KEY), [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getQuote(id: string): SavedQuote | undefined {
  return listQuotes().find(q => q.id === id);
}

export function saveQuote(
  input: Omit<SavedQuote, "id" | "numero" | "createdAt" | "updatedAt"> & { id?: string; numero?: number },
): SavedQuote {
  const all = listQuotes();
  const now = new Date().toISOString();
  let saved: SavedQuote;
  if (input.id) {
    const existing = all.find(q => q.id === input.id);
    saved = {
      ...(existing as SavedQuote),
      ...input,
      id: input.id,
      numero: input.numero ?? existing?.numero ?? nextQuoteNumber(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = all.map(q => q.id === saved.id ? saved : q);
    localStorage.setItem(QUOTES_KEY, JSON.stringify(next));
  } else {
    saved = {
      ...input,
      id: uid(),
      numero: input.numero ?? nextQuoteNumber(),
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(QUOTES_KEY, JSON.stringify([...all, saved]));
  }
  return saved;
}

export function deleteQuote(id: string): void {
  const next = listQuotes().filter(q => q.id !== id);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(next));
}

export function updateQuoteStatus(
  id: string,
  patch: Partial<SavedQuote["status"]>,
): SavedQuote | undefined {
  const q = getQuote(id);
  if (!q) return;
  return saveQuote({ ...q, status: { ...q.status, ...patch } });
}
