import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

interface Props {
  pieces: CuttingPiece[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpdate: (id: number, patch: Partial<CuttingPiece>) => void;
  layouts?: NestingSheet[];
}

export function SimplePartsTable({ pieces, selectedId, onSelect, onUpdate, layouts }: Props) {
  const pieceSheetMap = new Map<number, number>();
  if (layouts) {
    layouts.forEach((sheet, sheetIdx) => {
      sheet.pieces.forEach(pp => {
        if (pp.pieceId !== undefined) pieceSheetMap.set(pp.pieceId, sheetIdx + 1);
      });
    });
  }

  const totalM2 = pieces.reduce((a, p) => a + (p.largura * p.altura * p.quantidade) / 1_000_000, 0);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-medium text-foreground">Lista de Peças</span>
        <span className="text-[9px] text-muted-foreground">{pieces.length} itens</span>
      </div>
      <ScrollArea className="flex-1">
        {pieces.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhuma peça importada.
            <br />
            Clique em <b className="text-foreground">Importar Peças</b>.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/50 text-muted-foreground font-medium text-[10px]">
                <th className="text-left px-2 py-1.5 w-8">#</th>
                <th className="text-left px-2 py-1.5">Descrição</th>
                <th className="text-right px-2 py-1.5 w-14">Larg.</th>
                <th className="text-right px-2 py-1.5 w-14">Alt.</th>
                <th className="text-right px-2 py-1.5 w-10">Esp.</th>
                <th className="text-left px-2 py-1.5 w-20">Material</th>
                <th className="text-right px-2 py-1.5 w-8">Qt</th>
                <th className="text-center px-1 py-1.5 w-8" title="Borda Sup">S</th>
                <th className="text-center px-1 py-1.5 w-8" title="Borda Inf">I</th>
                <th className="text-center px-1 py-1.5 w-8" title="Borda Esq">E</th>
                <th className="text-center px-1 py-1.5 w-8" title="Borda Dir">D</th>
                <th className="text-center px-1 py-1.5 w-12" title="Furos">Furos</th>
                <th className="text-center px-1 py-1.5 w-8" title="Chapa">Ch</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((piece, index) => {
                const sheetNum = pieceSheetMap.get(piece.id);
                const numFuros = piece.numFurosOrcamento ?? piece.furos?.length ?? 0;
                const isAspire = piece.source === "aspire";
                return (
                  <tr
                    key={piece.id}
                    onClick={() => onSelect(piece.id)}
                    className={`cursor-pointer border-b border-border/30 transition-colors text-[11px] ${
                      selectedId === piece.id
                        ? "bg-yellow-500/20 border-l-2 border-l-yellow-400"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-2 py-1 text-muted-foreground font-medium">{index + 1}</td>
                    <td className={`px-2 py-1 truncate max-w-[120px] ${selectedId === piece.id ? "font-semibold text-yellow-400" : "font-medium"}`}>
                      {isAspire && <span className="text-[9px] mr-1 px-1 py-px rounded bg-primary/20 text-primary uppercase">Aspire</span>}
                      {piece.descricao}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.largura}</td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.altura}</td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.espessura}</td>
                    <td className="px-2 py-1 truncate max-w-[80px] text-muted-foreground text-[10px]">
                      {piece.material.split(" ")[0]}
                    </td>
                    <td className="px-2 py-1 text-right font-medium">{piece.quantidade}</td>

                    {isAspire ? (
                      // Aspire: per-side popover instead of S/I/E/D columns
                      <td colSpan={4} className="px-1 py-1 text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-6 text-[10px] px-2 gap-1"
                            >
                              <Settings2 className="h-3 w-3" />
                              {(piece.aspireSides ?? []).filter(s => s.banded).length}/{piece.aspireSides?.length ?? 0} fitas
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="text-xs font-semibold mb-2">Fita por lado</div>
                            <div className="space-y-1.5">
                              {(piece.aspireSides ?? []).map((s) => (
                                <label key={s.index} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <Checkbox
                                    checked={s.banded}
                                    onCheckedChange={(v) => {
                                      const sides = (piece.aspireSides ?? []).map(ss =>
                                        ss.index === s.index ? { ...ss, banded: !!v } : ss
                                      );
                                      onUpdate(piece.id, { aspireSides: sides });
                                    }}
                                  />
                                  <span className="flex-1">
                                    Lado {s.index} <span className="text-muted-foreground">({s.kind})</span>
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {s.lengthMm.toFixed(1)}mm
                                  </span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={piece.bordaSup} onCheckedChange={(v) => onUpdate(piece.id, { bordaSup: !!v })} />
                        </td>
                        <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={piece.bordaInf} onCheckedChange={(v) => onUpdate(piece.id, { bordaInf: !!v })} />
                        </td>
                        <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={piece.bordaEsq} onCheckedChange={(v) => onUpdate(piece.id, { bordaEsq: !!v })} />
                        </td>
                        <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={piece.bordaDir} onCheckedChange={(v) => onUpdate(piece.id, { bordaDir: !!v })} />
                        </td>
                      </>
                    )}

                    <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        min={0}
                        value={numFuros}
                        onChange={(e) => onUpdate(piece.id, { numFurosOrcamento: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-6 text-[10px] text-center px-1 w-12 mx-auto"
                      />
                    </td>
                    <td className="px-1 py-1 text-center font-mono text-[10px] text-muted-foreground">
                      {sheetNum ? `#${sheetNum}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ScrollArea>
      <div className="px-3 py-1.5 bg-muted/20 border-t border-border text-[10px] text-muted-foreground flex justify-between">
        <span>{pieces.length} peças</span>
        <span className="font-mono">{totalM2.toFixed(2)} m²</span>
      </div>
    </div>
  );
}
