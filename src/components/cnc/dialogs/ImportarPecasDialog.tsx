import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CuttingPiece } from "@/types/cutting";
import { FileUp, File } from "lucide-react";
import { toast } from "sonner";
import { parsePromobCSV, parsePromobJSON, promobToCuttingPieces } from "@/lib/promobParser";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pieces: CuttingPiece[]) => void;
}

export function ImportarPecasDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formato, setFormato] = useState("PromobCSV");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-detect format
      if (file.name.endsWith(".json")) setFormato("PromobJSON");
      else if (file.name.endsWith(".csv")) setFormato("PromobCSV");
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }

    try {
      const text = await selectedFile.text();

      if (formato === "PromobJSON" || selectedFile.name.endsWith(".json")) {
        const promobPieces = parsePromobJSON(text);
        const pieces = promobToCuttingPieces(promobPieces);
        onImport(pieces);
        toast.success(`${pieces.length} peças importadas do Promob JSON!`);
      } else if (formato === "PromobCSV" || selectedFile.name.endsWith(".csv")) {
        const promobPieces = parsePromobCSV(text);
        const pieces = promobToCuttingPieces(promobPieces);
        onImport(pieces);
        toast.success(`${pieces.length} peças importadas do Promob CSV!`);
      } else {
        // Generic CSV/TXT fallback
        const lines = text.split("\n").filter((l) => l.trim());
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
        toast.success(`${pieces.length} peças importadas!`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
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
              <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PromobCSV">Promob CSV (PromobCut)</SelectItem>
                <SelectItem value="PromobJSON">Promob JSON (Otimizador)</SelectItem>
                <SelectItem value="CorteCloud">CorteCloud</SelectItem>
                <SelectItem value="SmartCabinets">Smart Cabinets</SelectItem>
                <SelectItem value="CSV">CSV / TXT Genérico</SelectItem>
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
                <p className="text-[10px] text-muted-foreground mt-1">Suporta: Promob CSV, Promob JSON, CorteCloud, Smart Cabinets</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
