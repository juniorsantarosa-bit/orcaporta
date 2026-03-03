import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { useState, forwardRef, useImperativeHandle, useCallback } from "react";

export interface SheetView2DHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
}

function DrillHoleSVG({ hole, pieceX, pieceY }: { hole: PromobHole; pieceX: number; pieceY: number }) {
  const cx = pieceX + hole.X;
  const cy = pieceY + hole.Y;
  const r = Math.max(hole.DIAM / 2, 2);
  let color = "hsl(var(--destructive))";
  let opacity = 0.8;
  if (hole.DIAM >= 15) { color = "hsl(var(--warning))"; opacity = 0.9; }
  else if (hole.DIAM >= 5) { color = "hsl(217 91% 45%)"; }

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
      {hole.DIAM >= 15 && (
        <>
          <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.5} opacity={0.5} />
          <line x1={cx - r * 0.3} y1={cy} x2={cx + r * 0.3} y2={cy} stroke="hsl(var(--foreground))" strokeWidth={0.5} opacity={0.5} />
          <line x1={cx} y1={cy - r * 0.3} x2={cx} y2={cy + r * 0.3} stroke="hsl(var(--foreground))" strokeWidth={0.5} opacity={0.5} />
        </>
      )}
    </g>
  );
}

function EdgeBandIndicator({ piece, side }: { piece: PlacedNestingPiece; side: "top" | "bottom" | "left" | "right" }) {
  const thickness = 3;
  let x = piece.x, y = piece.y, w = 0, h = 0;
  switch (side) {
    case "top": w = piece.width; h = thickness; break;
    case "bottom": y = piece.y + piece.height - thickness; w = piece.width; h = thickness; break;
    case "left": w = thickness; h = piece.height; break;
    case "right": x = piece.x + piece.width - thickness; w = thickness; h = piece.height; break;
  }
  return <rect x={x} y={y} width={w} height={h} fill="hsl(var(--warning))" opacity={0.7} rx={1} />;
}

interface SheetView2DProps {
  layout: NestingSheet;
  selectedPieceId: number | null;
}

