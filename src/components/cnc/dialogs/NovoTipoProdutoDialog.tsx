import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  clientName: string;
  types: string[];
  /** Preço sugerido (R$/m² global) */
  suggestedPrice: number;
  onSave: (entries: { nome: string; precoM2: number }[]) => void;
  onSkip: () => void;
}

/**
 * Diálogo que aparece quando o cliente atual não tem preços cadastrados
 * para os tipos de produto detectados nas peças importadas. Pergunta
 * o R$/m² para cada tipo novo e persiste no cadastro do cliente.
 */
export function NovoTipoProdutoDialog({ open, clientName, types, suggestedPrice, onSave, onSkip }: Props) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, number> = {};
    for (const t of types) init[t] = suggestedPrice;
    setPrices(init);
  }, [open, types, suggestedPrice]);

  const handleSave = () => {
    onSave(types.map(t => ({ nome: t, precoM2: prices[t] || 0 })));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Novos tipos de produto detectados
          </DialogTitle>
          <DialogDescription>
            Os tipos abaixo não estão cadastrados nos preços de <b>{clientName}</b>.
            Informe o R$/m² de cada um — serão adicionados automaticamente ao cadastro do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {types.map(t => (
            <div key={t} className="grid grid-cols-[1fr_140px] gap-2 items-center">
              <div className="text-sm font-medium">{t}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">R$/m²</span>
                <Input
                  type="number" step="0.01" min={0}
                  value={prices[t] ?? 0}
                  onChange={(e) => setPrices(prev => ({ ...prev, [t]: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>Ignorar</Button>
          <Button onClick={handleSave}>Salvar no cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
