import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BitmapConfig } from "@/types/cutting";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BitmapConfig;
  onSave: (config: BitmapConfig) => void;
}

export function ConfigBitmapDialog({ open, onOpenChange, config, onSave }: Props) {
  const [form, setForm] = useState<BitmapConfig>(config);

  const update = <K extends keyof BitmapConfig>(key: K, value: BitmapConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
    toast.success("Configuração de bitmap salva!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Configurar Bitmap</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Settings */}
          <div className="space-y-4">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Previsualização</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><label className="text-[10px] w-16">Largura</label><Input type="number" value={form.prevLargura} onChange={(e) => update("prevLargura", parseFloat(e.target.value) || 0)} className="h-6 text-xs" step="0.01" /></div>
                <div className="flex items-center gap-2"><label className="text-[10px] w-16">Altura</label><Input type="number" value={form.prevAltura} onChange={(e) => update("prevAltura", parseFloat(e.target.value) || 0)} className="h-6 text-xs" step="0.01" /></div>
              </div>
            </fieldset>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.materialVeio} onCheckedChange={(v) => update("materialVeio", !!v)} className="h-3 w-3" />Material com Veio</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.fitaSuperior} onCheckedChange={(v) => update("fitaSuperior", !!v)} className="h-3 w-3" />Fita Superior</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.fitaInferior} onCheckedChange={(v) => update("fitaInferior", !!v)} className="h-3 w-3" />Fita Inferior</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.fitaEsquerda} onCheckedChange={(v) => update("fitaEsquerda", !!v)} className="h-3 w-3" />Fita Esquerda</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.fitaDireita} onCheckedChange={(v) => update("fitaDireita", !!v)} className="h-3 w-3" />Fita Direita</label>
              </div>
            </div>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Configurações</legend>
              <div className="space-y-2">
                {([
                  ["Largura", "largura"], ["Altura", "altura"], ["Margem", "margem"],
                  ["Espessura da Linha", "espessuraLinha"], ["Tamanho Texto", "tamanhoTexto"],
                  ["Tamanho Legenda", "tamanhoLegenda"], ["Rotação", "rotacao"],
                ] as [string, keyof BitmapConfig][]).map(([label, key]) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-[10px] w-28">{label}</label>
                    <Input type="number" value={form[key] as number} onChange={(e) => update(key, parseFloat(e.target.value) || 0)} className="h-6 text-xs" />
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.exibirFaceAlinhamento} onCheckedChange={(v) => update("exibirFaceAlinhamento", !!v)} className="h-3 w-3" />Exibir Face de alinhamento</label>
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.exibirLegendaFace} onCheckedChange={(v) => update("exibirLegendaFace", !!v)} className="h-3 w-3" />Exibir Legenda Face de alinhamento</label>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex items-center justify-center">
            <svg width="280" height="220" viewBox="0 0 280 220" className="border border-border rounded bg-card">
              {/* Piece outline */}
              <rect x="40" y="30" width="200" height="160" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
              {/* Resize handles */}
              <circle cx="40" cy="30" r="4" fill="hsl(var(--muted-foreground))" />
              <circle cx="240" cy="30" r="4" fill="hsl(var(--muted-foreground))" />
              <circle cx="40" cy="190" r="4" fill="hsl(var(--muted-foreground))" />
              <circle cx="240" cy="190" r="4" fill="hsl(var(--muted-foreground))" />
              {/* Dimension labels */}
              <text x="140" y="22" textAnchor="middle" fontSize="14" className="fill-foreground font-mono">{form.prevLargura}</text>
              <text x="25" y="115" textAnchor="middle" fontSize="14" className="fill-foreground font-mono" transform="rotate(-90, 25, 115)">{form.prevAltura}</text>
              {/* Edge indicators */}
              {form.fitaSuperior && <line x1="45" y1="30" x2="235" y2="30" stroke="hsl(var(--primary))" strokeWidth="3" />}
              {form.fitaInferior && <line x1="45" y1="190" x2="235" y2="190" stroke="hsl(var(--primary))" strokeWidth="3" />}
              {form.fitaEsquerda && <line x1="40" y1="35" x2="40" y2="185" stroke="hsl(var(--primary))" strokeWidth="3" />}
              {form.fitaDireita && <line x1="240" y1="35" x2="240" y2="185" stroke="hsl(var(--primary))" strokeWidth="3" />}
            </svg>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
