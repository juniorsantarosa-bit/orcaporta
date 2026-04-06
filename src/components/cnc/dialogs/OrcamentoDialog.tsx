import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NestingSheet } from "@/types/promob";
import { Separator } from "@/components/ui/separator";
import { Calculator, Printer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
  companyLogo?: string;
}

interface PricingConfig {
  corteModo: "metro" | "tempo";
  corteValorMetro: number;
  corteVelocidade: number;
  corteValorHora: number;
  fitaValorMetro: number;
  usinagemValorMetro: number;
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
  fitaMetros: number;
  usinagemMetros: number;
  tempoCorteMin: number;
  furos: Record<string, number>;
  totalFuros: number;
  valorCorte: number;
  valorFita: number;
  valorUsinagem: number;
  valorFuros: number;
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

function calcEdgeTapeMeters(sheet: NestingSheet): number {
  let totalMm = 0;
  for (const p of sheet.pieces) {
    if (p.bordaSup) totalMm += p.width;
    if (p.bordaInf) totalMm += p.width;
    if (p.bordaEsq) totalMm += p.height;
    if (p.bordaDir) totalMm += p.height;
  }
  return totalMm / 1000;
}

function calcMachiningMeters(sheet: NestingSheet): number {
  let totalMm = 0;
  for (const p of sheet.pieces) {
    if (p.usinagens && Array.isArray(p.usinagens)) {
      for (const u of p.usinagens) {
        totalMm += u.comprimento || 0;
      }
    }
  }
  return totalMm / 1000;
}

export function OrcamentoDialog({ open, onOpenChange, layouts, companyLogo }: Props) {
  const [pricing, setPricing] = useState<PricingConfig>({
    corteModo: "metro",
    corteValorMetro: 2.50,
    corteVelocidade: 80,
    corteValorHora: 150,
    fitaValorMetro: 1.50,
    usinagemValorMetro: 3.00,
    furo3mm: 0.50,
    furo5mm: 0.80,
    furo8mm: 1.00,
    furo10mm: 1.20,
    furo15mm: 2.00,
    furo35mm: 3.50,
    furoOutro: 1.50,
  });

  const [calculated, setCalculated] = useState<SheetBudget[] | null>(null);

  const update = (key: keyof PricingConfig, value: number | string) => {
    setPricing(prev => ({ ...prev, [key]: value }));
    // Clear calculated when pricing changes so user recalculates
    setCalculated(null);
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
      const fitaMetros = calcEdgeTapeMeters(sheet);
      const usinagemMetros = calcMachiningMeters(sheet);
      const tempoCorteMin = pricing.corteVelocidade > 0 ? (corteMm / pricing.corteVelocidade) / 60 : 0;

      const furos: Record<string, number> = {};
      sheet.pieces.forEach(p => {
        (p.furos || []).forEach(h => {
          const tipo = classifyHole(h.DIAM);
          furos[tipo] = (furos[tipo] || 0) + 1;
        });
      });

      const totalFuros = Object.values(furos).reduce((a, b) => a + b, 0);

      const valorCorte = pricing.corteModo === "metro"
        ? corteMetros * pricing.corteValorMetro
        : (tempoCorteMin / 60) * pricing.corteValorHora;

      const valorFita = fitaMetros * pricing.fitaValorMetro;
      const valorUsinagem = usinagemMetros * pricing.usinagemValorMetro;
      const valorFuros = Object.entries(furos).reduce((sum, [tipo, qtd]) => sum + qtd * holePrice(tipo), 0);

      return {
        sheetId: sheet.id,
        material: sheet.material,
        corteMm,
        corteMetros,
        fitaMetros,
        usinagemMetros,
        tempoCorteMin,
        furos,
        totalFuros,
        valorCorte,
        valorFita,
        valorUsinagem,
        valorFuros,
        valorTotal: valorCorte + valorFita + valorUsinagem + valorFuros,
      };
    });

