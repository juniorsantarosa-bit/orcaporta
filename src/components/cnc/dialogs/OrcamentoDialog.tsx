import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NestingSheet } from "@/types/promob";
import { Separator } from "@/components/ui/separator";
import { Calculator, FileText } from "lucide-react";
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
  corteVelocidade: number; // mm/s
  corteValorHora: number;
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
  furos: Record<string, number>;
  totalFuros: number;
  valorCorte: number;
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
  // Calculate total unique cutting perimeter considering shared edges
  let totalPerimeter = 0;
  const pieces = sheet.pieces;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    let perim = 2 * (p.width + p.height);

    // Subtract shared edges with other pieces
    for (let j = 0; j < pieces.length; j++) {
      if (i === j) continue;
      const q = pieces[j];
      // Check for shared vertical edge
      if (Math.abs(p.x + p.width - q.x) < 10) {
        const overlapY = Math.max(0, Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y));
        if (overlapY > 0) perim -= overlapY; // Only subtract once
      }
      // Check for shared horizontal edge
      if (Math.abs(p.y + p.height - q.y) < 10) {
        const overlapX = Math.max(0, Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x));
        if (overlapX > 0) perim -= overlapX;
      }
    }
    totalPerimeter += Math.max(perim, 0);
  }

  return totalPerimeter;
}

export function OrcamentoDialog({ open, onOpenChange, layouts, companyLogo }: Props) {
  const [pricing, setPricing] = useState<PricingConfig>({
    corteModo: "metro",
    corteValorMetro: 2.50,
    corteVelocidade: 80, // mm/s
    corteValorHora: 150,
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

      // Count holes by type
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

      const valorFuros = Object.entries(furos).reduce((sum, [tipo, qtd]) => sum + qtd * holePrice(tipo), 0);

      return {
        sheetId: sheet.id,
        material: sheet.material,
        corteMm,
        corteMetros,
        tempoCorteMin,
        furos,
        totalFuros,
        valorCorte,
        valorFuros,
        valorTotal: valorCorte + valorFuros,
      };
    });

    setCalculated(budgets);
    toast.success("Orçamento calculado!");
  };

  const totalGeral = useMemo(() => {
    if (!calculated) return 0;
    return calculated.reduce((a, b) => a + b.valorTotal, 0);
  }, [calculated]);

  const totalMetros = useMemo(() => {
    if (!calculated) return 0;
    return calculated.reduce((a, b) => a + b.corteMetros, 0);
  }, [calculated]);

  const totalFuros = useMemo(() => {
    if (!calculated) return 0;
    return calculated.reduce((a, b) => a + b.totalFuros, 0);
  }, [calculated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[950px] max-h-[90vh] overflow-y-auto">
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
                        <th className="text-right px-2 py-1 font-semibold">Metros</th>
                        <th className="text-right px-2 py-1 font-semibold">Furos</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Corte</th>
                        <th className="text-right px-2 py-1 font-semibold">R$ Furos</th>
                        <th className="text-right px-2 py-1 font-semibold font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculated.map(b => (
                        <tr key={b.sheetId} className="border-t border-border">
                          <td className="px-2 py-1 font-medium">#{b.sheetId}</td>
                          <td className="px-2 py-1 text-right font-mono">{b.corteMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1 text-right font-mono">{b.totalFuros}</td>
                          <td className="px-2 py-1 text-right font-mono">R${b.valorCorte.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-mono">R${b.valorFuros.toFixed(2)}</td>
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
                    <span className="font-mono font-semibold">{totalMetros.toFixed(2)}m</span>
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

                {/* Detail breakdown per hole type */}
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
