import { NestingSheet } from "@/types/promob";
import { Zap } from "lucide-react";

interface CuttingPlanReportProps {
  layout: NestingSheet;
}

/** 12 distinct pastel colors for print pieces */
const PRINT_PIECE_COLORS = [
  "#A8DADC", "#F4A261", "#C9B1FF", "#8FBC8F", "#F28B82",
  "#FFD166", "#7EC8E3", "#B5D99C", "#E0A8D0", "#FFB385",
  "#80CBC4", "#B0A0E8",
];

export function CuttingPlanReport({ layout }: CuttingPlanReportProps) {
  // Print layout: header ~10%, diagram ~65%, list ~25% of A4
  // A4 printable ≈ 277mm → header ~28mm, diagram ~180mm, list ~69mm
  const maxSvgW = 700;
  const maxSvgH = 680;
  const scale = Math.min(maxSvgW / layout.sheetWidth, maxSvgH / layout.sheetHeight);
  const svgW = layout.sheetWidth * scale;
  const svgH = layout.sheetHeight * scale;
  const totalArea = layout.sheetWidth * layout.sheetHeight;
  const usedArea = layout.pieces.reduce((a, p) => a + p.width * p.height, 0);
  const wasteArea = totalArea - usedArea;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-black rounded-xl border border-border shadow-sm print:shadow-none print:border-black print:max-w-none"
      style={{ pageBreakAfter: "always" }}>
      
      {/* Header — 10% */}
      <div className="flex items-center justify-between border-b border-gray-300 px-4 py-1.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-extrabold tracking-tight">
            MAX<span className="text-emerald-600">CUT</span>
          </span>
        </div>
        <div className="flex items-center gap-6 text-[10px] text-gray-700">
          <div>
            <span className="text-gray-500">Material: </span>
            <span className="font-semibold">{layout.material}</span>
          </div>
          <div>
            <span className="text-gray-500">Chapa: </span>
            <span className="font-mono font-semibold">{layout.sheetWidth}×{layout.sheetHeight}×{layout.espessura}mm</span>
          </div>
          <div>
            <span className="text-gray-500">Aproveit.: </span>
            <span className={`font-bold ${layout.efficiency > 80 ? 'text-emerald-600' : layout.efficiency > 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {layout.efficiency.toFixed(1)}%
            </span>
          </div>
          <div className="font-semibold">Chapa {layout.id}</div>
        </div>
      </div>

      {/* Nesting diagram — 65% */}
      <div className="flex justify-center px-2 py-1" style={{ minHeight: '60vh' }}>
        <svg
          width={svgW + 40}
          height={svgH + 40}
          viewBox={`-20 -20 ${layout.sheetWidth + 40} ${layout.sheetHeight + 40}`}
          className="border border-gray-300 rounded"
          style={{ maxHeight: '65vh', width: 'auto' }}
        >
          <defs>
            <pattern id={`reportWaste-${layout.id}`} patternUnits="userSpaceOnUse" width="6" height="6">
              <path d="M0 6L6 0" stroke="#999" strokeWidth="0.3" opacity="0.15" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="#f5f5f0" stroke="#333" strokeWidth={2} rx={2} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill={`url(#reportWaste-${layout.id})`} rx={2} />

          {layout.pieces.map((piece, idx) => (
            <g key={`${piece.pieceId}-${piece.x}-${piece.y}`}>
              <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height}
                fill={PRINT_PIECE_COLORS[idx % PRINT_PIECE_COLORS.length]} stroke="#444" strokeWidth={1} rx={1} />

              {piece.bordaSup && <line x1={piece.x} y1={piece.y} x2={piece.x + piece.width} y2={piece.y} stroke="#D97706" strokeWidth={3} />}
              {piece.bordaInf && <line x1={piece.x} y1={piece.y + piece.height} x2={piece.x + piece.width} y2={piece.y + piece.height} stroke="#D97706" strokeWidth={3} />}
              {piece.bordaEsq && <line x1={piece.x} y1={piece.y} x2={piece.x} y2={piece.y + piece.height} stroke="#D97706" strokeWidth={3} />}
              {piece.bordaDir && <line x1={piece.x + piece.width} y1={piece.y} x2={piece.x + piece.width} y2={piece.y + piece.height} stroke="#D97706" strokeWidth={3} />}

              {piece.furos?.map((h, i) => (
                <circle key={i} cx={piece.x + h.X} cy={piece.y + h.Y}
                  r={Math.max(h.DIAM / 2, 2)}
                  fill={h.DIAM >= 15 ? "#D97706" : h.DIAM >= 5 ? "#3B82F6" : "#EF4444"}
                  opacity={0.7} />
              ))}

              {piece.width > 50 && piece.height > 25 && (
                <>
                  <text x={piece.x + piece.width / 2} y={piece.y + piece.height / 2 - 6}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(piece.width / 5, piece.height / 4, 28)}
                    fontWeight={700} fill="#1a1a1a" fontFamily="Inter">
                    {piece.label}
                  </text>
                  <text x={piece.x + piece.width / 2} y={piece.y + piece.height / 2 + 10}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(piece.width / 8, piece.height / 5, 11)}
                    fill="#666" fontFamily="JetBrains Mono">
                    {piece.width}×{piece.height}
                  </text>
                </>
              )}
            </g>
          ))}

          <text x={layout.sheetWidth / 2} y={-8} textAnchor="middle"
            fontSize={11} fill="#666" fontFamily="JetBrains Mono">{layout.sheetWidth}</text>
          <text x={-8} y={layout.sheetHeight / 2} textAnchor="middle" dominantBaseline="central"
            fontSize={11} fill="#666" fontFamily="JetBrains Mono"
            transform={`rotate(-90, -8, ${layout.sheetHeight / 2})`}>{layout.sheetHeight}</text>
        </svg>
      </div>

      {/* Compact pieces list — max 25% */}
      <div className="border-t border-gray-300 px-4 py-1" style={{ maxHeight: '25vh', overflow: 'hidden' }}>
        <table className="w-full text-[8px]">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="text-left px-1 py-0.5 font-medium">#</th>
              <th className="text-left px-1 py-0.5 font-medium">Descrição</th>
              <th className="text-right px-1 py-0.5 font-medium">C</th>
              <th className="text-right px-1 py-0.5 font-medium">L</th>
              <th className="text-center px-1 py-0.5 font-medium">Fitas</th>
              <th className="text-center px-1 py-0.5 font-medium">Furos</th>
              <th className="text-left px-1 py-0.5 font-medium">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {layout.pieces.map((p, idx) => (
              <tr key={`${p.pieceId}-${p.x}`} className="border-t border-gray-200">
                <td className="px-1 py-0.5 font-bold" style={{ color: PRINT_PIECE_COLORS[idx % PRINT_PIECE_COLORS.length] }}>{p.label}</td>
                <td className="px-1 py-0.5 font-medium truncate max-w-[180px]">{p.descricao}</td>
                <td className="px-1 py-0.5 text-right font-mono">{p.width}</td>
                <td className="px-1 py-0.5 text-right font-mono">{p.height}</td>
                <td className="px-1 py-0.5 text-center text-[7px]">
                  {[p.bordaSup && "S", p.bordaInf && "I", p.bordaEsq && "E", p.bordaDir && "D"].filter(Boolean).join("") || "—"}
                </td>
                <td className="px-1 py-0.5 text-center font-mono">{p.furos?.length || 0}</td>
                <td className="px-1 py-0.5 text-gray-500 truncate max-w-[100px]">{p.cliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between text-[8px] text-gray-500 mt-0.5">
          <span>{layout.pieces.length} peças</span>
          <span>Útil: {(usedArea / 1000000).toFixed(3)}m² · Sobra: {(wasteArea / 1000000).toFixed(3)}m²</span>
        </div>
      </div>
    </div>
  );
}
