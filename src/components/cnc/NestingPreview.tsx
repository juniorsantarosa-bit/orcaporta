import { SheetLayout } from "@/types/cutting";
import { useState } from "react";
import { Nesting3DView } from "./Nesting3DView";
import { 
  RotateCw, Home, Search, ZoomIn, ZoomOut, Move, Maximize, 
  Eye, Box, Layers 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface NestingPreviewProps {
  layouts: SheetLayout[];
  selectedPieceId: number | null;
}

type ViewMode = "2d" | "3d";

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

function SheetView2D({ layout, selectedPieceId }: { layout: SheetLayout; selectedPieceId: number | null }) {
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const scale = 0.18;
  const svgWidth = layout.sheetWidth * scale;
  const svgHeight = layout.sheetHeight * scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">Chapa {layout.id}</span>
        <span className="font-mono">{layout.sheetWidth} × {layout.sheetHeight}</span>
        <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[9px] ${
          layout.efficiency > 80 
            ? 'bg-success/10 text-success' 
            : 'bg-warning/10 text-warning'
        }`}>
          {layout.efficiency.toFixed(1)}%
        </span>
      </div>
      <svg
        width={svgWidth + 2}
        height={svgHeight + 2}
        viewBox={`-1 -1 ${layout.sheetWidth + 2} ${layout.sheetHeight + 2}`}
        className="rounded-lg shadow-sm"
      >
        <defs>
          <filter id="pieceShadow" x="-2%" y="-2%" width="104%" height="104%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1"/>
          </filter>
        </defs>
        <rect
          x={0} y={0}
          width={layout.sheetWidth} height={layout.sheetHeight}
          fill="hsl(var(--nesting-sheet))"
          stroke="hsl(var(--border))"
          strokeWidth={2}
          rx={4}
        />
        {layout.pieces.map((piece) => {
          const isSelected = piece.pieceId === selectedPieceId;
          const isHovered = piece.pieceId === hoveredPiece;
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
                fill={isSelected ? "hsl(var(--primary) / 0.25)" : isHovered ? "hsl(var(--nesting-piece) / 0.9)" : "hsl(var(--nesting-piece))"}
                stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--nesting-piece-stroke))"}
                strokeWidth={isSelected ? 2.5 : 0.8}
                rx={2}
              />
              {piece.width > 100 && piece.height > 50 && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                  fontSize={Math.min(piece.width / 8, piece.height / 4, 36)}
                  fontWeight={isSelected ? 600 : 500}
                  fontFamily="Inter"
                >
                  {piece.label}
                </text>
              )}
              {piece.width > 150 && piece.height > 80 && (
                <text
                  x={piece.x + piece.width / 2}
                  y={piece.y + piece.height / 2 + Math.min(piece.height / 5, 22)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={Math.min(piece.width / 12, 24)}
                  fontFamily="JetBrains Mono"
                >
                  {piece.width}×{piece.height}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function NestingPreview({ layouts, selectedPieceId }: NestingPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);

  return (
    <div className="flex h-full bg-background">
      {/* Main view area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Visualização de Corte</span>
            <div className="flex bg-muted rounded-md p-0.5">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-all ${
                  viewMode === "2d" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-all ${
                  viewMode === "3d" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                3D
              </button>
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
          {viewMode === "2d" ? (
            <SheetView2D layout={layouts[selectedSheetIdx]} selectedPieceId={selectedPieceId} />
          ) : (
            <Nesting3DView layout={layouts[selectedSheetIdx]} selectedPieceId={selectedPieceId} />
          )}
        </div>
      </div>

      {/* Right toolbar for 3D controls */}
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
      </div>
    </div>
  );
}