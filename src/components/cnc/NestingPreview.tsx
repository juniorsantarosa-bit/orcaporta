import { NestingSheet, PlacedNestingPiece } from "@/types/promob";
import { useState } from "react";
import { Nesting3DView } from "./Nesting3DView";
import {
  RotateCw, Home, Search, ZoomIn, ZoomOut, Move, Maximize,
  Eye, Box, Layers, Printer, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LabelPreview } from "./LabelPreview";
import { CuttingPlanReport } from "./CuttingPlanReport";

interface NestingPreviewProps {
  layouts: NestingSheet[];
  selectedPieceId: number | null;
}

type ViewMode = "2d" | "3d" | "report" | "labels";

function ViewToolButton({ icon: Icon, label, onClick, active }: { icon: React.ElementType; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function DrillHoleSVG({ hole, pieceX, pieceY, scale }: { hole: { X: number; Y: number; DIAM: number; FACE: string }; pieceX: number; pieceY: number; scale: number }) {
  const cx = pieceX + hole.X;
  const cy = pieceY + hole.Y;
  const r = Math.max(hole.DIAM / 2, 2);

  let color = "hsl(var(--destructive))";
  let opacity = 0.8;
  if (hole.DIAM >= 15) {
    color = "hsl(var(--warning))";
    opacity = 0.9;
  } else if (hole.DIAM >= 5) {
    color = "hsl(217 91% 45%)";
  }

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

function SheetView2D({ layout, selectedPieceId }: { layout: NestingSheet; selectedPieceId: number | null }) {
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const maxDim = Math.max(layout.sheetWidth, layout.sheetHeight);
  const scale = Math.min(500 / layout.sheetWidth, 700 / layout.sheetHeight, 0.22);
  const svgWidth = layout.sheetWidth * scale;
  const svgHeight = layout.sheetHeight * scale;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Sheet header info */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="font-semibold text-foreground text-sm">Chapa {layout.id}</span>
        <span className="font-mono text-muted-foreground">{layout.sheetWidth} × {layout.sheetHeight} × {layout.espessura}mm</span>
        <span className="text-muted-foreground">{layout.material}</span>
        <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
          layout.efficiency > 80
            ? 'bg-success/15 text-success'
            : layout.efficiency > 60
            ? 'bg-warning/15 text-warning'
            : 'bg-destructive/15 text-destructive'
        }`}>
          {layout.efficiency.toFixed(1)}% aproveitamento
        </span>
      </div>

      <svg
        width={svgWidth + 4}
        height={svgHeight + 4}
        viewBox={`-2 -2 ${layout.sheetWidth + 4} ${layout.sheetHeight + 4}`}
        className="rounded-lg shadow-md bg-card border border-border"
      >
        <defs>
          <filter id="pieceShadow" x="-2%" y="-2%" width="104%" height="104%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.08" />
          </filter>
          <pattern id="wastePattern" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M0 8L8 0" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.15" />
          </pattern>
        </defs>

        {/* Sheet background */}
        <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
          fill="hsl(var(--nesting-sheet))" stroke="hsl(var(--border))" strokeWidth={2} rx={3} />

        {/* Waste area pattern */}
        <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
          fill="url(#wastePattern)" rx={3} />

        {/* Pieces */}
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
              {/* Piece rectangle */}
              <rect
                x={piece.x} y={piece.y}
                width={piece.width} height={piece.height}
                fill={isSelected ? "hsl(var(--primary) / 0.2)" : isHovered ? "hsl(var(--nesting-piece) / 0.95)" : "hsl(var(--nesting-piece))"}
                stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--nesting-piece-stroke))"}
                strokeWidth={isSelected ? 2.5 : 0.8}
                rx={1.5}
              />

              {/* Edge band indicators */}
              {piece.bordaSup && <EdgeBandIndicator piece={piece} side="top" />}
              {piece.bordaInf && <EdgeBandIndicator piece={piece} side="bottom" />}
              {piece.bordaEsq && <EdgeBandIndicator piece={piece} side="left" />}
              {piece.bordaDir && <EdgeBandIndicator piece={piece} side="right" />}

              {/* Drill holes */}
              {piece.furos?.map((hole, hi) => (
                <DrillHoleSVG key={hi} hole={hole} pieceX={piece.x} pieceY={piece.y} scale={scale} />
              ))}

              {/* Piece number (always visible) */}
              {showDetail && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + (showFullDetail ? piece.height * 0.35 : piece.height / 2)}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                  fontSize={Math.min(piece.width / 6, piece.height / 3, 40)}
                  fontWeight={700}
                  fontFamily="Inter"
                >
                  {piece.label}
                </text>
              )}

              {/* Description */}
              {showFullDetail && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height * 0.55}
                  textAnchor="middle" dominantBaseline="central"
                  fill="hsl(var(--foreground))"
                  fontSize={Math.min(piece.width / 12, 18)}
                  fontWeight={500}
                  fontFamily="Inter"
                  opacity={0.8}
                >
                  {piece.descricao}
                </text>
              )}

              {/* Dimensions */}
              {showFullDetail && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height * 0.72}
                  textAnchor="middle" dominantBaseline="central"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={Math.min(piece.width / 14, 14)}
                  fontFamily="JetBrains Mono"
                >
                  {piece.width}×{piece.height}
                </text>
              )}

              {/* Hole count badge */}
              {piece.furos && piece.furos.length > 0 && showDetail && (
                <g>
                  <rect
                    x={piece.x + piece.width - 28}
                    y={piece.y + 4}
                    width={24} height={14}
                    rx={3}
                    fill="hsl(var(--primary))"
                    opacity={0.85}
                  />
                  <text
                    x={piece.x + piece.width - 16}
                    y={piece.y + 12}
                    textAnchor="middle" dominantBaseline="central"
                    fill="white"
                    fontSize={8}
                    fontWeight={600}
                    fontFamily="JetBrains Mono"
                  >
                    {piece.furos.length}F
                  </text>
                </g>
              )}

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={piece.x + piece.width / 2 - 60}
                    y={piece.y - 28}
                    width={120} height={24}
                    rx={4}
                    fill="hsl(var(--popover))"
                    stroke="hsl(var(--border))"
                    strokeWidth={0.5}
                    opacity={0.95}
                  />
                  <text
                    x={piece.x + piece.width / 2}
                    y={piece.y - 15}
                    textAnchor="middle" dominantBaseline="central"
                    fill="hsl(var(--foreground))"
                    fontSize={9}
                    fontFamily="JetBrains Mono"
                  >
                    {piece.descricao} {piece.width}×{piece.height}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Dimension labels on edges */}
        <text x={layout.sheetWidth / 2} y={layout.sheetHeight + 16} textAnchor="middle"
          fill="hsl(var(--muted-foreground))" fontSize={12} fontFamily="JetBrains Mono">{layout.sheetWidth}</text>
        <text x={-12} y={layout.sheetHeight / 2} textAnchor="middle" dominantBaseline="central"
          fill="hsl(var(--muted-foreground))" fontSize={12} fontFamily="JetBrains Mono"
          transform={`rotate(-90, -12, ${layout.sheetHeight / 2})`}>{layout.sheetHeight}</text>
      </svg>

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
}

export function NestingPreview({ layouts, selectedPieceId }: NestingPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);

  const viewButtons: { mode: ViewMode; label: string }[] = [
    { mode: "2d", label: "2D" },
    { mode: "3d", label: "3D" },
    { mode: "report", label: "Plano" },
    { mode: "labels", label: "Etiquetas" },
  ];

  return (
    <div className="flex h-full bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Visualização de Corte</span>
            <div className="flex bg-muted rounded-md p-0.5">
              {viewButtons.map(vb => (
                <button
                  key={vb.mode}
                  onClick={() => setViewMode(vb.mode)}
                  className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-all ${
                    viewMode === vb.mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {vb.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{layouts.length} chapas</span>
            <span>
              Eficiência:{" "}
              <span className="font-semibold text-foreground">
                {(layouts.reduce((a, l) => a + l.efficiency, 0) / layouts.length).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>

        {/* Sheet tabs */}
        <div className="flex items-center gap-1 px-4 py-1 border-b border-border bg-card/50">
          {layouts.map((layout, idx) => (
            <button
              key={layout.id}
              onClick={() => setSelectedSheetIdx(idx)}
              className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${
                selectedSheetIdx === idx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Chapa {layout.id} — {layout.efficiency.toFixed(0)}%
            </button>
          ))}
        </div>

        {/* View */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {viewMode === "2d" && (
            <SheetView2D layout={layouts[selectedSheetIdx]} selectedPieceId={selectedPieceId} />
          )}
          {viewMode === "3d" && (
            <Nesting3DView layout={layouts[selectedSheetIdx]} selectedPieceId={selectedPieceId} />
          )}
          {viewMode === "report" && (
            <CuttingPlanReport layout={layouts[selectedSheetIdx]} />
          )}
          {viewMode === "labels" && (
            <LabelPreview layout={layouts[selectedSheetIdx]} />
          )}
        </div>
      </div>

      {/* Right toolbar */}
      <div className="w-9 border-l border-border bg-card flex flex-col items-center py-2 gap-0.5">
        <ViewToolButton icon={Home} label="Home" onClick={() => {}} />
        <ViewToolButton icon={Move} label="Mover" onClick={() => {}} />
        <ViewToolButton icon={RotateCw} label="Orbit" onClick={() => {}} active={viewMode === "3d"} />
        <Separator className="my-1 w-5" />
        <ViewToolButton icon={ZoomIn} label="Zoom +" onClick={() => {}} />
        <ViewToolButton icon={ZoomOut} label="Zoom -" onClick={() => {}} />
        <ViewToolButton icon={Maximize} label="Zoom Fit" onClick={() => {}} />
        <ViewToolButton icon={Search} label="Lupa" onClick={() => {}} />
        <Separator className="my-1 w-5" />
        <ViewToolButton icon={Eye} label="Wireframe" onClick={() => {}} />
        <ViewToolButton icon={Box} label="Sólido" onClick={() => {}} />
        <ViewToolButton icon={Layers} label="Camadas" onClick={() => {}} />
        <Separator className="my-1 w-5" />
        <ViewToolButton icon={Printer} label="Imprimir" onClick={() => window.print()} />
        <ViewToolButton icon={Tag} label="Etiquetas" onClick={() => setViewMode("labels")} />
      </div>
    </div>
  );
}
