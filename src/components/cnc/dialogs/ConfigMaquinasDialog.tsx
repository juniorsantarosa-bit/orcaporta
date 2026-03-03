import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MachineConfig } from "@/types/cutting";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MachineConfig;
  onSave: (config: MachineConfig) => void;
}

const pontoZeramentoOpcoes = [
  "Traseira-Esq", "Traseira-Cen", "Traseira-Dir",
  "Centro-Esq", "Centro-Cen", "Centro-Dir",
  "Frente-Esq", "Frente-Cen", "Frente-Dir",
];

export function ConfigMaquinasDialog({ open, onOpenChange, config, onSave }: Props) {
  const [form, setForm] = useState<MachineConfig>(config);
  const [activeTab, setActiveTab] = useState<"geral" | "ferramentas" | "estrategias">("geral");
  const [novoLayer, setNovoLayer] = useState("");

  const update = <K extends keyof MachineConfig>(key: K, value: MachineConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addLayer = () => {
    if (novoLayer.trim()) {
      update("ignorarLayers", [...form.ignorarLayers, novoLayer.trim()]);
      setNovoLayer("");
    }
  };

  const handleSave = () => {
    onSave(form);
    toast.success("Configuração de máquina salva!");
    onOpenChange(false);
  };

  const tabs = [
    { id: "geral" as const, label: "Geral" },
    { id: "ferramentas" as const, label: "Ferramentas" },
    { id: "estrategias" as const, label: "Estratégias" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Configuração de Máquinas</DialogTitle>
        </DialogHeader>

        <div className="text-sm font-medium mb-2">CNC</div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "geral" && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-6">
            {/* Left */}
            <div className="space-y-3">
              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Geral</legend>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><label className="text-[10px] w-28">Nome</label><Input value={form.nome} onChange={(e) => update("nome", e.target.value)} className="h-6 text-xs" /></div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-28">Descrição</label><Textarea value={form.descricao} onChange={(e) => update("descricao", e.target.value)} className="text-xs h-12 resize-none" /></div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-28">Pós Processador</label>
                    <Select value={form.posProcessador} onValueChange={(v) => update("posProcessador", v)}>
                      <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mach_Turbo_ATC16">Mach_Turbo_ATC16</SelectItem>
                        <SelectItem value="Biesse">Biesse</SelectItem>
                        <SelectItem value="Homag">Homag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-28">Tipo de Otimização</label>
                    <Select value={form.tipoOtimizacao} onValueChange={(v) => update("tipoOtimizacao", v)}>
                      <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nesting">Nesting</SelectItem>
                        <SelectItem value="Seccionadora">Seccionadora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-28">Pasta para Exportação</label><Input value={form.pastaExportacao} onChange={(e) => update("pastaExportacao", e.target.value)} className="h-6 text-xs" /></div>
                </div>
              </fieldset>

              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Etiquetas</legend>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><label className="text-xs">Salvar Etiq.</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.salvarEtiqueta ? "On" : "Off"}</span><Switch checked={form.salvarEtiqueta} onCheckedChange={(v) => update("salvarEtiqueta", v)} /></div></div>
                  <div className="flex items-center justify-between"><label className="text-xs">Salvar Lista</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.salvarLista ? "On" : "Off"}</span><Switch checked={form.salvarLista} onCheckedChange={(v) => update("salvarLista", v)} /></div></div>
                  <div className="flex items-center gap-2"><label className="text-[10px]">Etiqueta</label>
                    <Select value={form.etiquetaModelo} onValueChange={(v) => update("etiquetaModelo", v)}>
                      <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Modelo 1">Modelo 1</SelectItem>
                        <SelectItem value="Modelo 2">Modelo 2</SelectItem>
                        <SelectItem value="Modelo 3">Modelo 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Posicionamentos</legend>
                <div className="space-y-1">
                  {([["Z Seguro", "zSeguro"], ["Z Rápido", "zRapido"], ["Max Z Menos", "maxZMenos"], ["Deslocamento X", "deslocamentoX"], ["Deslocamento Y", "deslocamentoY"]] as const).map(([label, key]) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-[10px] w-24">{label}</label>
                      <Input type="number" value={form[key]} onChange={(e) => update(key, parseFloat(e.target.value) || 0)} className="h-6 w-20 text-xs text-right" step="0.01" />
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Peças Pequenas</legend>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><label className="text-xs">Usar Largura</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.usarLargura ? "On" : "Off"}</span><Switch checked={form.usarLargura} onCheckedChange={(v) => update("usarLargura", v)} /></div></div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-16">Largura</label><Input type="number" value={form.larguraPequena} onChange={(e) => update("larguraPequena", parseFloat(e.target.value) || 0)} className="h-6 w-16 text-xs text-right" /><span className="text-[10px]">mm</span></div>
                  <div className="flex items-center justify-between"><label className="text-xs">Usar Área</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.usarArea ? "On" : "Off"}</span><Switch checked={form.usarArea} onCheckedChange={(v) => update("usarArea", v)} /></div></div>
                  <div className="flex items-center gap-2"><label className="text-[10px] w-16">Área</label><Input type="number" value={form.areaPequena} onChange={(e) => update("areaPequena", parseFloat(e.target.value) || 0)} className="h-6 w-16 text-xs text-right" /><span className="text-[10px]">mm²×1000</span></div>
                </div>
              </fieldset>
            </div>

            {/* Center: CNC icon placeholder */}
            <div className="flex flex-col items-center pt-4">
              <div className="w-24 h-24 bg-primary/20 rounded-lg flex items-center justify-center text-primary text-3xl font-bold">CNC</div>
            </div>

            {/* Right */}
            <div className="space-y-3">
              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Ignorar Layers</legend>
                <div className="flex items-center gap-1 mb-2">
                  <Select value="" onValueChange={setNovoLayer}>
                    <SelectTrigger className="h-6 text-xs flex-1"><SelectValue placeholder="Selecionar layer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Usinagem_Linha_18.5_VBit90">Usinagem_Linha_18.5_VBit90</SelectItem>
                      <SelectItem value="Furacao_V5">Furacao_V5</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="text-xs h-6 bg-primary text-primary-foreground" onClick={addLayer}>Adicionar</Button>
                </div>
                <div className="border border-border rounded min-h-[60px] max-h-[100px] overflow-y-auto p-1 text-[10px]">
                  {form.ignorarLayers.map((l, i) => <div key={i} className="px-1 py-0.5">{l}</div>)}
                </div>
              </fieldset>

              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Ponto de Zeramento</legend>
                <div className="grid grid-cols-3 gap-1">
                  {pontoZeramentoOpcoes.map((opt) => (
                    <label key={opt} className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input type="radio" name="pontoZeramento" checked={form.pontoZeramento === opt} onChange={() => update("pontoZeramento", opt)} className="accent-primary" />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="border border-border rounded p-3">
                <legend className="text-xs font-medium px-1">Opções de Nesting</legend>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><label className="text-[10px]">Rotação de peças pelo Material</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.rotacaoPeloMaterial ? "On" : "Off"}</span><Switch checked={form.rotacaoPeloMaterial} onCheckedChange={(v) => update("rotacaoPeloMaterial", v)} /></div></div>
                  <div className="flex items-center justify-between"><label className="text-[10px]">Offset em peças com Chanfros</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.offsetChanfros ? "On" : "Off"}</span><Switch checked={form.offsetChanfros} onCheckedChange={(v) => update("offsetChanfros", v)} /></div></div>
                  <div className="flex items-center justify-between"><label className="text-[10px]">Utilizar Prioridade para Face Superior</label><div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">{form.prioridadeFaceSuperior ? "On" : "Off"}</span><Switch checked={form.prioridadeFaceSuperior} onCheckedChange={(v) => update("prioridadeFaceSuperior", v)} /></div></div>
                </div>
                <div className="border border-border rounded mt-2 p-2 text-[10px] min-h-[50px]">
                  <div>Usinagem</div>
                  <div>Rasgo</div>
                  <div>Furação</div>
                </div>
              </fieldset>
            </div>
          </div>
        )}

        {activeTab === "ferramentas" && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Configuração de ferramentas (em desenvolvimento)
          </div>
        )}

        {activeTab === "estrategias" && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Configuração de estratégias (em desenvolvimento)
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
