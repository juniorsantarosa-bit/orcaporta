import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, RefreshCw, Mail, Paperclip, Trash2, ArrowRight, Settings2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { listClients } from "@/lib/commercialStore";

interface Attachment {
  name: string;
  mime: string;
  size: number;
  dataUrl?: string;
  skipped?: string;
  error?: string;
}
interface ServiceOrder {
  id: string;
  gmail_message_id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  status: string;
  matched_reason: string | null;
  attachments: Attachment[];
  quote_id: string | null;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  em_orcamento: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  concluido: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  arquivado: "bg-muted text-muted-foreground",
};

export default function OrdensServico() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [showConfig, setShowConfig] = useState(false);
  const [keywords, setKeywords] = useState<string>("");
  const [senderEmails, setSenderEmails] = useState<string>("");
  const [requireAttachment, setRequireAttachment] = useState(true);
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_orders")
      .select("*")
      .order("received_at", { ascending: false });
    if (error) toast.error(error.message);
    else setOrders((data || []) as unknown as ServiceOrder[]);
    setLoading(false);
  }, []);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from("gmail_sync_config").select("*").eq("id", 1).single();
    if (data) {
      setKeywords((Array.isArray(data.keywords) ? data.keywords as string[] : []).join(", "));
      setSenderEmails((Array.isArray((data as any).sender_emails) ? (data as any).sender_emails as string[] : []).join("\n"));
      setRequireAttachment(data.require_attachment);
      setOnlyKnown(data.only_known_clients);
      setLastSync(data.last_synced_at);
    }
  }, []);

  useEffect(() => { load(); loadConfig(); }, [load, loadConfig]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const clientEmails = listClients().map(c => (c.email || "").toLowerCase()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("gmail-sync-orders", {
        body: { clientEmails },
      });
      if (error) throw error;
      toast.success(`Sincronizado: ${data.imported} novo(s), ${data.skipped} ignorado(s)`);
      if (data.errors?.length) console.warn("Sync errors:", data.errors);
      await load();
      await loadConfig();
    } catch (e: any) {
      toast.error(`Erro ao sincronizar: ${e.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  const saveConfig = async () => {
    const kw = keywords.split(",").map(s => s.trim()).filter(Boolean);
    const senders = senderEmails.split(/[\n,;]/).map(s => s.trim().toLowerCase()).filter(s => s.includes("@"));
    const { error } = await supabase
      .from("gmail_sync_config")
      .update({ keywords: kw, sender_emails: senders, require_attachment: requireAttachment, only_known_clients: onlyKnown } as any)
      .eq("id", 1);
    if (error) toast.error(error.message);
    else { toast.success("Configuração salva"); setShowConfig(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("service_orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { await load(); }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Remover essa ordem de serviço?")) return;
    const { error } = await supabase.from("service_orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { await load(); toast.info("Removido"); }
  };

  const openOrcamento = (order: ServiceOrder) => {
    const validAttachments = order.attachments.filter(a => a.dataUrl);
    if (validAttachments.length === 0) {
      toast.error("Essa ordem não tem anexos válidos.");
      return;
    }
    sessionStorage.setItem("maxcut.pendingOrderAttachments", JSON.stringify({
      orderId: order.id,
      from: order.from_email,
      subject: order.subject,
      attachments: validAttachments,
    }));
    updateStatus(order.id, "em_orcamento");
    navigate("/");
  };

  const filtered = orders.filter(o => statusFilter === "all" || o.status === statusFilter);
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Ordens de Serviço</h1>
        <span className="text-xs text-muted-foreground">Gmail → Pedidos pendentes</span>
        <div className="flex-1" />
        {lastSync && (
          <span className="text-[11px] text-muted-foreground">
            Última sync: {new Date(lastSync).toLocaleString("pt-BR")}
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowConfig(s => !s)}>
          <Settings2 className="h-4 w-4 mr-1" /> Config
        </Button>
        <Button size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Sincronizar Gmail
        </Button>
      </header>

      {showConfig && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-3">
          <div>
            <Label className="text-xs">Palavras-chave no assunto (separadas por vírgula)</Label>
            <Input value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="orçamento, pedido, porta, projeto" className="mt-1" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={requireAttachment} onCheckedChange={setRequireAttachment} />
              <Label className="text-xs">Exigir anexo (PDF/imagem)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={onlyKnown} onCheckedChange={setOnlyKnown} />
              <Label className="text-xs">Somente clientes cadastrados</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveConfig}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowConfig(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        {[
          { k: "pendente", label: "Pendentes" },
          { k: "em_orcamento", label: "Em orçamento" },
          { k: "concluido", label: "Concluídos" },
          { k: "arquivado", label: "Arquivados" },
          { k: "all", label: "Todos" },
        ].map(t => (
          <Button key={t.k} size="sm" variant={statusFilter === t.k ? "default" : "ghost"}
            onClick={() => setStatusFilter(t.k)}>
            {t.label}
            {t.k !== "all" && counts[t.k] > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{counts[t.k]}</Badge>
            )}
          </Button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading && <div className="text-center text-sm text-muted-foreground py-8">Carregando…</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              Nenhuma ordem nesse status. Clique em <b>Sincronizar Gmail</b> para buscar pedidos.
            </div>
          )}
          {filtered.map(o => (
            <div key={o.id} className="border border-border rounded-md p-3 bg-card hover:border-primary/40 transition">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{o.from_name || o.from_email}</span>
                    <span className="text-[11px] text-muted-foreground">&lt;{o.from_email}&gt;</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[o.status] || ""}`} variant="outline">
                      {o.status}
                    </Badge>
                    {o.matched_reason && (
                      <span className="text-[10px] text-muted-foreground">· {o.matched_reason}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-1">{o.subject || "(sem assunto)"}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{o.snippet}</div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(o.received_at).toLocaleString("pt-BR")}
                    </span>
                    {o.attachments.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        {o.attachments.map((a, i) => (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${a.dataUrl ? "border-border" : "border-destructive/40 text-destructive"}`}>
                            {a.name} ({Math.round(a.size / 1024)}KB)
                            {a.skipped && " · muito grande"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" onClick={() => openOrcamento(o)} disabled={!o.attachments.some(a => a.dataUrl)}>
                    <ArrowRight className="h-3 w-3 mr-1" /> Criar orçamento
                  </Button>
                  <div className="flex gap-1">
                    {o.status !== "arquivado" && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(o.id, "arquivado")}>
                        Arquivar
                      </Button>
                    )}
                    {o.status === "arquivado" && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(o.id, "pendente")}>
                        Reabrir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteOrder(o.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
