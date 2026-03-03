import { CuttingPiece } from "@/types/cutting";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PartsTableProps {
  pieces: CuttingPiece[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function PartsTable({ pieces, selectedId, onSelect }: PartsTableProps) {
  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-[10px] text-muted-foreground italic">
          Arraste uma coluna aqui para agrupar por essa coluna
        </span>
      </div>
      <ScrollArea className="flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-header text-foreground/90 font-semibold">
              <th className="text-left px-2 py-1.5 w-10">ID</th>
              <th className="text-left px-2 py-1.5">Projeto</th>
              <th className="text-left px-2 py-1.5">Cliente</th>
              <th className="text-left px-2 py-1.5">Descrição</th>
              <th className="text-right px-2 py-1.5 w-16">Larg.</th>
              <th className="text-right px-2 py-1.5 w-16">Altura</th>
              <th className="text-left px-2 py-1.5">Material</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((piece) => (
              <tr
                key={piece.id}
                onClick={() => onSelect(piece.id)}
                className={`cursor-pointer border-b border-border/50 transition-colors ${
                  selectedId === piece.id
                    ? "bg-table-row-selected font-medium"
                    : "hover:bg-table-row-hover"
                }`}
              >
                <td className="px-2 py-1 text-muted-foreground">{piece.id}</td>
                <td className="px-2 py-1 truncate max-w-[100px]">{piece.projeto}</td>
                <td className="px-2 py-1 truncate max-w-[90px]">{piece.cliente}</td>
                <td className="px-2 py-1 font-medium text-primary">{piece.descricao}</td>
                <td className="px-2 py-1 text-right font-mono">{piece.largura}</td>
                <td className="px-2 py-1 text-right font-mono">{piece.altura}</td>
                <td className="px-2 py-1 truncate max-w-[130px]">{piece.material}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="px-3 py-1.5 bg-muted/30 border-t border-border text-[10px] text-muted-foreground flex justify-between">
        <span>{pieces.length} peças</span>
        <span>Total: {pieces.reduce((a, p) => a + (p.largura * p.altura) / 1000000, 0).toFixed(2)} m²</span>
      </div>
    </div>
  );
}
