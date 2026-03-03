import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { NestingConfig } from "@/types/cutting";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: NestingConfig;
  onSave: (config: NestingConfig) => void;
}

const pontoOpcoes = [
  { value: "traseira-esquerda", label: "Traseira-Esquerda" },
  { value: "traseira-direita", label: "Traseira-Direita" },
  { value: "frente-esquerda", label: "Frente-Esquerda" },
  { value: "frente-direita", label: "Frente-Direita" },
] as const;

export function ConfiguracaoCorteDialog({ open, onOpenChange, config, onSave }: Props) {
  const [form, setForm] = useState<NestingConfig>(config);
  const [activeTab, setActiveTab] = useState<"nesting" | "seccionadora">("nesting");

  const update = <K extends keyof NestingConfig>(key: K, value: NestingConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
    toast.success("Configuração de corte salva!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Configuração de Corte</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border mb-4">
          <button
            onClick={() => setActiveTab("nesting")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "nesting" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Nesting
          </button>
          <button
            onClick={() => setActiveTab("seccionadora")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "seccionadora" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Seccionadora
          </button>
        </div>

        {activeTab === "nesting" && (
          <div className="space-y-4">
            {/* Geral */}
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Geral</legend>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs">Espessura do corte</label>
                  <Input type="number" value={form.espessuraCorte} onChange={(e) => update("espessuraCorte", parseFloat(e.target.value) || 0)} className="h-7 w-24 text-xs text-right" step="0.01" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs">Considerar Peças Retangulares</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.considerarRetangulares ? "On" : "Off"}</span>
                    <Switch checked={form.considerarRetangulares} onCheckedChange={(v) => update("considerarRetangulares", v)} />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Ponto Inicial */}
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Ponto Inicial do Nesting</legend>
              <div className="grid grid-cols-2 gap-2">
                {pontoOpcoes.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="pontoInicial"
                      checked={form.pontoInicial === opt.value}
                      onChange={() => update("pontoInicial", opt.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Refilo */}
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Refilo</legend>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs">X</label>
                  <Input type="number" value={form.refiloX} onChange={(e) => update("refiloX", parseFloat(e.target.value) || 0)} className="h-7 w-20 text-xs text-right" step="0.01" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs">Y</label>
                  <Input type="number" value={form.refiloY} onChange={(e) => update("refiloY", parseFloat(e.target.value) || 0)} className="h-7 w-20 text-xs text-right" step="0.01" />
                </div>
              </div>
            </fieldset>

            {/* Direção */}
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Direção do Nesting</legend>
              <div className="flex gap-4">
                {(["vertical", "horizontal", "indefinido"] as const).map((dir) => (
                  <label key={dir} className="flex items-center gap-2 text-xs cursor-pointer capitalize">
                    <input type="radio" name="direcao" checked={form.direcaoNesting === dir} onChange={() => update("direcaoNesting", dir)} className="accent-primary" />
                    {dir.charAt(0).toUpperCase() + dir.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Otimização */}
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Otimização</legend>
              <Slider value={[form.otimizacao]} onValueChange={([v]) => update("otimizacao", v)} min={0} max={100} step={1} className="mt-2" />
              <div className="text-right text-[10px] text-muted-foreground mt-1">{form.otimizacao}%</div>
            </fieldset>
          </div>
        )}

        {activeTab === "seccionadora" && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Configuração da seccionadora (em desenvolvimento)
          </div>
        )}

        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar Padrão</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
