import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderOpen, Trash2, Send, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";
import { deleteQuote, listQuotes, saveQuote } from "@/lib/commercialStore";
import type { SavedQuote } from "@/types/commercial";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário escolhe um orçamento para abrir/carregar */
  onLoad?: (quote: SavedQuote) => void;
}

export function OrcamentosListDialog({ open, onOpenChange, onLoad }: Props) {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) setQuotes(listQuotes());
  }, [open]);

  const refresh = () => setQuotes(listQuotes());

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(qq =>
      [String(qq.numero), qq.clienteNome, qq.observacoes]
        .filter(Boolean).some(v => v!.toLowerCase().includes(q)));
  }, [quotes, filter]);

  const handleDelete = (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    deleteQuote(id);
    refresh();
  };

  const toggleStatus = (q: SavedQuote, key: "enviado" | "pago") => {
    const now = new Date().toISOString();
    saveQuote({
      ...q,
      status: {
        ...q.status,
        [key]: !q.status[key],
        ...(key === "enviado" && !q.status.enviado ? { dataEnvio: now } : {}),
        ...(key === "pago" && !q.status.pago ? { dataPagamento: now } : {}),
      },
    });
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Orçamentos Salvos
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder="Buscar por número, cliente ou observação..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 text-xs"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {filtered.length} de {quotes.length}
          </span>
        </div>

        <ScrollArea className="flex-1 border border-border rounded">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum orçamento salvo ainda. Use o botão <b>Salvar orçamento</b> dentro do diálogo de orçamento.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0 z-10">
                <tr className="text-[10px] uppercase text-muted-foreground">
                  <th className="text-left px-2 py-2">Nº</th>
                  <th className="text-left px-2 py-2">Cliente</th>
                  <th className="text-left px-2 py-2">Data</th>
                  <th className="text-center px-2 py-2">Peças</th>
                  <th className="text-right px-2 py-2">Total</th>
                  <th className="text-center px-2 py-2">Enviado</th>
                  <th className="text-center px-2 py-2">Pago</th>
                  <th className="text-center px-2 py-2">Mat. Receb.</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const totalPecas = q.pieces.reduce((a, p) => a + (p.quantidade || 1), 0);
                  const recebidos = q.pieces.filter(p =>
                    q.pieceMeta[p.id]?.recebido ?? p.materialRecebido
                  ).length;
                  return (
                    <tr key={q.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-2 py-1.5 font-mono font-semibold">#{q.numero}</td>
                      <td className="px-2 py-1.5 truncate max-w-[200px]">{q.clienteNome ?? "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground text-[10px]">
                        {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-2 py-1.5 text-center">{totalPecas}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">R$ {q.totalCalculado.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={q.status.enviado} onCheckedChange={() => toggleStatus(q, "enviado")} />
                      </td>
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={q.status.pago} onCheckedChange={() => toggleStatus(q, "pago")} />
                      </td>
                      <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                        {recebidos}/{q.pieces.length}
                      </td>
                      <td className="px-2 py-1.5 flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => { onLoad?.(q); onOpenChange(false); }}
                        >
                          Abrir
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => handleDelete(q.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatCard icon={Send} label="Enviados" value={quotes.filter(q => q.status.enviado).length} />
          <StatCard icon={DollarSign} label="Pagos" value={quotes.filter(q => q.status.pago).length}
            extra={`R$ ${quotes.filter(q => q.status.pago).reduce((a, q) => a + q.totalCalculado, 0).toFixed(2)}`} />
          <StatCard icon={Package} label="Total geral" value={quotes.length}
            extra={`R$ ${quotes.reduce((a, q) => a + q.totalCalculado, 0).toFixed(2)}`} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value, extra }: { icon: React.ElementType; label: string; value: number; extra?: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-bold">{value}</div>
        {extra && <div className="text-[10px] text-muted-foreground truncate">{extra}</div>}
      </div>
    </div>
  );
}
