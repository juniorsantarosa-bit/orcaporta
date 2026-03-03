import { NestingSheet } from "@/types/promob";
import { Zap } from "lucide-react";

interface CuttingPlanReportProps {
  layout: NestingSheet;
}

export function CuttingPlanReport({ layout }: CuttingPlanReportProps) {
  // Scale SVG to fill ~70% of available print height (A4 ≈ 277mm printable → ~70% = 194mm ≈ 730px)
  const maxSvgW = 680;
  const maxSvgH = 730;
  const scale = Math.min(maxSvgW / layout.sheetWidth, maxSvgH / layout.sheetHeight);
  const svgW = layout.sheetWidth * scale;
  const svgH = layout.sheetHeight * scale;
  const totalArea = layout.sheetWidth * layout.sheetHeight;
  const usedArea = layout.pieces.reduce((a, p) => a + p.width * p.height, 0);
  const wasteArea = totalArea - usedArea;

  return (
    <div className="w-full max-w-4xl mx-auto bg-card rounded-xl border border-border shadow-sm p-4 print:shadow-none print:border-black print:p-2 print:max-w-none">
      {/* Compact Header */}
      <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-extrabold tracking-tight">
            MAX<span className="text-primary">CUT</span>
          </span>
        </div>
        <div className="flex items-center gap-6 text-[10px]">
          <div>
            <span className="text-muted-foreground">Material: </span>
            <span className="font-semibold text-foreground">{layout.material}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Chapa: </span>
            <span className="font-mono font-semibold text-foreground">{layout.sheetWidth}×{layout.sheetHeight}×{layout.espessura}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Aproveit.: </span>
            <span className={`font-bold ${layout.efficiency > 80 ? 'text-success' : layout.efficiency > 60 ? 'text-warning' : 'text-destructive'}`}>
              {layout.efficiency.toFixed(1)}%
            </span>
          </div>
          <div className="font-semibold text-foreground">Chapa {layout.id}</div>
        </div>
      </div>

      {/* Nesting diagram — large, ~70% of page */}
      <div className="flex justify-center mb-2">
        <svg
          width={svgW + 40}
          height={svgH + 40}
          viewBox={`-20 -20 ${layout.sheetWidth + 40} ${layout.sheetHeight + 40}`}
          className="border border-border rounded bg-muted/20 print:border-black"
          style={{ minHeight: '65vh' }}
        >
          <defs>
            <pattern id={`reportWaste-${layout.id}`} patternUnits="userSpaceOnUse" width="6" height="6">
              <path d="M0 6L6 0" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.1" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="hsl(var(--nesting-sheet))" stroke="hsl(var(--border))" strokeWidth={2} rx={2} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill={`url(#reportWaste-${layout.id})`} rx={2} />

          {layout.pieces.map((piece) => (
            <g key={`${piece.pieceId}-${piece.x}-${piece.y}`}>
              <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height}
                fill="hsl(var(--nesting-piece))" stroke="hsl(var(--nesting-piece-stroke))" strokeWidth={1} rx={1} />

              {/* Edge bands */}
              {piece.bordaSup && <line x1={piece.x} y1={piece.y} x2={piece.x + piece.width} y2={piece.y} stroke="hsl(var(--warning))" strokeWidth={3} />}
              {piece.bordaInf && <line x1={piece.x} y1={piece.y + piece.height} x2={piece.x + piece.width} y2={piece.y + piece.height} stroke="hsl(var(--warning))" strokeWidth={3} />}
              {piece.bordaEsq && <line x1={piece.x} y1={piece.y} x2={piece.x} y2={piece.y + piece.height} stroke="hsl(var(--warning))" strokeWidth={3} />}
              {piece.bordaDir && <line x1={piece.x + piece.width} y1={piece.y} x2={piece.x + piece.width} y2={piece.y + piece.height} stroke="hsl(var(--warning))" strokeWidth={3} />}

              {/* Drill holes */}
              {piece.furos?.map((h, i) => (
                <circle key={i} cx={piece.x + h.X} cy={piece.y + h.Y}
                  r={Math.max(h.DIAM / 2, 2)}
                  fill={h.DIAM >= 15 ? "hsl(var(--warning))" : h.DIAM >= 5 ? "hsl(217 91% 45%)" : "hsl(var(--destructive))"}
                  opacity={0.7} />
              ))}

              {/* Piece label + dimensions */}
              {piece.width > 50 && piece.height > 25 && (
                <>
                  <text x={piece.x + piece.width / 2} y={piece.y + piece.height / 2 - 6}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(piece.width / 5, piece.height / 4, 28)}
                    fontWeight={700} fill="hsl(var(--foreground))" fontFamily="Inter">
                    {piece.label}
                  </text>
                  <text x={piece.x + piece.width / 2} y={piece.y + piece.height / 2 + 10}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(piece.width / 8, piece.height / 5, 11)}
                    fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
                    {piece.width}×{piece.height}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Dimensions */}
          <text x={layout.sheetWidth / 2} y={-8} textAnchor="middle"
            fontSize={11} fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{layout.sheetWidth}</text>
          <text x={-8} y={layout.sheetHeight / 2} textAnchor="middle" dominantBaseline="central"
            fontSize={11} fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono"
            transform={`rotate(-90, -8, ${layout.sheetHeight / 2})`}>{layout.sheetHeight}</text>
        </svg>
      </div>

      {/* Compact pieces list — only this sheet's pieces */}
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-1.5 py-1 font-medium">#</th>
              <th className="text-left px-1.5 py-1 font-medium">Descrição</th>
              <th className="text-right px-1.5 py-1 font-medium">C</th>
              <th className="text-right px-1.5 py-1 font-medium">L</th>
              <th className="text-center px-1.5 py-1 font-medium">Fitas</th>
              <th className="text-center px-1.5 py-1 font-medium">Furos</th>
              <th className="text-left px-1.5 py-1 font-medium">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {layout.pieces.map((p) => (
              <tr key={`${p.pieceId}-${p.x}`} className="border-t border-border/50">
                <td className="px-1.5 py-0.5 font-bold text-primary">{p.label}</td>
                <td className="px-1.5 py-0.5 font-medium truncate max-w-[180px]">{p.descricao}</td>
                <td className="px-1.5 py-0.5 text-right font-mono">{p.width}</td>
                <td className="px-1.5 py-0.5 text-right font-mono">{p.height}</td>
                <td className="px-1.5 py-0.5 text-center text-[8px]">
                  {[p.bordaSup && "S", p.bordaInf && "I", p.bordaEsq && "E", p.bordaDir && "D"].filter(Boolean).join("") || "—"}
                </td>
                <td className="px-1.5 py-0.5 text-center font-mono">{p.furos?.length || 0}</td>
                <td className="px-1.5 py-0.5 text-muted-foreground truncate max-w-[100px]">{p.cliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
        <span>{layout.pieces.length} peças nesta chapa</span>
        <span>Útil: {(usedArea / 1000000).toFixed(3)}m² · Sobra: {(wasteArea / 1000000).toFixed(3)}m²</span>
      </div>
    </div>
  );
}
