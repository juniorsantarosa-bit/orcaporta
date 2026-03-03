import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaterialItem, SobraMaterial } from "@/types/cutting";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockMaterials: MaterialItem[] = [
  { id: 4349, biblioteca: "MDF", nome: "Absoluto 06mm - Duratex", nomeExportacao: "Absoluto 06mm", comprimento: 2750, largura: 1840, espessura: 6, possuiVeio: true, direcaoVeio: "Vertical", possiveisNomes: ["Absoluto 6mm", "Absoluto 6mm duratex_absoluto", "4349"] },
  { id: 4350, biblioteca: "MDF", nome: "Branco TX 15mm - Multimarcas", nomeExportacao: "Branco TX 15mm", comprimento: 2750, largura: 1840, espessura: 15, possuiVeio: false, direcaoVeio: "Vertical", possiveisNomes: ["Branco TX 15mm", "Branco 15"] },
  { id: 4351, biblioteca: "MDF", nome: "Areia 18mm - Guararapes", nomeExportacao: "Areia 18mm", comprimento: 2750, largura: 1840, espessura: 18, possuiVeio: false, direcaoVeio: "Vertical", possiveisNomes: ["Areia 18mm"] },
];

const mockSobras: SobraMaterial[] = [
  { id: 2, largura: 1324, altura: 516, quantidade: 3, descricao: "" },
  { id: 4, largura: 1840, altura: 1718, quantidade: 2, descricao: "" },
];

