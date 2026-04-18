import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet } from "@/types/promob";
import { Calculator, Printer } from "lucide-react";
import { countSerraCuts } from "@/lib/serraOptimizer";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
}

// Valores fixos (não editáveis)
const PRECO_CORTE = 3.0;       // R$ por corte
const PRECO_FITA = 4.5;        // R$ por metro de fita
const PRECO_FURO = 0.10;       // R$ por furo

interface SheetBudget {
  sheetId: number;
  material: string;
  espessura: number;
  numPecas: number;
  numCortes: number;
  fitaMetros: number;
  numFuros: number;
  valorCortes: number;
  valorFita: number;
  valorFuros: number;
  valorTotal: number;
}

export function OrcamentoSimplesDialog({ open, onOpenChange, layouts }: Props) {
  const budgets = useMemo<SheetBudget[]>(() => {
    return layouts.map(sheet => {
      const numCortes = countSerraCuts(sheet);

      let fitaMm = 0;
      let numFuros = 0;
      sheet.pieces.forEach(p => {
        if (p.bordaSup) fitaMm += p.width;
        if (p.bordaInf) fitaMm += p.width;
        if (p.bordaEsq) fitaMm += p.height;
        if (p.bordaDir) fitaMm += p.height;
        numFuros += (p.furos || []).length;
      });
      const fitaMetros = fitaMm / 1000;

      const valorCortes = numCortes * PRECO_CORTE;
      const valorFita = fitaMetros * PRECO_FITA;
      const valorFuros = numFuros * PRECO_FURO;

      return {
        sheetId: sheet.id,
        material: sheet.material,
        espessura: sheet.espessura,
        numPecas: sheet.pieces.length,
        numCortes,
        fitaMetros,
        numFuros,
        valorCortes,
        valorFita,
        valorFuros,
        valorTotal: valorCortes + valorFita + valorFuros,
      };
    });
  }, [layouts]);

  const totals = useMemo(() => ({
    cortes: budgets.reduce((a, b) => a + b.numCortes, 0),
    fita: budgets.reduce((a, b) => a + b.fitaMetros, 0),
    furos: budgets.reduce((a, b) => a + b.numFuros, 0),
    valorCortes: budgets.reduce((a, b) => a + b.valorCortes, 0),
    valorFita: budgets.reduce((a, b) => a + b.valorFita, 0),
    valorFuros: budgets.reduce((a, b) => a + b.valorFuros, 0),
    total: budgets.reduce((a, b) => a + b.valorTotal, 0),
  }), [budgets]);

  const handlePrint = () => {
    const today = new Date().toLocaleDateString("pt-BR");
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloqueado"); return; }

    const css = `
      @page { size:A4 portrait; margin:14mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Inter,system-ui,sans-serif; color:#000; background:#fff; padding:8px; }
      .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:16px; }
      .logo { font-size:18px; font-weight:800; }
      .green { color:#059669; }
      .title { font-size:18px; font-weight:700; text-align:center; margin-bottom:16px; }
      .info { background:#f8f8f8; padding:8px; border-radius:4px; font-size:11px; margin-bottom:16px; display:flex; gap:24px; }
      table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px; }
      th { background:#f0f0f0; padding:6px; text-align:left; font-size:10px; text-transform:uppercase; border-bottom:2px solid #ccc; }
      td { padding:5px 6px; border-bottom:1px solid #eee; }
      .r { text-align:right; }
      .c { text-align:center; }
      .total-row { background:#f0f0f0; font-weight:700; border-top:2px solid #333; }
      .pricing { margin-top:8px; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:10px; background:#fafafa; }
      .pricing-title { font-weight:700; margin-bottom:4px; }
      .grand { font-size:22px; font-weight:800; text-align:right; margin-top:16px; padding:14px; border:2px solid #333; border-radius:4px; }
      .footer { margin-top:24px; font-size:9px; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:8px; }
    `;

    let rows = "";
    budgets.forEach(b => {
      rows += `<tr>
        <td><b>#${b.sheetId}</b></td>
        <td>${b.material}</td>
        <td class="c">${b.espessura}mm</td>
        <td class="c">${b.numPecas}</td>
        <td class="c">${b.numCortes}</td>
        <td class="r">${b.fitaMetros.toFixed(2)}m</td>
        <td class="c">${b.numFuros}</td>
        <td class="r"><b>R$ ${b.valorTotal.toFixed(2)}</b></td>
      </tr>`;
    });

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>${css}</style></head><body>
      <div class="header">
        <div class="logo">⚡ MAX<span class="green">CUT</span></div>
        <div style="font-size:10px;color:#888">${today}</div>
      </div>
      <div class="title">ORÇAMENTO DE CORTE</div>
      <div class="info">
        <div><b>Data:</b> ${today}</div>
        <div><b>Chapas:</b> ${budgets.length}</div>
        <div><b>Total Peças:</b> ${layouts.reduce((a, s) => a + s.pieces.length, 0)}</div>
      </div>
      <table>
        <thead><tr>
          <th>Chapa</th><th>Material</th><th class="c">Esp.</th><th class="c">Peças</th>
          <th class="c">Cortes</th><th class="r">Fita</th><th class="c">Furos</th><th class="r">Valor</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="4" class="r">TOTAIS</td>
            <td class="c">${totals.cortes}</td>
            <td class="r">${totals.fita.toFixed(2)}m</td>
            <td class="c">${totals.furos}</td>
            <td class="r">R$ ${totals.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div class="pricing">
        <div class="pricing-title">VALORES UNITÁRIOS APLICADOS</div>
        <div>Corte: R$ ${PRECO_CORTE.toFixed(2)} cada &nbsp;|&nbsp; Fita de Borda: R$ ${PRECO_FITA.toFixed(2)}/m &nbsp;|&nbsp; Furo: R$ ${PRECO_FURO.toFixed(2)} cada</div>
        <div style="margin-top:6px">
          Subtotal Cortes: <b>R$ ${totals.valorCortes.toFixed(2)}</b> &nbsp;|&nbsp;
          Subtotal Fita: <b>R$ ${totals.valorFita.toFixed(2)}</b> &nbsp;|&nbsp;
          Subtotal Furos: <b>R$ ${totals.valorFuros.toFixed(2)}</b>
        </div>
      </div>
      <div class="grand">VALOR TOTAL: R$ ${totals.total.toFixed(2)}</div>
      <div class="footer">Orçamento gerado em ${today} — Válido por 30 dias</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Orçamento de Corte (Serra)
          </DialogTitle>
        </DialogHeader>

        {layouts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Otimize o plano de corte primeiro para gerar o orçamento.
          </div>
        ) : (
          <>
            <div className="rounded border border-border bg-muted/30 p-3 text-xs">
              <div className="font-semibold mb-1.5 text-foreground">Valores aplicados (fixos):</div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <div>Corte: <span className="text-foreground font-medium">R$ {PRECO_CORTE.toFixed(2)}</span> cada</div>
                <div>Fita de borda: <span className="text-foreground font-medium">R$ {PRECO_FITA.toFixed(2)}</span> /metro</div>
                <div>Furo: <span className="text-foreground font-medium">R$ {PRECO_FURO.toFixed(2)}</span> cada</div>
              </div>
            </div>

            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="px-2 py-2 text-left">Chapa</th>
                    <th className="px-2 py-2 text-left">Material</th>
                    <th className="px-2 py-2 text-center">Esp.</th>
                    <th className="px-2 py-2 text-center">Peças</th>
                    <th className="px-2 py-2 text-center">Cortes</th>
                    <th className="px-2 py-2 text-right">Fita</th>
                    <th className="px-2 py-2 text-center">Furos</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map(b => (
                    <tr key={b.sheetId} className="border-t border-border">
                      <td className="px-2 py-1.5 font-mono">#{b.sheetId}</td>
                      <td className="px-2 py-1.5">{b.material}</td>
                      <td className="px-2 py-1.5 text-center">{b.espessura}mm</td>
                      <td className="px-2 py-1.5 text-center">{b.numPecas}</td>
                      <td className="px-2 py-1.5 text-center">{b.numCortes}</td>
                      <td className="px-2 py-1.5 text-right">{b.fitaMetros.toFixed(2)}m</td>
                      <td className="px-2 py-1.5 text-center">{b.numFuros}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">R$ {b.valorTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-foreground/40 bg-muted font-semibold">
                    <td colSpan={4} className="px-2 py-2 text-right">TOTAIS</td>
                    <td className="px-2 py-2 text-center">{totals.cortes}</td>
                    <td className="px-2 py-2 text-right">{totals.fita.toFixed(2)}m</td>
                    <td className="px-2 py-2 text-center">{totals.furos}</td>
                    <td className="px-2 py-2 text-right">R$ {totals.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-border p-2">
                <div className="text-muted-foreground text-[10px] uppercase">Subtotal Cortes</div>
                <div className="font-semibold">R$ {totals.valorCortes.toFixed(2)}</div>
              </div>
              <div className="rounded border border-border p-2">
                <div className="text-muted-foreground text-[10px] uppercase">Subtotal Fita</div>
                <div className="font-semibold">R$ {totals.valorFita.toFixed(2)}</div>
              </div>
              <div className="rounded border border-border p-2">
                <div className="text-muted-foreground text-[10px] uppercase">Subtotal Furos</div>
                <div className="font-semibold">R$ {totals.valorFuros.toFixed(2)}</div>
              </div>
            </div>

            <div className="rounded border-2 border-primary/40 bg-primary/5 p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">VALOR TOTAL</span>
              <span className="text-2xl font-bold text-primary">R$ {totals.total.toFixed(2)}</span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {layouts.length > 0 && (
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