    setCalculated(budgets);
    toast.success("Orçamento calculado!");
  };

  const handlePrint = () => {
    if (!calculated) {
      toast.error("Calcule o orçamento primeiro!");
      return;
    }
    printBudget(calculated);
  };

  const printBudget = (budgets: SheetBudget[]) => {
    const totalGeral = budgets.reduce((a, b) => a + b.valorTotal, 0);
    const totalMetrosCorte = budgets.reduce((a, b) => a + b.corteMetros, 0);
    const totalMetrosFita = budgets.reduce((a, b) => a + b.fitaMetros, 0);
    const totalMetrosUsinagem = budgets.reduce((a, b) => a + b.usinagemMetros, 0);
    const totalFurosAll = budgets.reduce((a, b) => a + b.totalFuros, 0);
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
      "table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:16px; }",
      "thead tr { background:#f0f0f0; }",
      "th { padding:5px 6px; text-align:left; font-weight:700; color:#333; border-bottom:2px solid #ccc; font-size:9px; text-transform:uppercase; }",
      "td { padding:4px 6px; border-bottom:1px solid #eee; }",
      ".r { text-align:right; }",
      ".c { text-align:center; }",
      ".m { font-family:'JetBrains Mono',monospace; }",
      ".total-row { background:#f0f0f0; font-weight:700; border-top:2px solid #333; }",
      ".total-row td { padding:8px 6px; }",
      ".grand-total { font-size:20px; font-weight:800; text-align:right; margin-top:20px; padding:12px; border:2px solid #333; border-radius:4px; }",
      ".footer { margin-top:24px; font-size:9px; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:8px; }",
    ].join("\n");

    const logoHtml = companyLogo
      ? '<div class="logo"><img src="' + companyLogo + '" alt="Logo"/></div>'
      : '<div class="logo"><span class="logo-text">⚡ MAX<span class="green">CUT</span></span></div>';

    let rows = "";
    budgets.forEach(b => {
      const sheet = layouts.find(l => l.id === b.sheetId);
      rows += "<tr>" +
        '<td class="m" style="font-weight:600">#' + b.sheetId + "</td>" +
        "<td>" + b.material + "</td>" +
        '<td class="r m">' + b.corteMetros.toFixed(2) + "m</td>" +
        '<td class="r m">' + b.fitaMetros.toFixed(2) + "m</td>" +
        '<td class="r m">' + b.usinagemMetros.toFixed(2) + "m</td>" +
        '<td class="c m">' + b.totalFuros + "</td>" +
        '<td class="r m">R$' + b.valorCorte.toFixed(2) + "</td>" +
        '<td class="r m">R$' + b.valorFita.toFixed(2) + "</td>" +
        '<td class="r m">R$' + b.valorUsinagem.toFixed(2) + "</td>" +
        '<td class="r m">R$' + b.valorFuros.toFixed(2) + "</td>" +
        '<td class="r m" style="font-weight:600">R$' + b.valorTotal.toFixed(2) + "</td>" +
        "</tr>";
    });

    doc.open();
    doc.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Orçamento</title>" +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">' +
      "<style>" + css + "</style></head><body>" +
      '<div class="header">' + logoHtml + '<div style="font-size:10px;color:#888">' + today + "</div></div>" +
      '<div class="title">ORÇAMENTO DE CORTE CNC</div>' +
      '<div class="meta">' +
      '<div class="meta-item"><span class="lbl">Cliente: </span><span class="bld">' + clientes + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Data: </span><span class="bld">' + today + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Chapas: </span><span class="bld m">' + budgets.length + "</span></div>" +
      '<div class="meta-item"><span class="lbl">Total Peças: </span><span class="bld m">' + layouts.reduce((a, s) => a + s.pieces.length, 0) + "</span></div>" +
      "</div>" +
      "<table><thead><tr>" +
      "<th>Chapa</th><th>Material</th><th class='r'>M. Corte</th><th class='r'>M. Fita</th><th class='r'>M. Usin.</th><th class='c'>Furos</th><th class='r'>R$ Corte</th><th class='r'>R$ Fita</th><th class='r'>R$ Usin.</th><th class='r'>R$ Furos</th><th class='r'>Total</th>" +
      "</tr></thead><tbody>" + rows +
      '<tr class="total-row">' +
      '<td colspan="2" class="r">TOTAIS</td>' +
      '<td class="r m">' + totalMetrosCorte.toFixed(2) + "m</td>" +
      '<td class="r m">' + totalMetrosFita.toFixed(2) + "m</td>" +
      '<td class="r m">' + totalMetrosUsinagem.toFixed(2) + "m</td>" +
      '<td class="c m">' + totalFurosAll + "</td>" +
      '<td class="r m">R$' + budgets.reduce((a, b) => a + b.valorCorte, 0).toFixed(2) + "</td>" +
      '<td class="r m">R$' + budgets.reduce((a, b) => a + b.valorFita, 0).toFixed(2) + "</td>" +
      '<td class="r m">R$' + budgets.reduce((a, b) => a + b.valorUsinagem, 0).toFixed(2) + "</td>" +
      '<td class="r m">R$' + budgets.reduce((a, b) => a + b.valorFuros, 0).toFixed(2) + "</td>" +
      '<td class="r m">R$' + totalGeral.toFixed(2) + "</td>" +
      "</tr></tbody></table>" +
      '<div class="grand-total">VALOR TOTAL: R$ ' + totalGeral.toFixed(2) + "</div>" +
      '<div class="footer">Orçamento gerado em ' + today + " — Válido por 30 dias</div>" +
      "</body></html>"
    );
    doc.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  const totalGeral = useMemo(() => {
    if (!calculated) return 0;
    return calculated.reduce((a, b) => a + b.valorTotal, 0);
  }, [calculated]);

  const totalMetrosCorte = useMemo(() => calculated?.reduce((a, b) => a + b.corteMetros, 0) ?? 0, [calculated]);
  const totalMetrosFita = useMemo(() => calculated?.reduce((a, b) => a + b.fitaMetros, 0) ?? 0, [calculated]);
  const totalMetrosUsinagem = useMemo(() => calculated?.reduce((a, b) => a + b.usinagemMetros, 0) ?? 0, [calculated]);
  const totalFuros = useMemo(() => calculated?.reduce((a, b) => a + b.totalFuros, 0) ?? 0, [calculated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Orçamento de Corte
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Pricing config */}
          <div className="space-y-4">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Valor do Corte</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-24">Modo</label>
                  <Select value={pricing.corteModo} onValueChange={(v) => update("corteModo", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metro">Valor por metro</SelectItem>
                      <SelectItem value="tempo">Valor por tempo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pricing.corteModo === "metro" ? (
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
                <div className="flex items-center gap-2">
                  <label className="text-xs w-24">Velocidade</label>
                  <Input type="number" step="1" value={pricing.corteVelocidade}
                    onChange={e => update("corteVelocidade", parseFloat(e.target.value) || 1)}
                    className="h-7 text-xs" />
                  <span className="text-[10px] text-muted-foreground">mm/s</span>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Valor da Fita de Borda</legend>
              <div className="flex items-center gap-2">
                <label className="text-xs w-24">R$/metro</label>
                <Input type="number" step="0.01" value={pricing.fitaValorMetro}
                  onChange={e => update("fitaValorMetro", parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs" />
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Valor de Usinagem (LED, recortes)</legend>
              <div className="flex items-center gap-2">
                <label className="text-xs w-24">R$/metro</label>
                <Input type="number" step="0.01" value={pricing.usinagemValorMetro}
                  onChange={e => update("usinagemValorMetro", parseFloat(e.target.value) || 0)}
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

            <div className="flex gap-2">
              <Button onClick={handleCalculate} className="flex-1" disabled={layouts.length === 0}>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Orçamento
              </Button>
              <Button onClick={handlePrint} variant="outline" disabled={!calculated}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
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
                        <th className="text-right px-2 py-1 font-semibold">M. Corte</th>
                        <th className="text-right px-2 py-1 font-semibold">M. Fita</th>
                        <th className="text-right px-2 py-1 font-semibold">M. Usin.</th>
                        <th className="text-right px-2 py-1 font-semibold">Furos</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Corte</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Fita</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Usin.</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Furos</th>
                        <th className="text-right px-2 py-1 font-semibold font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculated.map(b => (
                        <tr key={b.sheetId} className="border-t border-border">
                          <td className="px-2 py-1 font-medium">#{b.sheetId}</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">{b.corteMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">{b.fitaMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">{b.usinagemMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">{b.totalFuros}</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">R${b.valorCorte.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">R${b.valorFita.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">R${b.valorUsinagem.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono text-[10px]">R${b.valorFuros.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono font-bold text-primary">R${b.valorTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Separator />

                <div className="bg-muted/30 rounded p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total metros de corte:</span>
                    <span className="font-mono font-semibold">{totalMetrosCorte.toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total metros de fita:</span>
                    <span className="font-mono font-semibold">{totalMetrosFita.toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total metros de usinagem:</span>
                    <span className="font-mono font-semibold">{totalMetrosUsinagem.toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total de furos:</span>
                    <span className="font-mono font-semibold">{totalFuros}</span>
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
                    <legend className="text-[10px] font-medium px-1">Detalhamento Furos</legend>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {["3mm", "5mm", "8mm", "10mm", "15mm", "35mm", "outro"].map(tipo => {
                        const total = calculated.reduce((a, b) => a + (b.furos[tipo] || 0), 0);
                        if (total === 0) return null;
                        return (
                          <div key={tipo} className="flex justify-between px-1 py-0.5 bg-muted/20 rounded">
                            <span>Ø{tipo}</span>
                            <span className="font-mono">{total}×R${holePrice(tipo).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
                <Calculator className="h-10 w-10 opacity-30" />
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