export function BibliotecaMateriaisDialog({ open, onOpenChange }: Props) {
  const [selectedBib, setSelectedBib] = useState("MDF");
  const [materials] = useState(mockMaterials);
  const [selectedMat, setSelectedMat] = useState(mockMaterials[0]);
  const [sobras, setSobras] = useState(mockSobras);
  const [salvarSobras, setSalvarSobras] = useState(true);
  const [sobraComp, setSobraComp] = useState(500);
  const [sobraLarg, setSobraLarg] = useState(500);
  const [novoNome, setNovoNome] = useState("");

  const addNome = () => {
    if (novoNome.trim()) {
      setSelectedMat((prev) => ({ ...prev, possiveisNomes: [...prev.possiveisNomes, novoNome.trim()] }));
      setNovoNome("");
    }
  };

  const addSobra = () => {
    setSobras((prev) => [...prev, { id: Math.max(...prev.map(s => s.id), 0) + 1, largura: 0, altura: 0, quantidade: 1, descricao: "" }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Biblioteca de Materiais</DialogTitle>
        </DialogHeader>

        {/* Selectors */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Biblioteca</label>
            <Select value={selectedBib} onValueChange={setSelectedBib}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MDF">MDF</SelectItem>
                <SelectItem value="Compensado">Compensado</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="text-xs h-7">Novo</Button>
            <Button size="sm" variant="outline" className="text-xs h-7">Deletar</Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Material</label>
            <Select value={String(selectedMat.id)} onValueChange={(v) => setSelectedMat(materials.find(m => m.id === Number(v)) || materials[0])}>
              <SelectTrigger className="h-7 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {materials.filter(m => m.biblioteca === selectedBib).map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="text-xs h-7">Novo</Button>
            <Button size="sm" variant="outline" className="text-xs h-7">Deletar</Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
          {/* Left: Material details */}
          <div className="space-y-3">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Geral</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><label className="text-[10px] w-24">ID</label><Input value={selectedMat.id} readOnly className="h-6 text-xs" /></div>
                <div className="flex items-center gap-2"><label className="text-[10px] w-24">Nome Exportação</label><Input value={selectedMat.nomeExportacao} className="h-6 text-xs" /></div>
                <div className="flex items-center gap-2"><label className="text-[10px] w-24">Comprimento</label><Input type="number" value={selectedMat.comprimento} className="h-6 text-xs" step="0.01" /></div>
                <div className="flex items-center gap-2"><label className="text-[10px] w-24">Largura</label><Input type="number" value={selectedMat.largura} className="h-6 text-xs" step="0.01" /></div>
                <div className="flex items-center gap-2"><label className="text-[10px] w-24">Espessura</label><Input type="number" value={selectedMat.espessura} className="h-6 text-xs" step="0.01" /></div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={selectedMat.possuiVeio} className="h-3 w-3" />
                  <label className="text-[10px]">Possui Veio</label>
                  <Select value={selectedMat.direcaoVeio}>
                    <SelectTrigger className="h-6 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vertical">Vertical</SelectItem>
                      <SelectItem value="Horizontal">Horizontal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7">Cor Sólida</Button>
              <Button size="sm" variant="outline" className="text-xs h-7">Textura</Button>
            </div>

            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Possíveis Nomes</legend>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[10px]">Nome</label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="h-6 text-xs flex-1" onKeyDown={(e) => e.key === "Enter" && addNome()} />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary" onClick={addNome}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="border border-border rounded min-h-[60px] max-h-[80px] overflow-y-auto p-1 text-[10px]">
                {selectedMat.possiveisNomes.map((n, i) => <div key={i} className="px-1 py-0.5">{n}</div>)}
              </div>
            </fieldset>
          </div>

          {/* Center: Cadastro de Sobras + Preview */}
          <div className="space-y-3">
            <fieldset className="border border-border rounded p-3">
              <legend className="text-xs font-medium px-1">Cadastro de Sobras de Materiais</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={salvarSobras} onCheckedChange={(v) => setSalvarSobras(!!v)} className="h-3 w-3" />
                  Salvar Sobras
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-[10px]">Comprimento (mm)</label>
                  <Input type="number" value={sobraComp} onChange={(e) => setSobraComp(parseFloat(e.target.value) || 0)} className="h-6 text-xs w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px]">Largura (mm)</label>
                  <Input type="number" value={sobraLarg} onChange={(e) => setSobraLarg(parseFloat(e.target.value) || 0)} className="h-6 text-xs w-20" />
                </div>
              </div>
            </fieldset>

            {/* Material Preview */}
            <div className="bg-foreground/90 rounded h-[200px] flex items-center justify-center relative">
              <div className="text-[10px] text-muted absolute top-2 left-2">Preview 3D</div>
              <svg width="160" height="120" viewBox="0 0 160 120">
                <rect x="10" y="10" width="140" height="100" fill="hsl(var(--nesting-piece))" stroke="hsl(var(--border))" strokeWidth="1" rx="2" />
                <text x="80" y="55" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10">
                  {selectedMat.comprimento} × {selectedMat.largura}
                </text>
                <text x="80" y="70" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8">
                  {selectedMat.espessura}mm
                </text>
              </svg>
            </div>
          </div>

          {/* Right: Sobras table */}
          <div>
            <fieldset className="border border-border rounded p-3 h-full">
              <legend className="text-xs font-medium px-1">Biblioteca de Sobras de Materiais</legend>
              <ScrollArea className="h-[280px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-table-header">
                      <th className="px-2 py-1 text-left">ID</th>
                      <th className="px-2 py-1 text-right">Largura</th>
                      <th className="px-2 py-1 text-right">Altura</th>
                      <th className="px-2 py-1 text-right">Qtde</th>
                      <th className="px-2 py-1 text-left">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sobras.map((s, i) => (
                      <tr key={s.id} className={`border-b border-border/50 ${i === 0 ? "bg-warning/20" : ""}`}>
                        <td className="px-2 py-0.5">{s.id}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{s.largura.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{s.altura.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right">{s.quantidade}</td>
                        <td className="px-2 py-0.5">{s.descricao}</td>
                      </tr>
                    ))}
                    <tr className="cursor-pointer hover:bg-muted/50" onClick={addSobra}>
                      <td colSpan={5} className="px-2 py-1 text-primary text-center">
                        <Plus className="h-3 w-3 inline mr-1" />Clique aqui para adicionar uma nova linha
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ScrollArea>
              <p className="text-[9px] text-muted-foreground mt-2 italic">*A Biblioteca de Sobras é salva automaticamente</p>
            </fieldset>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { toast.success("Materiais salvos!"); onOpenChange(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
