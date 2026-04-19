import { useState, useEffect, useCallback } from "react";
import { NestingSheet } from "@/types/promob";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  layouts: NestingSheet[];
  selectedPieceId?: number | null;
  onSelectPiece?: (id: number) => void;
  /** Índice (1-based) do lado Aspire a destacar com linha tracejada vermelha */
  selectedSideIndex?: number | null;
}

/** 12 cores claras distintas — espelha SheetView2D original */
const PIECE_COLORS = [
  "#A8DADC", "#F4A261", "#C9B1FF", "#8FBC8F",
  "#F28B82", "#FFD166", "#7EC8E3", "#B5D99C",
  "#E0A8D0", "#FFB385", "#80CBC4", "#B0A0E8",
];
const getPieceColor = (i: number) => PIECE_COLORS[i % PIECE_COLORS.length];

/**
 * Visualização 2D simples (modo Serra) — replica abordagem do SheetView2D original:
 * SVG com viewBox em coordenadas reais da chapa + flex centralizado + zoom via CSS scale.
 */
export function SimpleSheetView({ layouts, selectedPieceId, onSelectPiece, selectedSideIndex }: Props) {
  const [sheetIdx, setSheetIdx] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (sheetIdx >= layouts.length) setSheetIdx(0);
  }, [layouts.length, sheetIdx]);

  const sheet = layouts[sheetIdx];

  const handleFit = useCallback(() => setZoom(1), []);

  if (!sheet) {
    return (
      <div className="flex flex-col h-full bg-muted/20">
        <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border h-10" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center space-y-2">
            <p>Nenhum plano de corte ainda.</p>
            <p className="text-xs">Importe peças e clique em <b>Otimizar</b>.</p>
          </div>
        </div>
      </div>
    );
  }

  // viewBox com pequena margem para dimensões e bordas
  const margin = 30;
  const vb = `-${margin} -${margin} ${sheet.sheetWidth + margin * 2} ${sheet.sheetHeight + margin * 2}`;

  return (
    <div className="flex flex-col h-full bg-muted/20 min-h-0">
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
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(5, z * 1.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleFit}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Área de desenho (flex centralizado, igual ao original) */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          className="origin-center transition-transform duration-150"
          style={{
            transform: `scale(${zoom})`,
            // Aspecto da chapa, ocupando o máximo do container
            width: "min(95%, 90vh * " + (sheet.sheetWidth / sheet.sheetHeight) + ")",
            aspectRatio: `${sheet.sheetWidth} / ${sheet.sheetHeight}`,
            maxHeight: "95%",
          }}
        >
          <svg
            viewBox={vb}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full block"
          >
            {/* Padrão pontilhado estilo Aspire para chapas com peças Aspire */}
            <defs>
              <pattern id="aspire-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.8" fill="#999" />
              </pattern>
            </defs>

            {/* Chapa — fundo branco + pontilhado quando há peça Aspire (modo "folha Aspire") */}
            <rect
              x={0}
              y={0}
              width={sheet.sheetWidth}
              height={sheet.sheetHeight}
              fill={sheet.pieces.some(pp => (pp as any).isAspire) ? "#ffffff" : "hsl(var(--card))"}
              stroke="hsl(var(--border))"
              strokeWidth={3}
            />
            {sheet.pieces.some(pp => (pp as any).isAspire) && (
              <rect
                x={0}
                y={0}
                width={sheet.sheetWidth}
                height={sheet.sheetHeight}
                fill="url(#aspire-dots)"
                pointerEvents="none"
              />
            )}

            {/* Peças (origem inferior — flip Y) */}
            {sheet.pieces.map((p, i) => {
              const px = p.x;
              const py = sheet.sheetHeight - (p.y + p.height);
              const color = getPieceColor(i);
              const rotated = (p as any).rotated;
              const isSelected =
                selectedPieceId !== null &&
                selectedPieceId !== undefined &&
                p.pieceId === selectedPieceId;

              const fontSize = Math.min(p.width / 6, p.height / 4, 60);
              const fontSize2 = Math.min(p.width / 10, p.height / 6, 28);

              // Build SVG path from Aspire contour (local coords → sheet coords with Y flip)
              const aspireContour = (p as any).aspireContour as
                | Array<
                    | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
                    | { kind: "arc"; x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; cw: boolean }
                  >
                | undefined;
              const isAspire = (p as any).isAspire === true && aspireContour && aspireContour.length > 0;

              let aspirePath = "";
              if (isAspire && aspireContour) {
                const toX = (lx: number) => px + lx;
                const toY = (ly: number) => py + p.height - ly;
                let prev: { x: number; y: number } | null = null;
                for (const seg of aspireContour) {
                  const sx = toX(seg.x1), sy = toY(seg.y1);
                  const ex = toX(seg.x2), ey = toY(seg.y2);
                  if (!prev || Math.hypot(prev.x - sx, prev.y - sy) > 0.5) {
                    aspirePath += `M ${sx.toFixed(2)} ${sy.toFixed(2)} `;
                  }
                  if (seg.kind === "line") {
                    aspirePath += `L ${ex.toFixed(2)} ${ey.toFixed(2)} `;
                  } else {
                    const r = Math.hypot(seg.x1 - seg.cx, seg.y1 - seg.cy);
                    // SVG Y axis points DOWN; we flipped Y above. So a G2 (cw in
                    // machine/CAM) draws as a CCW arc in screen space → sweep=1.
                    // A G3 (ccw) becomes cw on screen → sweep=0.
                    const sweep = seg.cw ? 1 : 0;
                    aspirePath += `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)} `;
                  }
                  prev = { x: ex, y: ey };
                }
                aspirePath += "Z";
              }

              return (
                <g
                  key={`${p.pieceId}-${i}`}
                  style={{ cursor: onSelectPiece ? "pointer" : "default" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectPiece && p.pieceId !== undefined) onSelectPiece(p.pieceId);
                  }}
                >
                  {isAspire ? (
                    // Estilo Aspire: contorno fino preto sobre folha branca (com leve realce ao selecionar).
                    <path
                      d={aspirePath}
                      fill={isSelected ? "#FEF3C7" : "#ffffff"}
                      stroke={isSelected ? "#CA8A04" : "#111"}
                      strokeWidth={isSelected ? 3 : 1.5}
                      strokeLinejoin="round"
                    />
                  ) : (
                    <rect
                      x={px}
                      y={py}
                      width={p.width}
                      height={p.height}
                      fill={isSelected ? "#FACC15" : color}
                      fillOpacity={isSelected ? 0.85 : 0.75}
                      stroke={isSelected ? "#CA8A04" : "#444"}
                      strokeWidth={isSelected ? 6 : 2}
                      rx={2}
                    />
                  )}
                  {/* Furos — coordenadas locais da peça (com rotação), espelhando Y para origem inferior */}
                  {(p.furos || []).map((h, hi) => {
                    const localX = rotated ? h.Y : h.X;
                    const localY = rotated ? h.X : h.Y;
                    const cx = px + localX;
                    const cy = py + p.height - localY;
                    const r = Math.max(h.DIAM / 2, 3);
                    const holeColor = h.DIAM >= 15 ? "#D97706" : h.DIAM >= 5 ? "#3B82F6" : "#EF4444";
                    return (
                      <circle key={hi} cx={cx} cy={cy} r={r} fill={holeColor} opacity={0.85} stroke="#000" strokeWidth={0.5} />
                    );
                  })}
                  {/* Label */}
                  {p.width > 60 && p.height > 30 && (
                    <>
                      <text
                        x={px + p.width / 2}
                        y={py + p.height / 2 - 4}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fontSize}
                        fontWeight="700"
                        fill="#1a1a1a"
                        pointerEvents="none"
                      >
                        {p.label}
                      </text>
                      {p.width > 100 && p.height > 60 && (
                        <text
                          x={px + p.width / 2}
                          y={py + p.height / 2 + fontSize * 0.7}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={fontSize2}
                          fill="#444"
                          pointerEvents="none"
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
              x={sheet.sheetWidth / 2}
              y={-10}
              textAnchor="middle"
              fontSize={18}
              fill="hsl(var(--muted-foreground))"
            >
              {sheet.sheetWidth} mm
            </text>
            <text
              x={-10}
              y={sheet.sheetHeight / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={18}
              fill="hsl(var(--muted-foreground))"
              transform={`rotate(-90, -10, ${sheet.sheetHeight / 2})`}
            >
              {sheet.sheetHeight} mm
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
