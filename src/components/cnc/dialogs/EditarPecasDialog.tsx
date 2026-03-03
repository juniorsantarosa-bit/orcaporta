import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

  useEffect(() => {
    if (open) {
      setEditPieces(pieces);
      setProjeto(pieces[0]?.projeto || "");
      setCliente(pieces[0]?.cliente || "");
    }
  }, [open, pieces]);

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
      <DialogContent className="max-w-[95vw] w-[1200px] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle className="text-base font-semibold">Editar Peças</DialogTitle>
        </DialogHeader>

        <div className="px-5 space-y-3">
          {/* Info row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Projeto</label>
              <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Cliente</label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Observações</label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </div>

        {/* Table with proper scroll */}
        <div className="flex-1 min-h-0 mx-5 mt-2 border border-border rounded-md overflow-hidden flex flex-col">
          {/* Fixed header */}
          <div className="bg-muted/50 border-b border-border">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground font-medium">
                  <th className="px-1 py-1.5 w-7"></th>
                  <th className="text-left px-1 py-1.5 w-8">#</th>
                  <th className="text-left px-1 py-1.5 min-w-[100px]">Descrição</th>
                  <th className="text-right px-1 py-1.5 w-14">Altura</th>
                  <th className="text-right px-1 py-1.5 w-14">Largura</th>
                  <th className="text-right px-1 py-1.5 w-12">Esp.</th>
                  <th className="text-left px-1 py-1.5 min-w-[140px]">Material</th>
                  <th className="text-center px-1 py-1.5 w-8">Veio</th>
                  <th className="text-center px-1 py-1.5 w-7">S</th>
                  <th className="text-center px-1 py-1.5 w-7">I</th>
                  <th className="text-center px-1 py-1.5 w-7">E</th>
                  <th className="text-center px-1 py-1.5 w-7">D</th>
                  <th className="text-right px-1 py-1.5 w-10">Qtd</th>
                  <th className="text-left px-1 py-1.5 w-16">Obs</th>
                </tr>
              </thead>
            </table>
          </div>
          
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[10px]">
              <tbody>
                {editPieces.map((piece) => (
                  <tr
                    key={piece.id}
                    onClick={() => setSelectedId(piece.id)}
                    className={`border-b border-border/30 cursor-pointer transition-colors ${
                      selectedId === piece.id ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-1 py-0.5 w-7">
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); removePiece(piece.id); }}>
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </td>
                    <td className="px-1 py-0.5 w-8 text-muted-foreground">{piece.id}</td>
                    <td className="px-0.5 py-0.5 min-w-[100px]">
                      <Input value={piece.descricao} onChange={(e) => updatePiece(piece.id, "descricao", e.target.value)} className="h-5 text-[10px] px-1" />
                    </td>
                    <td className="px-0.5 py-0.5 w-14">
                      <Input type="number" value={piece.altura} onChange={(e) => updatePiece(piece.id, "altura", parseFloat(e.target.value) || 0)} className="h-5 text-[10px] px-1 text-right" />
                    </td>
                    <td className="px-0.5 py-0.5 w-14">
                      <Input type="number" value={piece.largura} onChange={(e) => updatePiece(piece.id, "largura", parseFloat(e.target.value) || 0)} className="h-5 text-[10px] px-1 text-right" />
                    </td>
                    <td className="px-0.5 py-0.5 w-12">
                      <Input type="number" value={piece.espessura} onChange={(e) => updatePiece(piece.id, "espessura", parseFloat(e.target.value) || 0)} className="h-5 text-[10px] px-1 text-right" />
                    </td>
                    <td className="px-0.5 py-0.5 min-w-[140px]">
                      <Input value={piece.material} onChange={(e) => updatePiece(piece.id, "material", e.target.value)} className="h-5 text-[10px] px-1" />
                    </td>
                    <td className="px-1 py-0.5 w-8 text-center">
                      <Checkbox checked={piece.veio} onCheckedChange={(v) => updatePiece(piece.id, "veio", !!v)} className="h-3 w-3" />
                    </td>
                    <td className="px-1 py-0.5 w-7 text-center">
                      <Checkbox checked={piece.bordaSup} onCheckedChange={(v) => updatePiece(piece.id, "bordaSup", !!v)} className="h-3 w-3" />
                    </td>
                    <td className="px-1 py-0.5 w-7 text-center">
                      <Checkbox checked={piece.bordaInf} onCheckedChange={(v) => updatePiece(piece.id, "bordaInf", !!v)} className="h-3 w-3" />
                    </td>
                    <td className="px-1 py-0.5 w-7 text-center">
                      <Checkbox checked={piece.bordaEsq} onCheckedChange={(v) => updatePiece(piece.id, "bordaEsq", !!v)} className="h-3 w-3" />
                    </td>
                    <td className="px-1 py-0.5 w-7 text-center">
                      <Checkbox checked={piece.bordaDir} onCheckedChange={(v) => updatePiece(piece.id, "bordaDir", !!v)} className="h-3 w-3" />
                    </td>
                    <td className="px-0.5 py-0.5 w-10">
                      <Input type="number" value={piece.quantidade} onChange={(e) => updatePiece(piece.id, "quantidade", parseInt(e.target.value) || 1)} className="h-5 text-[10px] px-1 text-right" />
                    </td>
                    <td className="px-0.5 py-0.5 w-16">
                      <Input value={piece.observacao} onChange={(e) => updatePiece(piece.id, "observacao", e.target.value)} className="h-5 text-[10px] px-1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-t border-border">
          <Button variant="outline" size="sm" onClick={addPiece} className="text-xs gap-1 h-7">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-7">Cancelar</Button>
            <Button size="sm" onClick={handleSave} className="text-xs h-7">Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}