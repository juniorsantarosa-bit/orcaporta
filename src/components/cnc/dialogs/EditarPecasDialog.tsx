import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CuttingPiece } from "@/types/cutting";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: CuttingPiece[];
  onSave: (pieces: CuttingPiece[]) => void;
}

export function EditarPecasDialog({ open, onOpenChange, pieces, onSave }: Props) {
  const [editPieces, setEditPieces] = useState<CuttingPiece[]>(pieces);
  const [projeto, setProjeto] = useState(pieces[0]?.projeto || "");
  const [cliente, setCliente] = useState(pieces[0]?.cliente || "");
  const [observacoes, setObservacoes] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(pieces[0]?.id || null);

  const updatePiece = (id: number, field: keyof CuttingPiece, value: any) => {
    setEditPieces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const addPiece = () => {
    const newId = Math.max(...editPieces.map((p) => p.id), 0) + 1;
    setEditPieces((prev) => [
      ...prev,
      {
        id: newId, projeto, cliente, descricao: "", largura: 0, altura: 0,
        espessura: 15, material: "Branco TX 15mm - Multimarcas", quantidade: 1,
        bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
        veio: false, observacao: "",
      },
    ]);
  };

  const removePiece = (id: number) => {
    setEditPieces((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = () => {
    onSave(editPieces.map((p) => ({ ...p, projeto, cliente })));
    toast.success("Peças salvas com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Editar</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 text-xs mb-2">
          <span className="text-muted-foreground cursor-pointer hover:text-primary">
            {projeto || "Novo Projeto"}
          </span>
        </div>

        {/* Informações Gerais */}
        <fieldset className="border border-border rounded p-3 mb-3">
          <legend className="text-xs font-medium px-1">Informações Gerais</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-muted-foreground">Projeto</label>
              <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Cliente</label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </fieldset>

        {/* Observações */}
        <fieldset className="border border-border rounded p-3 mb-3">
          <legend className="text-xs font-medium px-1">Observações</legend>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="text-xs h-12 resize-none" />
        </fieldset>

        {/* Header: drag hint */}
        <div className="text-center text-[10px] text-muted-foreground mb-1">
          Arraste uma coluna aqui para agrupar por essa coluna
        </div>

        {/* Pieces Table */}
        <ScrollArea className="flex-1 min-h-0 border border-border rounded">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-table-header text-foreground/90 font-semibold">
                <th className="px-2 py-1.5 w-8"></th>
                <th className="text-left px-2 py-1.5 w-10">ID</th>
                <th className="text-left px-2 py-1.5 min-w-[120px]">Descrição</th>
                <th className="text-right px-2 py-1.5 w-16">Altura</th>
                <th className="text-right px-2 py-1.5 w-16">Largura</th>
                <th className="text-right px-2 py-1.5 w-16">Espessura</th>
                <th className="text-left px-2 py-1.5 min-w-[180px]">Material</th>
                <th className="text-center px-2 py-1.5 w-10">Veio</th>
                <th className="text-center px-2 py-1.5 w-10">Oper.</th>
                <th className="text-center px-2 py-1.5 w-20">Fitas</th>
                <th className="text-right px-2 py-1.5 w-12">Qtde</th>
                <th className="text-left px-2 py-1.5 w-20">Obs</th>
              </tr>
            </thead>
            <tbody>
              {editPieces.map((piece) => (
                <tr
                  key={piece.id}
                  onClick={() => setSelectedId(piece.id)}
                  className={`border-b border-border/50 cursor-pointer ${selectedId === piece.id ? "bg-table-row-selected" : "hover:bg-table-row-hover"}`}
                >
                  <td className="px-1 py-0.5">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); removePiece(piece.id); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                  <td className="px-2 py-0.5 text-muted-foreground">{piece.id}</td>
                  <td className="px-1 py-0.5">
                    <Input value={piece.descricao} onChange={(e) => updatePiece(piece.id, "descricao", e.target.value)} className="h-6 text-xs px-1" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={piece.altura} onChange={(e) => updatePiece(piece.id, "altura", parseFloat(e.target.value) || 0)} className="h-6 text-xs px-1 text-right w-16" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={piece.largura} onChange={(e) => updatePiece(piece.id, "largura", parseFloat(e.target.value) || 0)} className="h-6 text-xs px-1 text-right w-16" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={piece.espessura} onChange={(e) => updatePiece(piece.id, "espessura", parseFloat(e.target.value) || 0)} className="h-6 text-xs px-1 text-right w-16" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={piece.material} onChange={(e) => updatePiece(piece.id, "material", e.target.value)} className="h-6 text-xs px-1" />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <Checkbox checked={piece.veio} onCheckedChange={(v) => updatePiece(piece.id, "veio", !!v)} className="h-3 w-3" />
                  </td>
                  <td className="px-1 py-0.5 text-center text-muted-foreground">+</td>
                  <td className="px-1 py-0.5">
                    <div className="flex gap-0.5 justify-center">
                      {(["bordaSup", "bordaInf", "bordaEsq", "bordaDir"] as const).map((b) => (
                        <Checkbox key={b} checked={piece[b]} onCheckedChange={(v) => updatePiece(piece.id, b, !!v)} className="h-3 w-3" />
                      ))}
                    </div>
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={piece.quantidade} onChange={(e) => updatePiece(piece.id, "quantidade", parseInt(e.target.value) || 1)} className="h-6 text-xs px-1 text-right w-12" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={piece.observacao} onChange={(e) => updatePiece(piece.id, "observacao", e.target.value)} className="h-6 text-xs px-1 w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <div className="flex items-center gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={addPiece} className="text-xs gap-1">
            <Plus className="h-3 w-3" /> Adicionar Peça
          </Button>
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
