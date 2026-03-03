import { NestingSheet } from "@/types/promob";
import { Zap } from "lucide-react";

interface CuttingPlanReportProps {
  layout: NestingSheet;
}

export function CuttingPlanReport({ layout }: CuttingPlanReportProps) {
  const scale = Math.min(460 / layout.sheetWidth, 580 / layout.sheetHeight);
  const svgW = layout.sheetWidth * scale;
  const svgH = layout.sheetHeight * scale;
  const totalArea = layout.sheetWidth * layout.sheetHeight;
  const usedArea = layout.pieces.reduce((a, p) => a + p.width * p.height, 0);
  const wasteArea = totalArea - usedArea;

  return (
    <div className="w-full max-w-2xl mx-auto bg-card rounded-xl border border-border shadow-sm p-6 print:shadow-none print:border-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-lg font-extrabold tracking-tight">
            MAX<span className="text-primary">CUT</span>
          </span>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          <div className="font-semibold text-foreground text-sm">Nesting: {layout.id}</div>
          <div>ID: {layout.codCorte}_0</div>
        </div>
      </div>

      {/* Info row */}
      <div className="grid grid-cols-3 gap-4 text-xs mb-4">
        <div>
          <span className="text-muted-foreground">Material:</span>
          <div className="font-semibold">{layout.material}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Dimensões:</span>
          <div className="font-mono font-semibold">{layout.sheetWidth} × {layout.sheetHeight} × {layout.espessura}mm</div>
        </div>
        <div>
          <span className="text-muted-foreground">Aproveitamento:</span>
          <div className={`font-bold text-sm ${layout.efficiency > 80 ? 'text-success' : layout.efficiency > 60 ? 'text-warning' : 'text-destructive'}`}>
            {layout.efficiency.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Nesting diagram */}
      <div className="flex justify-center mb-4">
        <svg
          width={svgW + 40}
          height={svgH + 40}
          viewBox={`-20 -20 ${layout.sheetWidth + 40} ${layout.sheetHeight + 40}`}
          className="border border-border rounded-lg bg-muted/20"
        >
          <defs>
            <pattern id="reportWaste" patternUnits="userSpaceOnUse" width="6" height="6">
              <path d="M0 6L6 0" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.1" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="hsl(var(--nesting-sheet))" stroke="hsl(var(--border))" strokeWidth={2} rx={2} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="url(#reportWaste)" rx={2} />

          {layout.pieces.map((piece) => (
            <g key={`${piece.pieceId}-${piece.x}-${piece.y}`}>
              <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height}
                fill="hsl(var(--nesting-piece))" stroke="hsl(var(--nesting-piece-stroke))" strokeWidth={1} rx={1} />

              {/* Edge bands */}
              {piece.bordaSup && <line x1={piece.x} y1={piece.y} x2={piece.x + piece.width} y2={piece.y} stroke="hsl(var(--warning))" strokeWidth={3} />}
              {piece.bordaInf && <line x1={piece.x} y1={piece.y + piece.height} x2={piece.x + piece.width} y2={piece.y + piece.height} stroke="hsl(var(--warning))" strokeWidth={3} />}

              {/* Drill holes */}
              {piece.furos?.map((h, i) => (
                <circle key={i} cx={piece.x + h.X} cy={piece.y + h.Y}
                  r={Math.max(h.DIAM / 2, 2)}
                  fill={h.DIAM >= 15 ? "hsl(var(--warning))" : h.DIAM >= 5 ? "hsl(217 91% 45%)" : "hsl(var(--destructive))"}
                  opacity={0.7} />
              ))}

              {/* Piece number */}
              {piece.width > 60 && piece.height > 30 && (
                <text x={piece.x + piece.width / 2} y={piece.y + piece.height / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={Math.min(piece.width / 5, piece.height / 3, 32)}
                  fontWeight={700} fill="hsl(var(--foreground))" fontFamily="Inter">
                  {piece.label}
                </text>
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

      {/* Pieces table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left px-2 py-1.5 font-medium">#</th>
              <th className="text-left px-2 py-1.5 font-medium">Descrição</th>
              <th className="text-right px-2 py-1.5 font-medium">Comp.</th>
              <th className="text-right px-2 py-1.5 font-medium">Larg.</th>
              <th className="text-center px-2 py-1.5 font-medium">Fitas</th>
              <th className="text-center px-2 py-1.5 font-medium">Furos</th>
              <th className="text-left px-2 py-1.5 font-medium">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {layout.pieces.map((p) => (
              <tr key={`${p.pieceId}-${p.x}`} className="border-t border-border/50">
                <td className="px-2 py-1 font-bold text-primary">{p.label}</td>
                <td className="px-2 py-1 font-medium">{p.descricao}</td>
                <td className="px-2 py-1 text-right font-mono">{p.width}</td>
                <td className="px-2 py-1 text-right font-mono">{p.height}</td>
                <td className="px-2 py-1 text-center">
                  {[p.bordaSup && "S", p.bordaInf && "I", p.bordaEsq && "E", p.bordaDir && "D"].filter(Boolean).join("") || "—"}
                </td>
                <td className="px-2 py-1 text-center font-mono">{p.furos?.length || 0}</td>
                <td className="px-2 py-1 text-muted-foreground">{p.cliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>{layout.pieces.length} peças nesta chapa</span>
        <span>Área útil: {(usedArea / 1000000).toFixed(3)} m² · Sobra: {(wasteArea / 1000000).toFixed(3)} m²</span>
      </div>
    </div>
  );
}
