import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CuttingPiece } from "@/types/cutting";
import { FileUp, File } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pieces: CuttingPiece[]) => void;
}

export function ImportarPecasDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formato, setFormato] = useState("CorteCloud");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }

    try {
      const text = await selectedFile.text();

      if (selectedFile.name.endsWith(".json")) {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          onImport(data);
          toast.success(`${data.length} peças importadas com sucesso!`);
        }
      } else if (selectedFile.name.endsWith(".csv") || selectedFile.name.endsWith(".txt")) {
        const lines = text.split("\n").filter((l) => l.trim());
        const header = lines[0].split(";");
        const pieces: CuttingPiece[] = lines.slice(1).map((line, i) => {
          const cols = line.split(";");
          return {
            id: i + 1,
            projeto: cols[0]?.trim() || "",
            cliente: cols[1]?.trim() || "",
            descricao: cols[2]?.trim() || "",
            largura: parseFloat(cols[3]) || 0,
            altura: parseFloat(cols[4]) || 0,
            espessura: parseFloat(cols[5]) || 15,
            material: cols[6]?.trim() || "",
            quantidade: parseInt(cols[7]) || 1,
            bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
            veio: false, observacao: "",
          };
        });
        onImport(pieces);
        toast.success(`${pieces.length} peças importadas com sucesso!`);
      } else {
        toast.error("Formato não suportado. Use JSON, CSV ou TXT.");
        return;
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao ler o arquivo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Importar Peças
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-xs w-16">Formato</label>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CorteCloud">CorteCloud</SelectItem>
                <SelectItem value="Smart Cabinets">Smart Cabinets</SelectItem>
                <SelectItem value="CSV">CSV / TXT</SelectItem>
                <SelectItem value="JSON">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".json,.csv,.txt,.xml" onChange={handleFileChange} />
            {selectedFile ? (
              <div className="flex items-center gap-2 justify-center text-sm">
                <File className="h-5 w-5 text-primary" />
                <span>{selectedFile.name}</span>
                <span className="text-muted-foreground text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste um arquivo</p>
                <p className="text-[10px] text-muted-foreground mt-1">JSON, CSV, TXT, XML</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} className="bg-primary text-primary-foreground hover:bg-primary/90">Abrir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
