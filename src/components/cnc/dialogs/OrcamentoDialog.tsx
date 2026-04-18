import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NestingSheet } from "@/types/promob";
import { Separator } from "@/components/ui/separator";
import { Calculator, FileText } from "lucide-react";
import { toast } from "sonner";
import { countSerraCuts } from "@/lib/serraOptimizer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
  companyLogo?: string;
  cutMode?: "cnc" | "serra";
}

interface PricingConfig {
  corteModo: "metro" | "tempo" | "corte";
  corteValorMetro: number;
  corteVelocidade: number;
  corteValorHora: number;
  corteValorPorCorte: number;
  fitaBordaValorMetro: number;
  furo3mm: number;
  furo5mm: number;
  furo8mm: number;
  furo10mm: number;
  furo15mm: number;
  furo35mm: number;
  furoOutro: number;
}

interface SheetBudget {
  sheetId: number;
  material: string;
  corteMm: number;
  corteMetros: number;
  tempoCorteMin: number;
  numCortes: number;
  fitaBordaMetros: number;
  furos: Record<string, number>;
  totalFuros: number;
  valorCorte: number;
  valorFuros: number;
  valorFitaBorda: number;
  valorTotal: number;
}

function classifyHole(diam: number): string {
  if (diam <= 3) return "3mm";
  if (diam <= 5) return "5mm";
  if (diam <= 8) return "8mm";
  if (diam <= 10) return "10mm";
  if (diam <= 15) return "15mm";
  if (diam <= 35) return "35mm";
  return "outro";
}

function calcCuttingPerimeter(sheet: NestingSheet): number {
  let totalPerimeter = 0;
  const pieces = sheet.pieces;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    let perim = 2 * (p.width + p.height);

    for (let j = 0; j < pieces.length; j++) {
      if (i === j) continue;
      const q = pieces[j];
      if (Math.abs(p.x + p.width - q.x) < 10) {
        const overlapY = Math.max(0, Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y));
        if (overlapY > 0) perim -= overlapY;
      }
      if (Math.abs(p.y + p.height - q.y) < 10) {
        const overlapX = Math.max(0, Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x));
        if (overlapX > 0) perim -= overlapX;
      }
    }
    totalPerimeter += Math.max(perim, 0);
  }

  return totalPerimeter;
}

