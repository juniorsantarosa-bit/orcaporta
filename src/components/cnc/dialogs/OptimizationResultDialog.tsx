import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet } from "@/types/promob";
import { CheckCircle, BarChart3, Layers, Timer, Ruler, TrendingUp } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: {
    sheets: NestingSheet[];
    stats: {
      totalSheets: number;
      totalPieces: number;
      avgEfficiency: number;
      totalSheetArea: number;
      totalUsedArea: number;
      totalWasteArea: number;
    };
    elapsed: number;
  };
}

function StatCard({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType; label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className={`p-2 rounded-md ${color || 'bg-primary/10'}`}>
        <Icon className={`h-4 w-4 ${color ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-sm font-bold font-mono">
          {value}
          {unit && <span className="text-[10px] text-muted-foreground ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export function OptimizationResultDialog({ open, onOpenChange, result }: Props) {
  const { stats, elapsed } = result;
  const effColor = stats.avgEfficiency > 80 ? 'text-success' : stats.avgEfficiency > 60 ? 'text-warning' : 'text-destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-success" />
            Otimização Concluída
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main efficiency display */}
          <div className="text-center py-4 bg-muted/30 rounded-xl border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Aproveitamento Médio</div>
            <div className={`text-4xl font-black font-mono ${effColor}`}>
              {stats.avgEfficiency.toFixed(1)}%
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={Layers} label="Chapas necessárias" value={String(stats.totalSheets)} />
            <StatCard icon={BarChart3} label="Peças posicionadas" value={String(stats.totalPieces)} />
            <StatCard icon={Ruler} label="Área utilizada" value={stats.totalUsedArea.toFixed(2)} unit="m²" />
            <StatCard icon={TrendingUp} label="Sobra total" value={stats.totalWasteArea.toFixed(2)} unit="m²" />
            <StatCard icon={Timer} label="Tempo de cálculo" value={elapsed < 1000 ? `${elapsed.toFixed(0)}` : `${(elapsed / 1000).toFixed(1)}`} unit={elapsed < 1000 ? "ms" : "s"} />
          </div>

          {/* Per-sheet breakdown */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-medium">Chapa</th>
                  <th className="text-left px-3 py-1.5 font-medium">Material</th>
                  <th className="text-center px-3 py-1.5 font-medium">Peças</th>
                  <th className="text-right px-3 py-1.5 font-medium">Aproveit.</th>
                </tr>
              </thead>
              <tbody>
                {result.sheets.map(sheet => (
                  <tr key={sheet.id} className="border-t border-border/50">
                    <td className="px-3 py-1.5 font-bold text-primary">{sheet.id}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{sheet.material}</td>
                    <td className="px-3 py-1.5 text-center font-mono">{sheet.pieces.length}</td>
                    <td className={`px-3 py-1.5 text-right font-bold font-mono ${
                      sheet.efficiency > 80 ? 'text-success' : sheet.efficiency > 60 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {sheet.efficiency.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
