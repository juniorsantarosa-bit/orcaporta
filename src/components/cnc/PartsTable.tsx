import { CuttingPiece } from "@/types/cutting";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface PartsTableProps {
  pieces: CuttingPiece[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPiecesChange?: (pieces: CuttingPiece[]) => void;
}

export function PartsTable({ pieces, selectedId, onSelect, onPiecesChange }: PartsTableProps) {
  const toggleEdge = (pieceId: number, field: "bordaSup" | "bordaInf" | "bordaEsq" | "bordaDir") => {
    if (!onPiecesChange) return;
    const updated = pieces.map(p =>
      p.id === pieceId ? { ...p, [field]: !p[field] } : p
    );
    onPiecesChange(updated);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-medium text-foreground">Lista de Peças</span>
        <span className="text-[9px] text-muted-foreground">{pieces.length} itens</span>
      </div>
      <ScrollArea className="flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50 text-muted-foreground font-medium text-[10px]">
              <th className="text-left px-2 py-1.5 w-8">#</th>
              <th className="text-left px-2 py-1.5">Descrição</th>
              <th className="text-right px-2 py-1.5 w-14">Larg.</th>
              <th className="text-right px-2 py-1.5 w-14">Alt.</th>
              <th className="text-right px-2 py-1.5 w-10">Esp.</th>
              <th className="text-left px-2 py-1.5 w-24">Material</th>
              <th className="text-center px-2 py-1.5 w-6">V</th>
              <th className="text-center px-1 py-1.5 w-6" title="Fita Superior">S</th>
              <th className="text-center px-1 py-1.5 w-6" title="Fita Inferior">I</th>
              <th className="text-center px-1 py-1.5 w-6" title="Fita Esquerda">E</th>
              <th className="text-center px-1 py-1.5 w-6" title="Fita Direita">D</th>
              <th className="text-right px-2 py-1.5 w-8">Qt</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((piece) => (
              <tr
                key={piece.id}
                onClick={() => onSelect(piece.id)}
                className={`cursor-pointer border-b border-border/30 transition-colors text-[11px] ${
                  selectedId === piece.id
                    ? "bg-yellow-500/20 border-l-2 border-l-yellow-400"
                    : "hover:bg-muted/30"
                }`}
              >
                <td className="px-2 py-1 text-muted-foreground">{piece.id}</td>
                <td className={`px-2 py-1 truncate max-w-[120px] ${selectedId === piece.id ? "font-semibold text-yellow-400" : "font-medium"}`}>
                  {piece.descricao}
                </td>
                <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.largura}</td>
                <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.altura}</td>
                <td className="px-2 py-1 text-right font-mono text-[10px]">{piece.espessura}</td>
                <td className="px-2 py-1 truncate max-w-[80px] text-muted-foreground text-[10px]">{piece.material.split(' ')[0]}</td>
                <td className="px-2 py-1 text-center">
                  {piece.veio && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />}
                </td>
                <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={piece.bordaSup}
                    onCheckedChange={() => toggleEdge(piece.id, "bordaSup")}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={piece.bordaInf}
                    onCheckedChange={() => toggleEdge(piece.id, "bordaInf")}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={piece.bordaEsq}
                    onCheckedChange={() => toggleEdge(piece.id, "bordaEsq")}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={piece.bordaDir}
                    onCheckedChange={() => toggleEdge(piece.id, "bordaDir")}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-2 py-1 text-right font-medium">{piece.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="px-3 py-1.5 bg-muted/20 border-t border-border text-[10px] text-muted-foreground flex justify-between">
        <span>{pieces.length} peças</span>
        <span className="font-mono">{pieces.reduce((a, p) => a + (p.largura * p.altura * p.quantidade) / 1000000, 0).toFixed(2)} m²</span>
      </div>
    </div>
  );
}
