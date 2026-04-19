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
  /** Índice (1-based) do lado Aspire atualmente destacado na visualização */
  selectedSideIndex?: number | null;
  /** Chamado quando o usuário clica em um lado dentro do popover de configuração */
  onSelectSide?: (pieceId: number, sideIndex: number | null) => void;
}

export function SimplePartsTable({ pieces, selectedId, onSelect, onUpdate, layouts, selectedSideIndex, onSelectSide }: Props) {
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
                const isFrisos = piece.aspireMode === "frisos";
                const aspireCutSummary = isFrisos
                  ? `${piece.aspireFrisoCount ?? 0} frisos`
                  : `${piece.aspireSides?.length ?? 0} lados`;
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
                    <td className="px-1 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number" min={0} value={piece.largura}
                        onChange={(e) => onUpdate(piece.id, { largura: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="h-6 text-[10px] text-right px-1 w-14 ml-auto font-mono"
                      />
                    </td>
                    <td className="px-1 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number" min={0} value={piece.altura}
                        onChange={(e) => onUpdate(piece.id, { altura: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="h-6 text-[10px] text-right px-1 w-14 ml-auto font-mono"
                      />
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.espessura}</td>
                    <td className="px-2 py-1 truncate max-w-[80px] text-muted-foreground text-[10px]">
                      {piece.material.split(" ")[0]}
                    </td>
                    <td className="px-1 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number" min={1} value={piece.quantidade}
                        onChange={(e) => onUpdate(piece.id, { quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="h-6 text-[10px] text-right px-1 w-12 ml-auto font-medium"
                      />
                    </td>

                    {isAspire ? (
                      // Aspire: per-side popover (contour) ou global (frisos) — sempre presente
                      <td colSpan={4} className="px-1 py-1 text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              title="Configurar tipo de corte desta peça"
                              className="h-6 text-[10px] px-2 gap-1 border-primary/40 bg-primary/10 hover:bg-primary/15"
                            >
                              <Settings2 className="h-3 w-3" />
                              {`Configurar corte · ${aspireCutSummary}`}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[340px] p-3" onClick={(e) => e.stopPropagation()}>
                            {isFrisos ? (
                              <>
                                <div className="text-xs font-semibold mb-2">Configuração dos frisos (editável)</div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                  <div>
                                    <label className="text-[9px] uppercase text-muted-foreground">Qtd. frisos</label>
                                    <Input
                                      type="number" min={1}
                                      value={piece.aspireFrisoCount ?? 0}
                                      onChange={(e) => onUpdate(piece.id, { aspireFrisoCount: Math.max(1, parseInt(e.target.value) || 1) })}
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] uppercase text-muted-foreground">Compr. cobrado / friso (mm)</label>
                                    <Input
                                      type="number" min={0} step="0.1"
                                      value={piece.aspireFrisoBilledLengthMm ?? piece.aspireFrisoLengthMm ?? 0}
                                      onChange={(e) => onUpdate(piece.id, { aspireFrisoBilledLengthMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                                      className="h-7 text-[11px] font-semibold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] uppercase text-muted-foreground">Largura do vão (mm)</label>
                                    <Input
                                      type="number" min={0} step="0.1"
                                      value={piece.aspireFrisoLarguraMm ?? 0}
                                      onChange={(e) => {
                                        const largura = Math.max(0, parseFloat(e.target.value) || 0);
                                        const altura = piece.aspireFrisoAlturaMm ?? piece.aspireToolDiameter ?? 6;
                                        const fresa = piece.aspireToolDiameter ?? 6;
                                        // Recalcula automaticamente o comprimento cobrado
                                        const billed = 2 * (largura + fresa) + 2 * altura;
                                        onUpdate(piece.id, {
                                          aspireFrisoLarguraMm: largura,
                                          aspireFrisoBilledLengthMm: Math.round(billed * 10) / 10,
                                        });
                                      }}
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] uppercase text-muted-foreground">Altura do vão (mm)</label>
                                    <Input
                                      type="number" min={0} step="0.1"
                                      value={piece.aspireFrisoAlturaMm ?? piece.aspireToolDiameter ?? 6}
                                      onChange={(e) => {
                                        const altura = Math.max(0, parseFloat(e.target.value) || 0);
                                        const largura = piece.aspireFrisoLarguraMm ?? 0;
                                        const fresa = piece.aspireToolDiameter ?? 6;
                                        const billed = 2 * (largura + fresa) + 2 * altura;
                                        onUpdate(piece.id, {
                                          aspireFrisoAlturaMm: altura,
                                          aspireFrisoBilledLengthMm: Math.round(billed * 10) / 10,
                                        });
                                      }}
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground mb-2">
                                  Total cobrado: <b className="text-foreground">{((piece.aspireFrisoCount ?? 0) * (piece.aspireFrisoBilledLengthMm ?? 0) / 1000).toFixed(2)} m</b>
                                  {" · "}fresa Ø{piece.aspireToolDiameter ?? 6}mm
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] font-medium">Tipo de corte:</label>
                                  <select
                                    value={piece.aspireFrisoCutType ?? "fresa"}
                                    onChange={(e) =>
                                      onUpdate(piece.id, { aspireFrisoCutType: e.target.value as "fresa" | "serra" })
                                    }
                                    className="h-7 text-[11px] rounded border border-input bg-background px-2 flex-1"
                                  >
                                    <option value="fresa">Fresa (router)</option>
                                    <option value="serra">Serra (esquadrejadeira)</option>
                                  </select>
                                </div>
                                <div className="mt-2 pt-2 border-t border-border text-[9px] text-muted-foreground">
                                  💡 Comprimento cobrado = 2 × (largura + Ø) + 2 × altura — ida + volta + subida/descida nas pontas.
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs font-semibold mb-2">Configuração por lado</div>
                                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 gap-y-1.5 items-center text-[10px]">
                                  <div className="text-muted-foreground font-semibold uppercase">Lado</div>
                                  <div className="text-muted-foreground font-semibold uppercase">Tipo de corte</div>
                                  <div className="text-muted-foreground font-semibold uppercase text-center">Fita</div>
                                  <div className="text-muted-foreground font-semibold uppercase text-right">mm</div>
                                  {(piece.aspireSides ?? []).map((s) => {
                                    const cutType = s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra");
                                    const isHighlighted = selectedId === piece.id && selectedSideIndex === s.index;
                                    return (
                                      <div key={s.index} className="contents">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectSide?.(piece.id, isHighlighted ? null : s.index);
                                          }}
                                          title="Destacar este lado na visualização"
                                          className={`font-mono text-left px-1.5 py-0.5 rounded transition-colors ${
                                            isHighlighted
                                              ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/60"
                                              : "hover:bg-muted/60"
                                          }`}
                                        >
                                          {s.index} <span className="text-muted-foreground">({s.kind})</span>
                                        </button>
                                        <select
                                          value={cutType}
                                          onChange={(e) => {
                                            const sides = (piece.aspireSides ?? []).map(ss =>
                                              ss.index === s.index ? { ...ss, cutType: e.target.value as "fresa" | "serra" } : ss
                                            );
                                            onUpdate(piece.id, { aspireSides: sides });
                                            onSelectSide?.(piece.id, s.index);
                                          }}
                                          className="h-6 text-[10px] rounded border border-input bg-background px-1"
                                        >
                                          <option value="fresa">Fresa</option>
                                          <option value="serra">Serra</option>
                                        </select>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={s.banded}
                                            onCheckedChange={(v) => {
                                              const sides = (piece.aspireSides ?? []).map(ss =>
                                                ss.index === s.index ? { ...ss, banded: !!v } : ss
                                              );
                                              onUpdate(piece.id, { aspireSides: sides });
                                              onSelectSide?.(piece.id, s.index);
                                            }}
                                          />
                                        </div>
                                        <span className="font-mono text-muted-foreground text-right">
                                          {s.lengthMm.toFixed(1)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 pt-2 border-t border-border text-[9px] text-muted-foreground">
                                  💡 Lado curvo geralmente é <b>fresa</b>, lados retos podem ser <b>serra</b> (mais barato).
                                </div>
                              </>
                            )}
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
