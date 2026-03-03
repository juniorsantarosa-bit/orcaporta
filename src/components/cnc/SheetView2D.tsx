import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { useState, forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface SheetView2DHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  toggleDragMode: () => boolean;
}

/** 12 distinct light colors for pieces */
const PIECE_COLORS = [
  "180 55% 72%", "30 80% 72%", "270 55% 75%", "120 50% 68%",
  "340 60% 72%", "50 75% 70%", "200 65% 70%", "90 50% 65%",
  "310 55% 72%", "15 70% 70%", "160 50% 68%", "240 55% 75%",
];

function getPieceColor(idx: number): string {
  return PIECE_COLORS[idx % PIECE_COLORS.length];
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
  return <rect x={x} y={y} width={w} height={h} fill="hsl(var(--warning))" opacity={0.85} rx={1} />;
}

interface SheetView2DProps {
  layout: NestingSheet;
  selectedPieceId: number | null;
  dragMode?: boolean;
  onPiecesReorder?: (pieces: PlacedNestingPiece[]) => void;
  onReoptimize?: () => void;
}

export const SheetView2D = forwardRef<SheetView2DHandle, SheetView2DProps>(({ layout, selectedPieceId, dragMode = false, onPiecesReorder, onReoptimize }, ref) => {
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [internalDragMode, setInternalDragMode] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [tempPieces, setTempPieces] = useState<PlacedNestingPiece[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isDragActive = dragMode || internalDragMode;
  const pieces = tempPieces || layout.pieces;

  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom(z => Math.min(z * 1.3, 5)),
    zoomOut: () => setZoom(z => Math.max(z / 1.3, 0.3)),
    zoomFit: () => setZoom(1),
    toggleDragMode: () => {
      const next = !internalDragMode;
      setInternalDragMode(next);
      if (!next) {
        if (tempPieces) {
          onPiecesReorder?.(tempPieces);
          setTempPieces(null);
        }
      } else {
        setTempPieces([...layout.pieces]);
      }
      return next;
    },
  }));

  useEffect(() => {
    if (dragMode && !tempPieces) {
      setTempPieces([...layout.pieces]);
    }
    if (!dragMode && !internalDragMode && tempPieces) {
      setTempPieces(null);
    }
  }, [dragMode, layout.pieces]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      return Math.min(Math.max(z * delta, 0.3), 5);
    });
  }, []);

  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    if (!isDragActive || !tempPieces) return;
    e.preventDefault();
    e.stopPropagation();
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const piece = tempPieces[idx];
    setDraggingIdx(idx);
    setDragOffset({ dx: svgPt.x - piece.x, dy: svgPt.y - piece.y });
  }, [isDragActive, tempPieces, getSVGPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdx === null || !tempPieces) return;
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    const newX = Math.max(0, Math.min(svgPt.x - dragOffset.dx, layout.sheetWidth - tempPieces[draggingIdx].width));
    const newY = Math.max(0, Math.min(svgPt.y - dragOffset.dy, layout.sheetHeight - tempPieces[draggingIdx].height));
    
    setTempPieces(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[draggingIdx] = { ...updated[draggingIdx], x: newX, y: newY };
      return updated;
    });
  }, [draggingIdx, tempPieces, dragOffset, getSVGPoint, layout.sheetWidth, layout.sheetHeight]);

  const handleMouseUp = useCallback(() => {
    if (draggingIdx === null || !tempPieces) return;
    
    const sorted = [...tempPieces].sort((a, b) => {
      const distA = a.x + a.y;
      const distB = b.x + b.y;
      return distA - distB;
    });

    const gap = 4;
    const packed = regroupPieces(sorted, layout.sheetWidth, layout.sheetHeight, gap);
    
    setTempPieces(packed);
    setDraggingIdx(null);
  }, [draggingIdx, tempPieces, layout.sheetWidth, layout.sheetHeight]);

  const displayEfficiency = (() => {
    const totalArea = layout.sheetWidth * layout.sheetHeight;
    const usedArea = pieces.reduce((a, p) => a + p.width * p.height, 0);
    return ((usedArea / totalArea) * 100).toFixed(1);
  })();

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Sheet header info */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="font-semibold text-foreground text-sm">Chapa {layout.id}</span>
        <span className="font-mono text-muted-foreground">{layout.sheetWidth} × {layout.sheetHeight} × {layout.espessura}mm</span>
        <span className="text-muted-foreground">{layout.material}</span>
        <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
          Number(displayEfficiency) > 80 ? 'bg-success/15 text-success'
            : Number(displayEfficiency) > 60 ? 'bg-warning/15 text-warning'
            : 'bg-destructive/15 text-destructive'
        }`}>
          {displayEfficiency}% aproveitamento
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">Zoom: {(zoom * 100).toFixed(0)}%</span>
        {isDragActive && (
          <span className="text-[9px] bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full animate-pulse">
            ✋ Modo arrastar — solte para reagrupar
          </span>
        )}
        {/* OTIMIZAR button */}
        <Button
          size="sm"
          onClick={onReoptimize}
          className="h-6 px-3 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          OTIMIZAR
        </Button>
      </div>

      <div
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`overflow-auto max-w-full max-h-[70vh] ${isDragActive ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <svg
          ref={svgRef}
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
            <filter id="dragShadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.25" />
            </filter>
            <pattern id="wastePattern" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M0 8L8 0" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.15" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="hsl(var(--nesting-sheet))" stroke="hsl(var(--border))" strokeWidth={2} rx={3} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="url(#wastePattern)" rx={3} />

          {pieces.map((piece, idx) => {
            const isSelected = piece.pieceId === selectedPieceId;
            const isHovered = piece.pieceId === hoveredPiece;
            const isDragging = draggingIdx === idx;
            const showDetail = piece.width > 80 && piece.height > 40;
            const showFullDetail = piece.width > 200 && piece.height > 100;
            const pieceColor = getPieceColor(idx);

            return (
              <g
                key={`${piece.pieceId}-${idx}`}
                onMouseEnter={() => !isDragActive && setHoveredPiece(piece.pieceId)}
                onMouseLeave={() => setHoveredPiece(null)}
                onMouseDown={(e) => handleMouseDown(e, idx)}
                className={isDragActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                filter={isDragging ? "url(#dragShadow)" : isSelected || isHovered ? "url(#pieceShadow)" : undefined}
                style={{ transition: isDragging ? 'none' : 'transform 0.3s ease' }}
              >
                {isDragActive && !isDragging && (
                  <rect
                    x={piece.x} y={piece.y}
                    width={piece.width} height={piece.height}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1}
                    strokeDasharray="6,3"
                    rx={1.5}
                    opacity={0.3}
                  />
                )}

                <rect
                  x={piece.x} y={piece.y}
                  width={piece.width} height={piece.height}
                  fill={isDragging ? `hsl(${pieceColor} / 0.5)` : `hsl(${pieceColor} / 0.85)`}
                  stroke={
                    isDragging ? "hsl(var(--primary))"
                    : isSelected ? "hsl(var(--selected-stroke))"
                    : isHovered ? `hsl(${pieceColor})`
                    : `hsl(${pieceColor} / 0.5)`
                  }
                  strokeWidth={isDragging ? 3 : isSelected ? 3.5 : isHovered ? 2 : 0.8}
                  rx={1.5}
                  opacity={isDragging ? 0.9 : 1}
                />

                {/* Red selection glow */}
                {isSelected && !isDragging && (
                  <rect
                    x={piece.x - 2} y={piece.y - 2}
                    width={piece.width + 4} height={piece.height + 4}
                    fill="none"
                    stroke="hsl(var(--selected-stroke))"
                    strokeWidth={2}
                    rx={3}
                    opacity={0.6}
                    strokeDasharray="8,4"
                  />
                )}

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
                    fill="hsl(225 20% 10%)"
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
                    fill="hsl(225 20% 15%)" fontSize={Math.min(piece.width / 12, 18)}
                    fontWeight={500} fontFamily="Inter" opacity={0.8}
                  >
                    {piece.descricao}
                  </text>
                )}

                {showFullDetail && (
                  <text
                    x={piece.x + piece.width / 2} y={piece.y + piece.height * 0.72}
                    textAnchor="middle" dominantBaseline="central"
                    fill="hsl(225 15% 30%)" fontSize={Math.min(piece.width / 14, 14)}
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

                {isHovered && !isDragActive && (
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
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block border-2" style={{ borderColor: "hsl(var(--selected-stroke))" }} /> Selecionada
        </span>
      </div>
    </div>
  );
});

SheetView2D.displayName = "SheetView2D";

function regroupPieces(
  pieces: PlacedNestingPiece[],
  sheetW: number,
  sheetH: number,
  gap: number
): PlacedNestingPiece[] {
  const placed: PlacedNestingPiece[] = [];

  for (const piece of pieces) {
    let bestX = 0, bestY = 0;
    let found = false;

    for (let y = gap; y <= sheetH - piece.height; y += 5) {
      for (let x = gap; x <= sheetW - piece.width; x += 5) {
        const overlaps = placed.some(p =>
          x < p.x + p.width + gap &&
          x + piece.width + gap > p.x &&
          y < p.y + p.height + gap &&
          y + piece.height + gap > p.y
        );
        if (!overlaps) {
          bestX = x;
          bestY = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    placed.push({ ...piece, x: bestX, y: bestY });
  }

  return placed;
}
