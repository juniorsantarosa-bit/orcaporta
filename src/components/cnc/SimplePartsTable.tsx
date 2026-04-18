import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  pieces: CuttingPiece[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  layouts?: NestingSheet[];
}

/**
 * Versão simplificada (somente leitura) da PartsTable.
 * Sem checkboxes de fitas, sem edição. Mantém estilo e cores originais.
 */
export function SimplePartsTable({ pieces, selectedId, onSelect, layouts }: Props) {
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
                <th className="text-left px-2 py-1.5 w-24">Material</th>
                <th className="text-right px-2 py-1.5 w-8">Qt</th>
                <th className="text-center px-1 py-1.5 w-10" title="Chapa">Ch</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((piece, index) => {
                const sheetNum = pieceSheetMap.get(piece.id);
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
                      {piece.descricao}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.largura}</td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.altura}</td>
                    <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.espessura}</td>
                    <td className="px-2 py-1 truncate max-w-[80px] text-muted-foreground text-[10px]">
                      {piece.material.split(" ")[0]}
                    </td>
                    <td className="px-2 py-1 text-right font-medium">{piece.quantidade}</td>
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
