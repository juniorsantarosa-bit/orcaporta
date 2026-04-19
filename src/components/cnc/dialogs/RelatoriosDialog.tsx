import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Printer } from "lucide-react";
import { listQuotes } from "@/lib/commercialStore";
import type { SavedQuote } from "@/types/commercial";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GroupBy = "periodo" | "cliente" | "servico";

export function RelatoriosDialog({ open, onOpenChange }: Props) {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("periodo");
  const [onlyPagos, setOnlyPagos] = useState(false);
  const [onlyEnviados, setOnlyEnviados] = useState(false);

  useEffect(() => {
    if (open) setQuotes(listQuotes());
  }, [open]);

  const filtered = useMemo(() => {
    return quotes.filter(q => {
      const d = q.createdAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (onlyPagos && !q.status.pago) return false;
      if (onlyEnviados && !q.status.enviado) return false;
      return true;
    });
  }, [quotes, from, to, onlyPagos, onlyEnviados]);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; total: number; pagos: number; enviados: number; valorPago: number }>();
    const bump = (key: string, q: SavedQuote, weight = 1) => {
      const cur = map.get(key) ?? { count: 0, total: 0, pagos: 0, enviados: 0, valorPago: 0 };
      cur.count += weight;
      cur.total += q.totalCalculado * weight;
      if (q.status.pago) { cur.pagos += weight; cur.valorPago += q.totalCalculado * weight; }
      if (q.status.enviado) cur.enviados += weight;
      map.set(key, cur);
    };

    for (const q of filtered) {
      if (groupBy === "periodo") {
        const ym = q.createdAt.slice(0, 7); // YYYY-MM
        bump(ym, q);
      } else if (groupBy === "cliente") {
        bump(q.clienteNome || "Sem cliente", q);
      } else {
        // por serviço — usa peças para inferir presença de fresa/serra/fita
        const tags = new Set<string>();
        for (const p of q.pieces) {
          if (p.source === "aspire") {
            const ft = p.aspireFrisoCutType
              ?? (p.aspireSides?.some(s => (s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra")) === "fresa") ? "fresa" : "serra");
            tags.add(ft);
            if (p.aspireSides?.some(s => s.banded)) tags.add("fita");
          } else {
            tags.add("serra");
            if (p.bordaSup || p.bordaInf || p.bordaEsq || p.bordaDir) tags.add("fita");
            if ((p.numFurosOrcamento ?? p.furos?.length ?? 0) > 0) tags.add("furos");
          }
        }
        if (tags.size === 0) tags.add("Outros");
        for (const t of tags) bump(t, q);
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, groupBy]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((a, q) => a + q.totalCalculado, 0),
    pagos: filtered.filter(q => q.status.pago).length,
    valorPago: filtered.filter(q => q.status.pago).reduce((a, q) => a + q.totalCalculado, 0),
    enviados: filtered.filter(q => q.status.enviado).length,
    valorEnviado: filtered.filter(q => q.status.enviado).reduce((a, q) => a + q.totalCalculado, 0),
  }), [filtered]);

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const today = new Date().toLocaleDateString("pt-BR");
    const groupLabel = { periodo: "Período (mês)", cliente: "Cliente", servico: "Serviço" }[groupBy];
    const rows = grouped.map(g => `<tr>
      <td>${g.key}</td>
      <td class="c">${g.count}</td>
      <td class="c">${g.enviados}</td>
      <td class="c">${g.pagos}</td>
      <td class="r">R$ ${g.total.toFixed(2)}</td>
      <td class="r">R$ ${g.valorPago.toFixed(2)}</td>
    </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório</title>
      <style>
        @page { size:A4 portrait; margin:14mm; }
        body { font-family: Inter, system-ui, sans-serif; font-size: 11px; color:#000; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .meta { font-size: 10px; color:#666; margin-bottom: 14px; }
        table { width:100%; border-collapse: collapse; }
        th { background:#f0f0f0; padding:6px; text-align:left; font-size:10px; text-transform:uppercase; border-bottom: 2px solid #ccc; }
        td { padding: 5px 6px; border-bottom: 1px solid #eee; }
        .r { text-align:right; } .c { text-align:center; }
        .total-row { background:#f0f0f0; font-weight:700; border-top:2px solid #333; }
      </style></head><body>
      <h1>Relatório Comercial</h1>
      <div class="meta">
        Agrupado por: <b>${groupLabel}</b> · Período: ${from || "início"} a ${to || "hoje"}
        ${onlyPagos ? " · apenas pagos" : ""}${onlyEnviados ? " · apenas enviados" : ""}
        · Gerado em ${today}
      </div>
      <table>
        <thead><tr>
          <th>${groupLabel}</th>
          <th class="c">Orçamentos</th>
          <th class="c">Enviados</th>
          <th class="c">Pagos</th>
          <th class="r">Valor total</th>
          <th class="r">Valor pago</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td>TOTAL</td>
            <td class="c">${totals.count}</td>
            <td class="c">${totals.enviados}</td>
            <td class="c">${totals.pagos}</td>
            <td class="r">R$ ${totals.total.toFixed(2)}</td>
            <td class="r">R$ ${totals.valorPago.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatórios
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-2 items-end">
          <div>
            <Label className="text-[10px] uppercase">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase">Agrupar por</Label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="h-8 text-xs w-full rounded border border-input bg-background px-2"
            >
              <option value="periodo">Período (mês)</option>
              <option value="cliente">Cliente</option>
              <option value="servico">Tipo de serviço</option>
            </select>
          </div>
          <label className="flex items-center gap-1 text-xs h-8">
            <input type="checkbox" checked={onlyEnviados} onChange={(e) => setOnlyEnviados(e.target.checked)} />
            Só enviados
          </label>
          <label className="flex items-center gap-1 text-xs h-8">
            <input type="checkbox" checked={onlyPagos} onChange={(e) => setOnlyPagos(e.target.checked)} />
            Só pagos
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatCard label="Orçamentos" value={String(totals.count)} extra={`R$ ${totals.total.toFixed(2)}`} />
          <StatCard label="Enviados" value={String(totals.enviados)} extra={`R$ ${totals.valorEnviado.toFixed(2)}`} />
          <StatCard label="Pagos" value={String(totals.pagos)} extra={`R$ ${totals.valorPago.toFixed(2)}`} highlight />
        </div>

        <ScrollArea className="flex-1 border border-border rounded mt-2">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr className="text-[10px] uppercase text-muted-foreground">
                <th className="text-left px-2 py-2">{groupBy === "periodo" ? "Mês" : groupBy === "cliente" ? "Cliente" : "Serviço"}</th>
                <th className="text-center px-2 py-2">Orçamentos</th>
                <th className="text-center px-2 py-2">Enviados</th>
                <th className="text-center px-2 py-2">Pagos</th>
                <th className="text-right px-2 py-2">Valor total</th>
                <th className="text-right px-2 py-2">Valor pago</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
              ) : grouped.map(g => (
                <tr key={g.key} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{g.key}</td>
                  <td className="px-2 py-1.5 text-center">{g.count}</td>
                  <td className="px-2 py-1.5 text-center">{g.enviados}</td>
                  <td className="px-2 py-1.5 text-center">{g.pagos}</td>
                  <td className="px-2 py-1.5 text-right">R$ {g.total.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-primary">R$ {g.valorPago.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint} disabled={grouped.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, extra, highlight }: { label: string; value: string; extra?: string; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      {extra && <div className="text-[10px] text-muted-foreground">{extra}</div>}
    </div>
  );
}
