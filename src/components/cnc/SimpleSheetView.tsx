import { useState, useRef, useEffect, useCallback } from "react";
import { NestingSheet } from "@/types/promob";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  layouts: NestingSheet[];
  selectedPieceId?: number | null;
  onSelectPiece?: (id: number) => void;
}

/** 12 cores claras distintas — espelha SheetView2D original */
const PIECE_COLORS = [
  "180 55% 72%", "30 80% 72%", "270 55% 75%", "120 50% 68%",
  "340 60% 72%", "50 75% 70%", "200 65% 70%", "90 50% 65%",
  "310 55% 72%", "15 70% 70%", "160 50% 68%", "240 55% 75%",
];
const getPieceColor = (i: number) => PIECE_COLORS[i % PIECE_COLORS.length];

/**
 * Visualização 2D simples do plano de corte (modo Serra).
 * Mostra peças com labels, cortes guilhotinados e dimensões da chapa.
 * Sem interação de drag, sem geração de plano/etiquetas.
 */
export function SimpleSheetView({ layouts, selectedPieceId, onSelectPiece }: Props) {
  const [sheetIdx, setSheetIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (sheetIdx >= layouts.length) setSheetIdx(0);
  }, [layouts.length, sheetIdx]);

  const sheet = layouts[sheetIdx];

  const handleFit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!sheet) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <p>Nenhum plano de corte ainda.</p>
          <p className="text-xs">Importe peças e clique em <b>Otimizar</b>.</p>
        </div>
      </div>
    );
  }

  const padding = 60;
  const containerW = containerRef.current?.clientWidth || 800;
  const containerH = containerRef.current?.clientHeight || 600;
  const scaleX = (containerW - padding * 2) / sheet.sheetWidth;
  const scaleY = (containerH - padding * 2) / sheet.sheetHeight;
  const baseScale = Math.min(scaleX, scaleY);
  const scale = baseScale * zoom;
  const sheetPxW = sheet.sheetWidth * scale;
  const sheetPxH = sheet.sheetHeight * scale;
  const offsetX = (containerW - sheetPxW) / 2 + pan.x;
  const offsetY = (containerH - sheetPxH) / 2 + pan.y;

  return (
    <div className="flex-1 flex flex-col bg-muted/20 min-h-0">
      {/* Header com tabs de chapas */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={sheetIdx === 0}
          onClick={() => setSheetIdx(i => Math.max(0, i - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xs font-medium">
          Chapa <span className="text-primary">{sheetIdx + 1}</span> / {layouts.length}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={sheetIdx >= layouts.length - 1}
          onClick={() => setSheetIdx(i => Math.min(layouts.length - 1, i + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <div className="text-[10px] text-muted-foreground flex gap-3">
          <span>{sheet.material}</span>
          <span>{sheet.sheetWidth}×{sheet.sheetHeight}mm</span>
          <span className="text-primary font-medium">{sheet.efficiency.toFixed(1)}% aproveitamento</span>
          <span>{sheet.pieces.length} peças</span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => z * 1.2)}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => z / 1.2)}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleFit}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Área de desenho */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          isDraggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseMove={(e) => {
          if (!isDraggingRef.current) return;
          const dx = e.clientX - lastMouseRef.current.x;
          const dy = e.clientY - lastMouseRef.current.y;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        }}
        onMouseUp={() => { isDraggingRef.current = false; }}
        onMouseLeave={() => { isDraggingRef.current = false; }}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          setZoom(z => Math.max(0.2, Math.min(10, z * factor)));
        }}
      >
        <svg
          width={containerW}
          height={containerH}
          className="absolute inset-0"
          style={{ pointerEvents: "none" }}
        >
          {/* Chapa */}
          <rect
            x={offsetX}
            y={offsetY}
            width={sheetPxW}
            height={sheetPxH}
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth={2}
          />

          {/* Peças (origem SVG: top-left; flip Y para origem inferior) */}
          {sheet.pieces.map((p, i) => {
            const px = offsetX + p.x * scale;
            const py = offsetY + sheetPxH - (p.y + p.height) * scale;
            const pw = p.width * scale;
            const ph = p.height * scale;
            const fontSize = Math.max(9, Math.min(16, Math.min(pw, ph) / 8));

            return (
              <g key={`${p.pieceId}-${i}`}>
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill="hsl(var(--primary) / 0.18)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                />
                {/* Furos */}
                {(p.furos || []).map((h, hi) => {
                  const hx = px + h.X * scale;
                  const hy = py + ph - h.Y * scale;
                  const r = Math.max(2, (h.DIAM / 2) * scale);
                  return (
                    <circle
                      key={hi}
                      cx={hx}
                      cy={hy}
                      r={r}
                      fill="hsl(var(--destructive) / 0.6)"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={0.5}
                    />
                  );
                })}
                {/* Label */}
                {pw > 30 && ph > 20 && (
                  <>
                    <text
                      x={px + pw / 2}
                      y={py + ph / 2 - 2}
                      textAnchor="middle"
                      fontSize={fontSize}
                      fontWeight="700"
                      fill="hsl(var(--foreground))"
                    >
                      {p.label}
                    </text>
                    {pw > 80 && ph > 40 && (
                      <text
                        x={px + pw / 2}
                        y={py + ph / 2 + fontSize}
                        textAnchor="middle"
                        fontSize={fontSize * 0.7}
                        fill="hsl(var(--muted-foreground))"
                      >
                        {Math.round(p.width)}×{Math.round(p.height)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Dimensões da chapa */}
          <text
            x={offsetX + sheetPxW / 2}
            y={offsetY - 8}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {sheet.sheetWidth} mm
          </text>
          <text
            x={offsetX - 8}
            y={offsetY + sheetPxH / 2}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
            transform={`rotate(-90 ${offsetX - 8} ${offsetY + sheetPxH / 2})`}
          >
            {sheet.sheetHeight} mm
          </text>
        </svg>
      </div>
    </div>
  );
}
