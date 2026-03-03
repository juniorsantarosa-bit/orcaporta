import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DXFFile } from "@/types/cutting";
import { Plus, FileUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: DXFFile[]) => void;
}

export function ImportarDXFDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DXFFile[]>([]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles: DXFFile[] = Array.from(fileList).map((f, i) => ({
      id: files.length + i + 1,
      descricao: f.name.replace(".dxf", ""),
      material: "",
      veio: false,
      operacao: "",
      quantidade: 1,
      observacao: "",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const updateFile = (id: number, field: keyof DXFFile, value: any) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const handleContinue = () => {
    if (files.length === 0) {
      toast.error("Adicione pelo menos um arquivo DXF.");
      return;
    }
    onImport(files);
    toast.success(`${files.length} arquivos DXF importados!`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Adicionar Arquivos DXF</DialogTitle>
        </DialogHeader>

        <Button variant="outline" size="sm" className="self-start text-xs gap-1 mb-3" onClick={() => fileRef.current?.click()}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
        <input ref={fileRef} type="file" className="hidden" accept=".dxf" multiple onChange={handleFiles} />

        <ScrollArea className="flex-1 min-h-0 border border-border rounded">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-table-header text-foreground/90 font-semibold">
                <th className="text-left px-2 py-1.5 w-10">ID</th>
                <th className="text-left px-2 py-1.5">Descrição</th>
                <th className="text-left px-2 py-1.5">Material</th>
                <th className="text-center px-2 py-1.5 w-10">Veio</th>
                <th className="text-left px-2 py-1.5 w-16">Oper.</th>
                <th className="text-right px-2 py-1.5 w-12">Qtde</th>
                <th className="text-left px-2 py-1.5 w-20">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum arquivo adicionado
                  </td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.id} className="border-b border-border/50 hover:bg-table-row-hover">
                    <td className="px-2 py-0.5 text-muted-foreground">{f.id}</td>
                    <td className="px-1 py-0.5"><Input value={f.descricao} onChange={(e) => updateFile(f.id, "descricao", e.target.value)} className="h-6 text-xs" /></td>
                    <td className="px-1 py-0.5"><Input value={f.material} onChange={(e) => updateFile(f.id, "material", e.target.value)} className="h-6 text-xs" /></td>
                    <td className="text-center px-1 py-0.5"><Checkbox checked={f.veio} onCheckedChange={(v) => updateFile(f.id, "veio", !!v)} className="h-3 w-3" /></td>
                    <td className="px-1 py-0.5"><Input value={f.operacao} onChange={(e) => updateFile(f.id, "operacao", e.target.value)} className="h-6 text-xs" /></td>
                    <td className="px-1 py-0.5"><Input type="number" value={f.quantidade} onChange={(e) => updateFile(f.id, "quantidade", parseInt(e.target.value) || 1)} className="h-6 text-xs text-right w-12" /></td>
                    <td className="px-1 py-0.5"><Input value={f.observacao} onChange={(e) => updateFile(f.id, "observacao", e.target.value)} className="h-6 text-xs" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleContinue} className="bg-primary text-primary-foreground hover:bg-primary/90">Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
