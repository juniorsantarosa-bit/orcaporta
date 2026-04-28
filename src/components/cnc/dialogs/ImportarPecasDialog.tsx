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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formato, setFormato] = useState<Formato>("Auto");
  const [aspireMaterial, setAspireMaterial] = useState("MDF Branco");
  const [aspireEspessura, setAspireEspessura] = useState(15);
  const [aspireQtd, setAspireQtd] = useState(1);
  const [aspireDescricao, setAspireDescricao] = useState("");

  const isAspireExt = (n: string) => /\.(tap|nc)$/i.test(n);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    const first = files[0];
    if (first.name.endsWith(".json")) setFormato("PromobJSON");
    else if (first.name.endsWith(".csv")) setFormato("PromobCSV");
    else if (isAspireExt(first.name)) {
      setFormato("Aspire");
      // Em modo lote, usa o nome de cada arquivo como descrição automática
      const base = first.name.replace(/\.(tap|nc)$/i, "").replace(/[_]+/g, " ").trim();
      setAspireDescricao(files.length > 1 ? "" : base);
    }
  };

  /** Importa um único arquivo Aspire — retorna true em sucesso */
  const importAspireOne = async (file: File, useFileNameAsDesc: boolean): Promise<boolean> => {
    const text = await file.text();
    const r = parseAspireFile(text);
    if (r.sides.length === 0 || (r.width === 0 && r.height === 0)) {
      toast.error(`${file.name}: contorno não pôde ser extraído.`);
      return false;
    }
    const isFrisos = r.mode === "frisos";
    const observacao = isFrisos
      ? `Aspire · ${r.frisoCount} frisos · vão ${r.frisoLarguraMm}×${r.frisoAlturaMm}mm · cobrado ${r.frisoBilledLengthMm}mm/friso · fresa Ø${r.toolDiameter}mm`
      : `Aspire · ${r.sides.length} lados · perímetro ${(r.perimeter/1000).toFixed(2)}m · fresa Ø${r.toolDiameter}mm`;
    const cleanName = file.name.replace(/\.(tap|nc)$/i, "").replace(/[_]+/g, " ").trim();
    const desc = useFileNameAsDesc || !aspireDescricao
      ? cleanName
      : aspireDescricao;
    const piece: CuttingPiece = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      projeto: file.name,
      cliente: "",
      descricao: desc,
      largura: r.width,
      altura: r.height,
      espessura: aspireEspessura,
      material: aspireMaterial,
      quantidade: aspireQtd,
      bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
      veio: false,
      observacao,
      source: "aspire",
      // Default: lado curvo é fresa, lado reto é serra (usuário pode trocar)
      aspireSides: r.sides.map(s => ({
        ...s,
        banded: false,
        bandedManual: false,
        cutType: s.kind === "curvo" ? "fresa" : "serra" as "fresa" | "serra",
      })),
      aspirePerimeter: r.perimeter,
      aspireToolDiameter: r.toolDiameter,
      aspireContour: r.contour,
      aspireOrigin: { minX: r.originMinX, minY: r.originMinY, maxX: r.originMaxX, maxY: r.originMaxY },
      aspireMode: r.mode,
      aspireFrisoCount: r.frisoCount,
      aspireFrisoLengthMm: r.frisoLengthMm,
      aspireFrisoLarguraMm: r.frisoLarguraMm,
      aspireFrisoAlturaMm: r.frisoAlturaMm,
      aspireFrisoBilledLengthMm: r.frisoBilledLengthMm,
      aspireFrisoCutType: r.mode === "frisos" ? "fresa" : undefined,
    };
    onImport([piece]);
    return true;
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecione um ou mais arquivos para importar.");
      return;
    }

    try {
      // Modo lote Aspire: importa cada arquivo como uma peça individual.
      const aspireFiles = selectedFiles.filter(f => isAspireExt(f.name));
      const otherFiles = selectedFiles.filter(f => !isAspireExt(f.name));

      if (aspireFiles.length > 0 && (formato === "Aspire" || formato === "Auto")) {
        let ok = 0;
        for (const file of aspireFiles) {
          const r = await importAspireOne(file, aspireFiles.length > 1);
          if (r) ok++;
        }
        if (ok > 0) {
          toast.success(
            aspireFiles.length === 1
              ? `Peça Aspire importada.`
              : `${ok} de ${aspireFiles.length} arquivos Aspire importados.`,
          );
        }
        if (otherFiles.length === 0) {
          onOpenChange(false);
          return;
        }
      }

      // Outros formatos: por simplicidade, importa apenas o primeiro arquivo não-Aspire.
      const selectedFile = otherFiles[0] ?? selectedFiles[0];
      const effective: Formato = formato === "Auto"
        ? (isAspireExt(selectedFile.name) ? "Aspire"
          : selectedFile.name.endsWith(".json") ? "PromobJSON"
          : "PromobCSV")
        : formato;

      if (effective === "Aspire") {
        const ok = await importAspireOne(selectedFile, false);
        if (ok) toast.success(`Peça Aspire importada.`);
        onOpenChange(false);
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

  const showAspireFields = formato === "Aspire" || (formato === "Auto" && selectedFiles.some(f => isAspireExt(f.name)));
  const isMultiAspire = selectedFiles.length > 1 && selectedFiles.every(f => isAspireExt(f.name));

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
                <SelectItem value="Aspire">Aspire / Vectric (.tap, .nc) — múltiplos suportado</SelectItem>
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
            <input ref={fileRef} type="file" multiple className="hidden" accept=".json,.csv,.txt,.xml,.tap,.nc" onChange={handleFileChange} />
            {selectedFiles.length > 0 ? (
              <div className="text-left max-h-32 overflow-y-auto space-y-0.5">
                <div className="text-[11px] text-muted-foreground mb-1 text-center">
                  <b className="text-foreground">{selectedFiles.length}</b> arquivo(s) selecionado(s):
                </div>
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <File className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground text-[10px]">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para selecionar um ou mais arquivos</p>
                <p className="text-[10px] text-muted-foreground mt-1">Suporta: Promob CSV/JSON, Aspire .tap/.nc (múltiplos), CSV genérico</p>
              </div>
            )}
          </div>

          {showAspireFields && (
            <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-primary">
                Dados {isMultiAspire ? "comuns aos arquivos Aspire" : "da peça Aspire"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs flex flex-col gap-1">
                  Descrição {isMultiAspire && <span className="text-[9px] text-muted-foreground">(ignorada — usa nome do arquivo)</span>}
                  <Input
                    value={aspireDescricao}
                    onChange={(e) => setAspireDescricao(e.target.value)}
                    className="h-7 text-xs"
                    placeholder={isMultiAspire ? "Auto: nome do arquivo" : "Ex.: Painel Cabeceira"}
                    disabled={isMultiAspire}
                  />
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
