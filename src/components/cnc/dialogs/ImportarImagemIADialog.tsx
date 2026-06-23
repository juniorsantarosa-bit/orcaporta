import { useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CuttingPiece } from "@/types/cutting";
import { ImagePlus, Loader2, Sparkles, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pieces: CuttingPiece[]) => void;
}

interface ExtractedPiece {
  item: number;
  descricao: string;
  larguraMm: number;
  alturaMm: number;
  espessuraMm: number;
  quantidade: number;
  confidence: number;
}

interface ExtractionResult {
  pieces: ExtractedPiece[];
  cotasNoDesenho: number[];
  divergencias: string[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImportarImagemIADialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [pieces, setPieces] = useState<ExtractedPiece[]>([]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setPieces([]);
  }, []);

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setPieces([]);
    const url = await fileToDataUrl(f);
    setPreviewUrl(url);
  };

  const handleExtract = async () => {
    if (!previewUrl) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-pieces-from-image", {
        body: { imageDataUrl: previewUrl },
      });
      if (error) {
        toast.error(error.message || "Falha ao analisar imagem.");
        return;
      }
      const r = data as ExtractionResult;
      if (!r?.pieces || r.pieces.length === 0) {
        toast.error("A IA não conseguiu identificar peças nesta imagem.");
        return;
      }
      setResult(r);
      setPieces(r.pieces);
      toast.success(`${r.pieces.length} peça(s) extraída(s).`);
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado ao chamar a IA.");
    } finally {
      setLoading(false);
    }
  };

  const updatePiece = (idx: number, patch: Partial<ExtractedPiece>) => {
    setPieces(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const removePiece = (idx: number) => {
    setPieces(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (pieces.length === 0) {
      toast.error("Nenhuma peça para importar.");
      return;
    }
    const cuttingPieces: CuttingPiece[] = pieces.map((p, i) => ({
      id: Date.now() + i,
      projeto: file?.name ?? "Imagem",
      cliente: "",
      descricao: p.descricao,
      largura: p.larguraMm,
      altura: p.alturaMm,
      espessura: p.espessuraMm,
      material: "",
      quantidade: p.quantidade,
      bordaInf: false,
      bordaSup: false,
      bordaEsq: false,
      bordaDir: false,
      veio: false,
      observacao: `IA · item ${p.item} · conf ${(p.confidence * 100).toFixed(0)}%`,
    }));
    onImport(cuttingPieces);
    toast.success(`${cuttingPieces.length} peça(s) importada(s).`);
    reset();
    onOpenChange(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const confColor = (c: number) =>
    c >= 0.85 ? "text-emerald-500" : c >= 0.6 ? "text-amber-500" : "text-red-500";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[1200px] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Peças de Imagem (IA)
          </DialogTitle>
        </DialogHeader>

        {!previewUrl ? (
          <div
            className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors flex-1 flex flex-col items-center justify-center"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <ImagePlus className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
            <p className="text-base text-muted-foreground">Clique para enviar uma imagem do projeto</p>
            <p className="text-xs text-muted-foreground mt-2">
              A IA lê a tabela de peças e as cotas do desenho, e gera a lista pronta para orçar.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP — até ~10 MB.</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
            {/* Imagem */}
            <div className="border border-border rounded-lg overflow-hidden bg-muted/30 flex flex-col">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card">
                <span className="text-xs font-medium truncate">{file?.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={reset}
                >
                  Trocar
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2 flex items-start justify-center">
                <img src={previewUrl} alt="Projeto" className="max-w-full h-auto" />
              </div>
            </div>

            {/* Resultado */}
            <div className="border border-border rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
                <span className="text-xs font-medium">Peças extraídas</span>
                {!result && (
                  <Button size="sm" className="h-7 text-xs" onClick={handleExtract} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Lendo imagem…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" /> Analisar com IA
                      </>
                    )}
                  </Button>
                )}
                {result && (
                  <Badge variant="outline" className="text-[10px]">
                    {pieces.length} peça(s)
                  </Badge>
                )}
              </div>

              {!result && !loading && (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                  Clique em <b className="mx-1">Analisar com IA</b> para extrair a lista de peças desta imagem.
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Lendo a imagem… isso leva ~10–30 s.</span>
                </div>
              )}

              {result && (
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {result.divergencias.length > 0 && (
                      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] space-y-1">
                        <div className="flex items-center gap-1 text-amber-500 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Divergências entre tabela e cotas
                        </div>
                        {result.divergencias.map((d, i) => (
                          <div key={i} className="text-muted-foreground">• {d}</div>
                        ))}
                      </div>
                    )}

                    <table className="w-full text-[11px]">
                      <thead className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="text-left py-1 px-1 w-8">#</th>
                          <th className="text-left py-1 px-1">Descrição</th>
                          <th className="text-left py-1 px-1 w-16">L</th>
                          <th className="text-left py-1 px-1 w-16">A</th>
                          <th className="text-left py-1 px-1 w-14">E</th>
                          <th className="text-left py-1 px-1 w-12">Qtd</th>
                          <th className="text-left py-1 px-1 w-10">Conf</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pieces.map((p, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 px-1">
                              <Input
                                type="number"
                                value={p.item}
                                onChange={(e) => updatePiece(i, { item: parseInt(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Input
                                value={p.descricao}
                                onChange={(e) => updatePiece(i, { descricao: e.target.value })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Input
                                type="number"
                                value={p.larguraMm}
                                onChange={(e) => updatePiece(i, { larguraMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Input
                                type="number"
                                value={p.alturaMm}
                                onChange={(e) => updatePiece(i, { alturaMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Input
                                type="number"
                                step="0.1"
                                value={p.espessuraMm}
                                onChange={(e) => updatePiece(i, { espessuraMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Input
                                type="number"
                                min={1}
                                value={p.quantidade}
                                onChange={(e) => updatePiece(i, { quantidade: parseInt(e.target.value) || 1 })}
                                className="h-6 text-[11px] px-1"
                              />
                            </td>
                            <td className={`py-1 px-1 font-mono ${confColor(p.confidence)}`}>
                              {(p.confidence * 100).toFixed(0)}%
                            </td>
                            <td className="py-1 px-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => removePiece(i)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {result.cotasNoDesenho.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="text-[10px] text-muted-foreground mb-1">
                          Cotas detectadas no desenho (referência):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.cotasNoDesenho.map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={pieces.length === 0}>
            Importar {pieces.length > 0 ? `(${pieces.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
