// Sincroniza emails do Gmail (do próprio dono) e cria ordens de serviço.
// Filtro: emails com anexo (PDF/imagem) OU palavras-chave no assunto
// OU remetentes cadastrados como clientes (a lista de clientes é enviada pelo cliente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB por anexo
const MAX_MESSAGES = 30;

function gwHeaders() {
  return {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY!,
    "Content-Type": "application/json",
  };
}

async function gw(path: string): Promise<any> {
  const r = await fetch(`${GATEWAY}${path}`, { headers: gwHeaders() });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gmail ${r.status}: ${t.slice(0, 500)}`);
  }
  return r.json();
}

function parseFrom(raw: string): { name?: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim().toLowerCase() };
  return { email: raw.trim().toLowerCase() };
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(s)}`;
}

// coleta anexos (parts recursivos)
function collectAttachmentParts(part: any, out: any[]) {
  if (!part) return;
  const mime = (part.mimeType || "").toLowerCase();
  const filename = part.filename || "";
  const attId = part.body?.attachmentId;
  const size = part.body?.size || 0;
  const isAllowed = mime.startsWith("image/") || mime === "application/pdf";
  if (filename && attId && isAllowed) {
    out.push({ mime, filename, attachmentId: attId, size });
  }
  if (Array.isArray(part.parts)) for (const p of part.parts) collectAttachmentParts(p, out);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return new Response(JSON.stringify({ error: "Gmail connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const clientEmails: string[] = Array.isArray(body.clientEmails)
      ? body.clientEmails.map((e: string) => e.toLowerCase())
      : [];

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cfg } = await supabase.from("gmail_sync_config").select("*").eq("id", 1).single();
    const keywords: string[] = Array.isArray(cfg?.keywords) ? cfg!.keywords : [];
    const senderEmails: string[] = Array.isArray(cfg?.sender_emails)
      ? cfg!.sender_emails.map((e: string) => e.toLowerCase().trim()).filter(Boolean)
      : [];
    const requireAttachment: boolean = cfg?.require_attachment ?? true;
    const onlyKnown: boolean = cfg?.only_known_clients ?? false;
    const lastSync: string | null = cfg?.last_synced_at ?? null;

    // Query Gmail: newer_than baseado em lastSync (default 30 dias)
    const days = lastSync
      ? Math.max(1, Math.ceil((Date.now() - new Date(lastSync).getTime()) / 86400000) + 1)
      : 30;
    const qParts = [`newer_than:${days}d`, "-in:trash", "-in:spam"];
    if (requireAttachment) qParts.push("has:attachment");
    // Filtrar direto no Gmail por remetentes (mais eficiente)
    if (senderEmails.length > 0) {
      qParts.push(`(${senderEmails.map(e => `from:${e}`).join(" OR ")})`);
    }
    const q = encodeURIComponent(qParts.join(" "));
    const list = await gw(`/users/me/messages?maxResults=${MAX_MESSAGES}&q=${q}`);
    const messages: Array<{ id: string; threadId: string }> = list.messages || [];

    // ids já processados
    const ids = messages.map(m => m.id);
    const { data: existing } = ids.length
      ? await supabase.from("service_orders").select("gmail_message_id").in("gmail_message_id", ids)
      : { data: [] as any[] };
    const seen = new Set((existing || []).map((r: any) => r.gmail_message_id));

    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const m of messages) {
      if (seen.has(m.id)) { results.skipped++; continue; }
      try {
        const msg = await gw(`/users/me/messages/${m.id}?format=full`);
        const headers: any[] = msg.payload?.headers || [];
        const hdr = (name: string) =>
          headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
        const from = parseFrom(hdr("From"));
        const subject = hdr("Subject");
        const dateHdr = hdr("Date");
        const receivedAt = dateHdr ? new Date(dateHdr).toISOString() : new Date(parseInt(msg.internalDate || "0", 10)).toISOString();

        // filtro
        const subjLower = (subject || "").toLowerCase();
        const kwHit = keywords.find(k => subjLower.includes(k.toLowerCase()));
        const clientHit = clientEmails.includes(from.email);
        const senderHit = senderEmails.length > 0 && senderEmails.includes(from.email);

        const parts: any[] = [];
        collectAttachmentParts(msg.payload, parts);

        // Se lista de remetentes configurada, aceitar SOMENTE emails desses remetentes
        if (senderEmails.length > 0 && !senderHit) { results.skipped++; continue; }
        if (onlyKnown && !clientHit) { results.skipped++; continue; }
        if (requireAttachment && parts.length === 0) { results.skipped++; continue; }
        if (senderEmails.length === 0 && !clientHit && !kwHit && !parts.length) { results.skipped++; continue; }

        // Baixa anexos (limite de tamanho)
        const attachmentsOut: any[] = [];
        for (const p of parts) {
          if (p.size > MAX_ATTACHMENT_BYTES) {
            attachmentsOut.push({ name: p.filename, mime: p.mime, size: p.size, skipped: "too_large" });
            continue;
          }
          try {
            const att = await gw(`/users/me/messages/${m.id}/attachments/${p.attachmentId}`);
            const bytes = b64urlToBytes(att.data || "");
            attachmentsOut.push({
              name: p.filename,
              mime: p.mime,
              size: p.size,
              dataUrl: bytesToDataUrl(bytes, p.mime),
            });
          } catch (e) {
            attachmentsOut.push({ name: p.filename, mime: p.mime, size: p.size, error: String(e).slice(0, 200) });
          }
        }

        const reason = clientHit ? `Cliente cadastrado: ${from.email}`
          : kwHit ? `Assunto contém "${kwHit}"`
          : "Email com anexo";

        const { error } = await supabase.from("service_orders").insert({
          gmail_message_id: m.id,
          gmail_thread_id: m.threadId,
          from_email: from.email,
          from_name: from.name,
          subject,
          snippet: msg.snippet || "",
          received_at: receivedAt,
          status: "pendente",
          matched_reason: reason,
          attachments: attachmentsOut,
        });
        if (error) throw error;
        results.imported++;
      } catch (e) {
        results.errors.push(`${m.id}: ${String(e).slice(0, 200)}`);
      }
    }

    await supabase.from("gmail_sync_config").update({ last_synced_at: new Date().toISOString() }).eq("id", 1);

    return new Response(JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
