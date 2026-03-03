import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { SobraMaterial } from "@/types/cutting";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SobrasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sobras: SobraMaterial[];
  onSave: (sobras: SobraMaterial[]) => void;
}

export function SobrasDialog({ open, onOpenChange, sobras, onSave }: SobrasDialogProps) {
  const [items, setItems] = useState<SobraMaterial[]>(sobras);

  const addSobra = () => {
    setItems(prev => [...prev, {
      id: Date.now(),
      largura: 500,
      altura: 500,
      quantidade: 1,
      descricao: `Sobra ${prev.length + 1}`,
    }]);
  };

  const removeSobra = (id: number) => {
    setItems(prev => prev.filter(s => s.id !== id));
  };

  const updateSobra = (id: number, field: keyof SobraMaterial, value: any) => {
    setItems(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    onSave(items);
    toast.success(`${items.length} sobras salvas`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Gerenciar Sobras de Material</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma sobra cadastrada</p>
          )}
          {items.map((sobra) => (
            <div key={sobra.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border border-border">
              <Input
                value={sobra.descricao}
                onChange={e => updateSobra(sobra.id, "descricao", e.target.value)}
                className="h-7 text-xs flex-1"
                placeholder="Descrição"
              />
              <Input
                type="number"
                value={sobra.largura}
                onChange={e => updateSobra(sobra.id, "largura", Number(e.target.value))}
                className="h-7 text-xs w-20 font-mono"
                placeholder="Larg."
              />
              <span className="text-[9px] text-muted-foreground">×</span>
              <Input
                type="number"
                value={sobra.altura}
                onChange={e => updateSobra(sobra.id, "altura", Number(e.target.value))}
                className="h-7 text-xs w-20 font-mono"
                placeholder="Alt."
              />
              <Input
                type="number"
                value={sobra.quantidade}
                onChange={e => updateSobra(sobra.id, "quantidade", Number(e.target.value))}
                className="h-7 text-xs w-14 font-mono"
                placeholder="Qt"
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeSobra(sobra.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addSobra}>
          <Plus className="h-3 w-3" /> Adicionar Sobra
        </Button>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
