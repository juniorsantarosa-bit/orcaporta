import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GeneralConfig } from "@/types/cutting";
import { Plus, X, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GeneralConfig;
  onSave: (config: GeneralConfig) => void;
}

export function ConfiguracoesGeraisDialog({ open, onOpenChange, config, onSave }: Props) {
  const [form, setForm] = useState<GeneralConfig>(config);
  const [novoMaterial, setNovoMaterial] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      update("companyLogo", ev.target?.result as string);
      toast.success("Logo carregado!");
    };
    reader.readAsDataURL(file);
  };

  const update = <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addIgnorar = () => {
    if (novoMaterial.trim()) {
      update("ignorarMateriais", [...form.ignorarMateriais, novoMaterial.trim()]);
      setNovoMaterial("");
    }
  };

  const removeIgnorar = (idx: number) => {
    update("ignorarMateriais", form.ignorarMateriais.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave(form);
    toast.success("Configurações gerais salvas!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Configurações Gerais</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Tamanho Chapa Padrão</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">X</label>
                  <Input type="number" value={form.chapaX} onChange={(e) => update("chapaX", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">Y</label>
                  <Input type="number" value={form.chapaY} onChange={(e) => update("chapaY", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Tamanho Sobra Chapa Padrão</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">X</label>
                  <Input type="number" value={form.sobraX} onChange={(e) => update("sobraX", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">Y</label>
                  <Input type="number" value={form.sobraY} onChange={(e) => update("sobraY", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Distância entre Chapas</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">X</label>
                  <Input type="number" value={form.distanciaX} onChange={(e) => update("distanciaX", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-4">Y</label>
                  <Input type="number" value={form.distanciaY} onChange={(e) => update("distanciaY", parseFloat(e.target.value) || 0)} className="h-7 text-xs" step="0.01" />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Sobra de Chapas</legend>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs">Usar Disponíveis</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.usarDisponiveis ? "On" : "Off"}</span>
                    <Switch checked={form.usarDisponiveis} onCheckedChange={(v) => update("usarDisponiveis", v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs">Cadastrar Novas</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.cadastrarNovas ? "On" : "Off"}</span>
                    <Switch checked={form.cadastrarNovas} onCheckedChange={(v) => update("cadastrarNovas", v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs">Remover Usadas</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.removerUsadas ? "On" : "Off"}</span>
                    <Switch checked={form.removerUsadas} onCheckedChange={(v) => update("removerUsadas", v)} />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Opções de importação</legend>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs">Exibir Importar Dinabox</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.exibirDinabox ? "On" : "Off"}</span>
                    <Switch checked={form.exibirDinabox} onCheckedChange={(v) => update("exibirDinabox", v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs">Exibir seletor de sobras</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.exibirSeletorSobras ? "On" : "Off"}</span>
                    <Switch checked={form.exibirSeletorSobras} onCheckedChange={(v) => update("exibirSeletorSobras", v)} />
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Ignorar Materiais</legend>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs">Nome</label>
                <Input value={novoMaterial} onChange={(e) => setNovoMaterial(e.target.value)} className="h-7 text-xs flex-1" onKeyDown={(e) => e.key === "Enter" && addIgnorar()} />
                <Button variant="ghost" size="sm" onClick={addIgnorar} className="h-7 w-7 p-0 text-primary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="border border-border rounded min-h-[100px] max-h-[150px] overflow-y-auto p-1">
                {form.ignorarMateriais.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-0.5 hover:bg-muted/50 rounded">
                    <span>{m}</span>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => removeIgnorar(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Importar/Exportar Materiais</legend>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">Importar Materiais</Button>
                <Button size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">Exportar Materiais</Button>
                <Button size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">Importar Sobras</Button>
                <Button size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">Exportar Sobras</Button>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Dimensões Fresa Vbit Invertida</legend>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <label className="text-[10px]">Diâmetro Maior</label>
                  <Input type="number" value={form.fresaDiametroMaior} onChange={(e) => update("fresaDiametroMaior", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-right" step="0.01" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px]">Ângulo</label>
                  <Input type="number" value={form.fresaAngulo} onChange={(e) => update("fresaAngulo", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-right" step="0.01" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px]">Diâmetro Menor</label>
                  <Input type="number" value={form.fresaDiametroMenor} onChange={(e) => update("fresaDiametroMenor", parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-right" step="0.01" />
                </div>
              </div>
              <Button size="sm" variant="outline" className="mt-2 text-xs border-primary text-primary">Aplicar no projeto</Button>
            </fieldset>
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
