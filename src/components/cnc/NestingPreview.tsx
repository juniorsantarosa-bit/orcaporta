import { SheetLayout } from "@/types/cutting";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface NestingPreviewProps {
  layouts: SheetLayout[];
  selectedPieceId: number | null;
}

function SheetView({ layout, selectedPieceId }: { layout: SheetLayout; selectedPieceId: number | null }) {
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const scale = 0.18;
  const svgWidth = layout.sheetWidth * scale;
  const svgHeight = layout.sheetHeight * scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>Chapa {layout.id}</span>
        <span className="font-mono">{layout.sheetWidth} × {layout.sheetHeight} mm</span>
        <span className={`font-semibold ${layout.efficiency > 80 ? 'text-success' : 'text-warning'}`}>
          {layout.efficiency.toFixed(1)}%
        </span>
      </div>
      <svg
        width={svgWidth + 2}
        height={svgHeight + 2}
        viewBox={`-1 -1 ${layout.sheetWidth + 2} ${layout.sheetHeight + 2}`}
        className="border border-border rounded-sm bg-nesting-sheet"
      >
        {/* Sheet outline */}
        <rect
          x={0}
          y={0}
          width={layout.sheetWidth}
          height={layout.sheetHeight}
          fill="hsl(var(--nesting-sheet))"
          stroke="hsl(var(--border))"
          strokeWidth={2}
        />

        {/* Placed pieces */}
        {layout.pieces.map((piece) => {
          const isSelected = piece.pieceId === selectedPieceId;
          const isHovered = piece.pieceId === hoveredPiece;
          return (
            <g
              key={`${piece.pieceId}-${piece.x}-${piece.y}`}
              onMouseEnter={() => setHoveredPiece(piece.pieceId)}
              onMouseLeave={() => setHoveredPiece(null)}
              className="cursor-pointer"
            >
              <rect
                x={piece.x}
                y={piece.y}
                width={piece.width}
                height={piece.height}
                fill={isSelected ? "hsl(var(--primary) / 0.3)" : isHovered ? "hsl(var(--nesting-piece) / 0.9)" : "hsl(var(--nesting-piece))"}
                stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--nesting-piece-stroke))"}
                strokeWidth={isSelected ? 3 : 1}
                rx={1}
              />
              {/* Label */}
              {piece.width > 100 && piece.height > 50 && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground"
                  fontSize={Math.min(piece.width / 8, piece.height / 4, 40)}
                  fontWeight={500}
                >
                  {piece.label}
                </text>
              )}
              {/* Dimensions */}
              {piece.width > 150 && piece.height > 80 && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height / 2 + Math.min(piece.height / 5, 25)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground"
                  fontSize={Math.min(piece.width / 12, 28)}
                >
                  {piece.width}×{piece.height}
                </text>
              )}
            </g>
          );
        })}

        {/* Origin marker */}
        <circle cx={10} cy={layout.sheetHeight - 10} r={8} fill="hsl(var(--foreground))" opacity={0.5} />
        <text x={30} y={layout.sheetHeight - 5} fontSize={30} className="fill-muted-foreground">Origin</text>
      </svg>
    </div>
  );
}

export function NestingPreview({ layouts, selectedPieceId }: NestingPreviewProps) {
  return (
    <div className="flex flex-col h-full bg-nesting">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground/80">Visualização de Corte</span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{layouts.length} chapas</span>
          <span>
            Eficiência média:{" "}
            <span className="font-semibold text-foreground">
              {(layouts.reduce((a, l) => a + l.efficiency, 0) / layouts.length).toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-wrap gap-6 justify-center">
          {layouts.map((layout) => (
            <SheetView key={layout.id} layout={layout} selectedPieceId={selectedPieceId} />
          ))}
        </div>
        {/* Axis indicator */}
        <div className="flex items-center gap-1 mt-6 ml-4 text-[10px] text-muted-foreground">
          <span>Y</span>
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-muted-foreground" />
            <div className="flex items-center">
              <div className="w-4 h-px bg-muted-foreground" />
              <span className="ml-1">X</span>
            </div>
          </div>
          <span className="ml-1">Z</span>
        </div>
      </ScrollArea>
    </div>
  );
}