export function OrcamentoDialog({ open, onOpenChange, layouts, companyLogo, cutMode = "cnc" }: Props) {
  const isSerra = cutMode === "serra";
  const [pricing, setPricing] = useState<PricingConfig>({
    corteModo: isSerra ? "corte" : "metro",
    corteValorMetro: 2.5,
    corteVelocidade: 80,
    corteValorHora: 150,
    corteValorPorCorte: 1.5,
    fitaBordaValorMetro: 1.0,
    furo3mm: 0.5,
    furo5mm: 0.8,
    furo8mm: 1.0,
    furo10mm: 1.2,
    furo15mm: 2.0,
    furo35mm: 3.5,
    furoOutro: 1.5,
  });

  const [calculated, setCalculated] = useState<SheetBudget[] | null>(null);

  const update = (key: keyof PricingConfig, value: number | string) => {
    setPricing(prev => ({ ...prev, [key]: value }));
  };

  const holePrice = (type: string): number => {
    const map: Record<string, keyof PricingConfig> = {
      "3mm": "furo3mm", "5mm": "furo5mm", "8mm": "furo8mm",
      "10mm": "furo10mm", "15mm": "furo15mm", "35mm": "furo35mm", "outro": "furoOutro",
    };
    return (pricing[map[type]] as number) || 0;
  };

  const handleCalculate = () => {
    const budgets: SheetBudget[] = layouts.map(sheet => {
      const corteMm = calcCuttingPerimeter(sheet);
      const corteMetros = corteMm / 1000;
      const tempoCorteMin = pricing.corteVelocidade > 0 ? (corteMm / pricing.corteVelocidade) / 60 : 0;
      const numCortes = isSerra ? countSerraCuts(sheet) : 0;

      let fitaBordaMm = 0;
      sheet.pieces.forEach(p => {
        if (p.bordaSup) fitaBordaMm += p.width;
        if (p.bordaInf) fitaBordaMm += p.width;
        if (p.bordaEsq) fitaBordaMm += p.height;
        if (p.bordaDir) fitaBordaMm += p.height;
      });
      const fitaBordaMetros = fitaBordaMm / 1000;

      const furos: Record<string, number> = {};
      sheet.pieces.forEach(p => {
        (p.furos || []).forEach(h => {
          const tipo = classifyHole(h.DIAM);
          furos[tipo] = (furos[tipo] || 0) + 1;
        });
      });

      const totalFuros = Object.values(furos).reduce((a, b) => a + b, 0);

      let valorCorte: number;
      if (pricing.corteModo === "corte") {
        valorCorte = numCortes * pricing.corteValorPorCorte;
      } else if (pricing.corteModo === "metro") {
        valorCorte = corteMetros * pricing.corteValorMetro;
      } else {
        valorCorte = (tempoCorteMin / 60) * pricing.corteValorHora;
      }

      const valorFuros = Object.entries(furos).reduce((sum, [tipo, qtd]) => sum + qtd * holePrice(tipo), 0);
      const valorFitaBorda = fitaBordaMetros * pricing.fitaBordaValorMetro;

      return {
        sheetId: sheet.id,
        material: sheet.material,
        corteMm,
        corteMetros,
        tempoCorteMin,
        numCortes,
        fitaBordaMetros,
        furos,
        totalFuros,
        valorCorte,
        valorFuros,
        valorFitaBorda,
        valorTotal: valorCorte + valorFuros + valorFitaBorda,
      };
    });

    setCalculated(budgets);
    toast.success("Orçamento calculado!");
    printBudget(budgets);
  };

  const printBudget = (budgets: SheetBudget[]) => {
    const totalGeral = budgets.reduce((a, b) => a + b.valorTotal, 0);
    const totalMetros = budgets.reduce((a, b) => a + b.corteMetros, 0);
    const totalCortesAll = budgets.reduce((a, b) => a + b.numCortes, 0);
    const totalFurosAll = budgets.reduce((a, b) => a + b.totalFuros, 0);
    const totalFitaMetros = budgets.reduce((a, b) => a + b.fitaBordaMetros, 0);
    const today = new Date().toLocaleDateString("pt-BR");
    const clientes = [...new Set(layouts.flatMap(s => s.pieces.map(p => p.cliente)))].filter(Boolean).join(", ") || "—";

    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado"); return; }
    const doc = printWindow.document;

    const css = [
      "@page { size:A4 portrait; margin:12mm; }",
      "* { margin:0; padding:0; box-sizing:border-box; }",
      "body { font-family:Inter,system-ui,sans-serif; color:#000; background:#fff; padding:8px; }",
      ".header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:16px; }",
      ".logo img { max-height:40px; max-width:160px; object-fit:contain; }",
      ".logo-text { font-size:16px; font-weight:800; }",
      ".green { color:#059669; }",
      ".title { font-size:18px; font-weight:700; text-align:center; margin-bottom:16px; }",
      ".meta { display:flex; flex-wrap:wrap; gap:16px; font-size:11px; color:#444; margin-bottom:20px; padding:8px; background:#f8f8f8; border-radius:4px; }",
      ".meta-item { display:flex; gap:4px; }",
      ".lbl { color:#888; }",
      ".bld { font-weight:600; }",
      "table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px; }",
      "thead tr { background:#f0f0f0; }",
      "th { padding:6px 8px; text-align:left; font-weight:700; color:#333; border-bottom:2px solid #ccc; font-size:10px; text-transform:uppercase; }",
      "td { padding:5px 8px; border-bottom:1px solid #eee; }",
      ".r { text-align:right; }",
      ".c { text-align:center; }",
      ".m { font-family:'JetBrains Mono',monospace; }",
      ".total-row { background:#f0f0f0; font-weight:700; border-top:2px solid #333; }",
      ".total-row td { padding:8px; }",
      ".grand-total { font-size:20px; font-weight:800; text-align:right; margin-top:20px; padding:12px; border:2px solid #333; border-radius:4px; }",
      ".footer { margin-top:24px; font-size:9px; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:8px; }",
    ].join("\n");

    const logoHtml = companyLogo
      ? '<div class="logo"><img src="' + companyLogo + '" alt="Logo"/></div>'
      : '<div class="logo"><span class="logo-text">⚡ MAX<span class="green">CUT</span></span></div>';

    const corteLabel = isSerra ? "Cortes" : "Corte";
    const titleMode = isSerra ? "ORÇAMENTO DE CORTE (SERRA)" : "ORÇAMENTO DE CORTE CNC";

    let rows = "";
    budgets.forEach(b => {
      const sheet = layouts.find(l => l.id === b.sheetId);
      const corteVal = isSerra ? b.numCortes + " cortes" : b.corteMetros.toFixed(2) + "m";
      rows += "<tr>" +
        '<td class="m" style="font-weight:600">#' + b.sheetId + "</td>" +
        "<td>" + b.material + "</td>" +
        '<td class="c m">' + (sheet ? sheet.sheetWidth + "×" + sheet.sheetHeight : "—") + "</td>" +
        '<td class="c m">' + (sheet ? sheet.espessura + "mm" : "—") + "</td>" +
        '<td class="c m">' + (sheet ? sheet.pieces.length : 0) + "</td>" +
        '<td class="r m">' + corteVal + "</td>" +
        '<td class="r m">' + b.fitaBordaMetros.toFixed(2) + "m</td>" +
        '<td class="c m">' + b.totalFuros + "</td>" +
        '<td class="r m" style="font-weight:600">R$ ' + b.valorTotal.toFixed(2) + "</td>" +
        "</tr>";
    });

    const totalCorteVal = isSerra ? totalCortesAll + " cortes" : totalMetros.toFixed(2) + "m";
    const totalValorFuros = budgets.reduce((a, b) => a + b.valorFuros, 0);

    const allHoleTypes = ["3mm", "5mm", "8mm", "10mm", "15mm", "35mm", "outro"];
    const holeTotals = allHoleTypes.map(tipo => ({
      tipo,
      count: budgets.reduce((a, b) => a + (b.furos[tipo] || 0), 0),
      valor: budgets.reduce((a, b) => a + (b.furos[tipo] || 0), 0) * holePrice(tipo),
    })).filter(h => h.count > 0);

    let holesBreakdownHtml = "";
    if (holeTotals.length > 0) {
      holesBreakdownHtml = '<div style="margin-top:16px;border:1px solid #ccc;border-radius:4px;padding:8px">' +
        '<div style="font-size:10px;font-weight:700;margin-bottom:4px">DETALHAMENTO DE FUROS POR DIÂMETRO</div>' +
        '<table style="width:100%;font-size:10px;border-collapse:collapse">' +
        '<tr style="background:#f0f0f0"><th style="text-align:left;padding:3px">Diâmetro</th><th style="text-align:center;padding:3px">Qtd</th><th style="text-align:right;padding:3px">Unit.</th><th style="text-align:right;padding:3px">Total</th></tr>' +
        holeTotals.map(h => '<tr><td style="padding:3px">Ø' + h.tipo + '</td><td style="text-align:center;padding:3px">' + h.count + '</td><td style="text-align:right;padding:3px">R$ ' + holePrice(h.tipo).toFixed(2) + '</td><td style="text-align:right;padding:3px;font-weight:600">R$ ' + h.valor.toFixed(2) + '</td></tr>').join('') +
        '<tr style="border-top:2px solid #333;font-weight:700"><td colspan="3" style="padding:3px;text-align:right">TOTAL FUROS:</td><td style="text-align:right;padding:3px">R$ ' + totalValorFuros.toFixed(2) + '</td></tr>' +
        '</table></div>';
    }

    doc.open();
    doc.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Orçamento</title>" +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">' +
      "<style>" + css + "</style></head><body>" +
      '<div class="header">' + logoHtml + '<div style="font-size:10px;color:#888">' + today + "</div></div>" +
      '<div class="title">' + titleMode + '</div>' +
      '<div class="meta">' +
      '<div class="meta-item"><span class="lbl">Cliente: </span><span class="bld">' + clientes + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Data: </span><span class="bld">' + today + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Chapas: </span><span class="bld m">' + budgets.length + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Total Peças: </span><span class="bld m">' + layouts.reduce((a, s) => a + s.pieces.length, 0) + "</span></div>" +
      "</div>" +
      "<table><thead><tr>" +
      "<th>Chapa</th><th>Material</th><th class='c'>Dimensão</th><th class='c'>Espessura</th><th class='c'>Peças</th><th class='r'>" + corteLabel + "</th><th class='r'>Fita</th><th class='c'>Furos</th><th class='r'>Valor</th>" +
      "</tr></thead><tbody>" + rows +
      '<tr class="total-row">' +
      '<td colspan="5" class="r">TOTAIS</td>' +
      '<td class="r m">' + totalCorteVal + "</td>" +
      '<td class="r m">' + totalFitaMetros.toFixed(2) + "m</td>" +
      '<td class="c m">' + totalFurosAll + "</td>" +
      '<td class="r m">R$ ' + totalGeral.toFixed(2) + "</td>" +
      "</tr></tbody></table>" +
      holesBreakdownHtml +
      '<div class="grand-total">VALOR TOTAL: R$ ' + totalGeral.toFixed(2) + "</div>" +
      '<div class="footer">Orçamento gerado em ' + today + " — Válido por 30 dias</div>" +
      "</body></html>"
    );
    doc.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  const totalGeral = useMemo(
    () => (calculated ? calculated.reduce((a, b) => a + b.valorTotal, 0) : 0),
    [calculated]
  );
  const totalMetros = useMemo(
    () => (calculated ? calculated.reduce((a, b) => a + b.corteMetros, 0) : 0),
    [calculated]
  );
  const totalFuros = useMemo(
    () => (calculated ? calculated.reduce((a, b) => a + b.totalFuros, 0) : 0),
    [calculated]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[950px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Orçamento de Corte {isSerra && <span className="text-xs text-muted-foreground">(Modo Serra)</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Pricing config */}
          <div className="space-y-4">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">
                Valor do Corte {isSerra && <span className="text-primary">(Serra)</span>}
              </legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-24">Modo</label>
                  <Select value={pricing.corteModo} onValueChange={(v) => update("corteModo", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isSerra ? (
                        <SelectItem value="corte">Valor por corte</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="metro">Valor por metro</SelectItem>
                          <SelectItem value="tempo">Valor por tempo</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {pricing.corteModo === "corte" ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">R$/corte</label>
                    <Input type="number" step="0.01" value={pricing.corteValorPorCorte}
                      onChange={e => update("corteValorPorCorte", parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs" />
                  </div>
                ) : pricing.corteModo === "metro" ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">R$/metro</label>
                    <Input type="number" step="0.01" value={pricing.corteValorMetro}
                      onChange={e => update("corteValorMetro", parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">R$/hora</label>
                    <Input type="number" step="0.01" value={pricing.corteValorHora}
                      onChange={e => update("corteValorHora", parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs" />
                  </div>
                )}
                {!isSerra && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">Velocidade</label>
                    <Input type="number" step="1" value={pricing.corteVelocidade}
                      onChange={e => update("corteVelocidade", parseFloat(e.target.value) || 1)}
                      className="h-7 text-xs" />
                    <span className="text-[10px] text-muted-foreground">mm/s</span>
                  </div>
                )}
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Fita de Borda</legend>
              <div className="flex items-center gap-2">
                <label className="text-xs w-24">R$/metro</label>
                <Input type="number" step="0.01" value={pricing.fitaBordaValorMetro}
                  onChange={e => update("fitaBordaValorMetro", parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs" />
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Valor por Tipo de Furo</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["furo3mm", "Ø3mm"], ["furo5mm", "Ø5mm"], ["furo8mm", "Ø8mm"],
                  ["furo10mm", "Ø10mm"], ["furo15mm", "Ø15mm"], ["furo35mm", "Ø35mm"], ["furoOutro", "Outro"],
                ] as [keyof PricingConfig, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1">
                    <label className="text-[10px] w-12">{label}</label>
                    <span className="text-[10px] text-muted-foreground">R$</span>
                    <Input type="number" step="0.01" value={pricing[key] as number}
                      onChange={e => update(key, parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs flex-1" />
                  </div>
                ))}
              </div>
            </fieldset>

            <Button onClick={handleCalculate} className="w-full" disabled={layouts.length === 0}>
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Orçamento
            </Button>
          </div>

          {/* Right: Results */}
          <div className="space-y-3">
            {calculated ? (
              <>
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-2 py-1 font-semibold">Chapa</th>
                        <th className="text-right px-2 py-1 font-semibold">{isSerra ? "Cortes" : "Metros"}</th>
                        <th className="text-right px-2 py-1 font-semibold">Fita (m)</th>
                        <th className="text-right px-2 py-1 font-semibold">Furos</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Corte</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Fita</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Furos</th>
                        <th className="text-right px-2 py-1 font-semibold font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculated.map(b => (
                        <tr key={b.sheetId} className="border-t border-border">
                          <td className="px-2 py-1 font-medium">#{b.sheetId}</td>
                          <td className="px-2 py-1 text-right font-mono">
                            {isSerra ? `${b.numCortes} cortes` : `${b.corteMetros.toFixed(2)}m`}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">{b.fitaBordaMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1 text-right font-mono">{b.totalFuros}</td>
                          <td className="px-2 py-1 text-right font-mono">R${b.valorCorte.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono">R${b.valorFitaBorda.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono">R${b.valorFuros.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono font-bold text-primary">R${b.valorTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Separator />

                <div className="bg-muted/30 rounded p-3 space-y-1">
                  {isSerra ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total de cortes (serra):</span>
                      <span className="font-mono font-semibold">{calculated.reduce((a, b) => a + b.numCortes, 0)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total metros de corte:</span>
                      <span className="font-mono font-semibold">{totalMetros.toFixed(2)}m</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total de furos:</span>
                    <span className="font-mono font-semibold">{totalFuros}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valor total furos:</span>
                    <span className="font-mono font-semibold text-primary">R${calculated.reduce((a, b) => a + b.valorFuros, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total fita de borda:</span>
                    <span className="font-mono font-semibold">{calculated.reduce((a, b) => a + b.fitaBordaMetros, 0).toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valor total fita:</span>
                    <span className="font-mono font-semibold text-primary">R${calculated.reduce((a, b) => a + b.valorFitaBorda, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Chapas:</span>
                    <span className="font-mono font-semibold">{calculated.length}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">VALOR TOTAL:</span>
                    <span className="font-mono font-bold text-lg text-primary">R${totalGeral.toFixed(2)}</span>
                  </div>
                </div>

                {calculated.some(b => b.totalFuros > 0) && (
                  <fieldset className="border border-border rounded p-2">
                    <legend className="text-[10px] font-medium px-1">Detalhamento Furos (por diâmetro)</legend>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {["3mm", "5mm", "8mm", "10mm", "15mm", "35mm", "outro"].map(tipo => {
                        const total = calculated.reduce((a, b) => a + (b.furos[tipo] || 0), 0);
                        if (total === 0) return null;
                        const valor = total * holePrice(tipo);
                        return (
                          <div key={tipo} className="flex justify-between px-1 py-0.5 bg-muted/20 rounded">
                            <span>Ø{tipo}: {total}un</span>
                            <span className="font-mono text-primary">R${valor.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-xs">Configure os valores e clique em Calcular</p>
                <p className="text-[10px]">{layouts.length} chapas disponíveis</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