export const SheetView2D = forwardRef<SheetView2DHandle, SheetView2DProps>(({ layout, selectedPieceId }, ref) => {
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom(z => Math.min(z * 1.3, 5)),
    zoomOut: () => setZoom(z => Math.max(z / 1.3, 0.3)),
    zoomFit: () => setZoom(1),
  }));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      return Math.min(Math.max(z * delta, 0.3), 5);
    });
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Sheet header info */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="font-semibold text-foreground text-sm">Chapa {layout.id}</span>
        <span className="font-mono text-muted-foreground">{layout.sheetWidth} × {layout.sheetHeight} × {layout.espessura}mm</span>
        <span className="text-muted-foreground">{layout.material}</span>
        <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
          layout.efficiency > 80 ? 'bg-success/15 text-success'
            : layout.efficiency > 60 ? 'bg-warning/15 text-warning'
            : 'bg-destructive/15 text-destructive'
        }`}>
          {layout.efficiency.toFixed(1)}% aproveitamento
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">Zoom: {(zoom * 100).toFixed(0)}%</span>
      </div>

      <div onWheel={handleWheel} className="overflow-auto max-w-full max-h-[70vh] cursor-grab active:cursor-grabbing">
        <svg
          width={(layout.sheetWidth + 4) * 0.22 * zoom}
          height={(layout.sheetHeight + 4) * 0.22 * zoom}
          viewBox={`-2 -2 ${layout.sheetWidth + 4} ${layout.sheetHeight + 4}`}
          className="rounded-lg shadow-md bg-card border border-border"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <defs>
            <filter id="pieceShadow" x="-2%" y="-2%" width="104%" height="104%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.08" />
            </filter>
            <pattern id="wastePattern" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M0 8L8 0" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.15" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="hsl(var(--nesting-sheet))" stroke="hsl(var(--border))" strokeWidth={2} rx={3} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="url(#wastePattern)" rx={3} />

          {layout.pieces.map((piece) => {
            const isSelected = piece.pieceId === selectedPieceId;
            const isHovered = piece.pieceId === hoveredPiece;
            const showDetail = piece.width > 80 && piece.height > 40;
            const showFullDetail = piece.width > 200 && piece.height > 100;

            return (
              <g
                key={`${piece.pieceId}-${piece.x}-${piece.y}`}
                onMouseEnter={() => setHoveredPiece(piece.pieceId)}
                onMouseLeave={() => setHoveredPiece(null)}
                className="cursor-pointer"
                filter={isSelected || isHovered ? "url(#pieceShadow)" : undefined}
              >
                <rect
                  x={piece.x} y={piece.y}
                  width={piece.width} height={piece.height}
                  fill={isSelected ? "hsl(var(--primary) / 0.2)" : isHovered ? "hsl(var(--nesting-piece) / 0.95)" : "hsl(var(--nesting-piece))"}
                  stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--nesting-piece-stroke))"}
                  strokeWidth={isSelected ? 2.5 : 0.8}
                  rx={1.5}
                />

                {piece.bordaSup && <EdgeBandIndicator piece={piece} side="top" />}
                {piece.bordaInf && <EdgeBandIndicator piece={piece} side="bottom" />}
                {piece.bordaEsq && <EdgeBandIndicator piece={piece} side="left" />}
                {piece.bordaDir && <EdgeBandIndicator piece={piece} side="right" />}

                {piece.furos?.map((hole, hi) => (
                  <DrillHoleSVG key={hi} hole={hole} pieceX={piece.x} pieceY={piece.y} />
                ))}

                {showDetail && (
                  <text
                    x={piece.x + piece.width / 2}
                    y={piece.y + (showFullDetail ? piece.height * 0.35 : piece.height / 2)}
                    textAnchor="middle" dominantBaseline="central"
                    fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                    fontSize={Math.min(piece.width / 6, piece.height / 3, 40)}
                    fontWeight={700} fontFamily="Inter"
                  >
                    {piece.label}
                  </text>
                )}

                {showFullDetail && (
                  <text
                    x={piece.x + piece.width / 2} y={piece.y + piece.height * 0.55}
                    textAnchor="middle" dominantBaseline="central"
                    fill="hsl(var(--foreground))" fontSize={Math.min(piece.width / 12, 18)}
                    fontWeight={500} fontFamily="Inter" opacity={0.8}
                  >
                    {piece.descricao}
                  </text>
                )}

                {showFullDetail && (
                  <text
                    x={piece.x + piece.width / 2} y={piece.y + piece.height * 0.72}
                    textAnchor="middle" dominantBaseline="central"
                    fill="hsl(var(--muted-foreground))" fontSize={Math.min(piece.width / 14, 14)}
                    fontFamily="JetBrains Mono"
                  >
                    {piece.width}×{piece.height}
                  </text>
                )}

                {piece.furos && piece.furos.length > 0 && showDetail && (
                  <g>
                    <rect x={piece.x + piece.width - 28} y={piece.y + 4} width={24} height={14} rx={3} fill="hsl(var(--primary))" opacity={0.85} />
                    <text x={piece.x + piece.width - 16} y={piece.y + 12} textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize={8} fontWeight={600} fontFamily="JetBrains Mono">
                      {piece.furos.length}F
                    </text>
                  </g>
                )}

                {isHovered && (
                  <g>
                    <rect x={piece.x + piece.width / 2 - 60} y={piece.y - 28} width={120} height={24} rx={4}
                      fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.95} />
                    <text x={piece.x + piece.width / 2} y={piece.y - 15} textAnchor="middle" dominantBaseline="central"
                      fill="hsl(var(--foreground))" fontSize={9} fontFamily="JetBrains Mono">
                      {piece.descricao} {piece.width}×{piece.height}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <text x={layout.sheetWidth / 2} y={layout.sheetHeight + 16} textAnchor="middle"
            fill="hsl(var(--muted-foreground))" fontSize={12} fontFamily="JetBrains Mono">{layout.sheetWidth}</text>
          <text x={-12} y={layout.sheetHeight / 2} textAnchor="middle" dominantBaseline="central"
            fill="hsl(var(--muted-foreground))" fontSize={12} fontFamily="JetBrains Mono"
            transform={`rotate(-90, -12, ${layout.sheetHeight / 2})`}>{layout.sheetHeight}</text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Furo 3mm
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(217 91% 45%)" }} /> Furo 5mm
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(var(--warning))" }} /> Dobradiça 15mm
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-1 rounded-sm inline-block" style={{ background: "hsl(var(--warning))", opacity: 0.7 }} /> Fita de borda
        </span>
      </div>
    </div>
  );
});

SheetView2D.displayName = "SheetView2D";
