import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CuttingPiece } from "@/types/cutting";
import { FileUp, File } from "lucide-react";
import { toast } from "sonner";
import { parsePromobCSV, parsePromobJSON, promobToCuttingPieces } from "@/lib/promobParser";
import { parseAspireFile } from "@/lib/aspireParser";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pieces: CuttingPiece[]) => void;
}

type Formato = "Auto" | "Aspire" | "PromobCSV" | "PromobJSON" | "CSV";

export function ImportarPecasDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formato, setFormato] = useState<Formato>("Auto");
  const [aspireMaterial, setAspireMaterial] = useState("MDF Branco");
  const [aspireEspessura, setAspireEspessura] = useState(15);
  const [aspireQtd, setAspireQtd] = useState(1);
  const [aspireDescricao, setAspireDescricao] = useState("");

  const isAspireExt = (n: string) => /\.(tap|nc)$/i.test(n);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.name.endsWith(".json")) setFormato("PromobJSON");
    else if (file.name.endsWith(".csv")) setFormato("PromobCSV");
    else if (isAspireExt(file.name)) {
      setFormato("Aspire");
      if (!aspireDescricao) setAspireDescricao(file.name.replace(/\.(tap|nc)$/i, ""));
    }
  };

  const importAspire = async (file: File) => {
    const text = await file.text();
    const r = parseAspireFile(text);
    if (r.sides.length === 0 || r.width === 0) {
      toast.error("Não consegui extrair o contorno deste arquivo.");
      return;
    }
    const piece: CuttingPiece = {
      id: Date.now(),
      projeto: file.name,
      cliente: "",
      descricao: aspireDescricao || file.name.replace(/\.(tap|nc)$/i, ""),
      largura: r.width,
      altura: r.height,
      espessura: aspireEspessura,
      material: aspireMaterial,
      quantidade: aspireQtd,
      bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
      veio: false,
      observacao: `Aspire · ${r.sides.length} lados · perímetro ${(r.perimeter/1000).toFixed(2)}m · fresa Ø${r.aspireToolDiameter ?? r.toolDiameter}mm`,
      source: "aspire",
      aspireSides: r.sides.map(s => ({ ...s, banded: false })),
      aspirePerimeter: r.perimeter,
      aspireToolDiameter: r.toolDiameter,
    };
    onImport([piece]);
    toast.success(`Peça Aspire importada · ${r.sides.length} lados detectados (W ${r.width}mm × H ${r.height}mm).`);
    onOpenChange(false);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }

    try {
      const effective: Formato = formato === "Auto"
        ? (isAspireExt(selectedFile.name) ? "Aspire"
          : selectedFile.name.endsWith(".json") ? "PromobJSON"
          : "PromobCSV")
        : formato;

      if (effective === "Aspire") {
        await importAspire(selectedFile);
        return;
      }

      const text = await selectedFile.text();

      if (effective === "PromobJSON") {
        const promobPieces = parsePromobJSON(text);
        const pieces = promobToCuttingPieces(promobPieces);
        onImport(pieces);
        toast.success(`${pieces.length} peças importadas do Promob JSON!`);
      } else if (effective === "PromobCSV") {
        const promobPieces = parsePromobCSV(text);
        const pieces = promobToCuttingPieces(promobPieces);
        onImport(pieces);
        toast.success(`${pieces.length} peças importadas do Promob CSV!`);
      } else {
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
      console.error(err);
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
    }
  };

  const showAspireFields = formato === "Aspire" || (formato === "Auto" && selectedFile && isAspireExt(selectedFile.name));

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
            <Select value={formato} onValueChange={(v) => setFormato(v as Formato)}>
              <SelectTrigger className="h-7 text-xs w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">Detectar pelo arquivo</SelectItem>
                <SelectItem value="Aspire">Aspire / Vectric (.tap, .nc)</SelectItem>
                <SelectItem value="PromobCSV">Promob CSV (PromobCut)</SelectItem>
                <SelectItem value="PromobJSON">Promob JSON (Otimizador)</SelectItem>
                <SelectItem value="CSV">CSV / TXT Genérico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".json,.csv,.txt,.xml,.tap,.nc" onChange={handleFileChange} />
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
                <p className="text-[10px] text-muted-foreground mt-1">Suporta: Promob CSV/JSON, Aspire .tap/.nc, CSV genérico</p>
              </div>
            )}
          </div>

          {showAspireFields && (
            <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-primary">Dados da peça Aspire</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs flex flex-col gap-1">
                  Descrição
                  <Input value={aspireDescricao} onChange={(e) => setAspireDescricao(e.target.value)} className="h-7 text-xs" placeholder="Ex.: Painel Cabeceira" />
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Material
                  <Input value={aspireMaterial} onChange={(e) => setAspireMaterial(e.target.value)} className="h-7 text-xs" />
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Espessura (mm)
                  <Input type="number" value={aspireEspessura} onChange={(e) => setAspireEspessura(parseFloat(e.target.value) || 15)} className="h-7 text-xs" />
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Quantidade
                  <Input type="number" min={1} value={aspireQtd} onChange={(e) => setAspireQtd(parseInt(e.target.value) || 1)} className="h-7 text-xs" />
                </label>
              </div>
              <div className="text-[10px] text-muted-foreground">
                A largura, altura, lados e comprimentos serão extraídos do percurso.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
