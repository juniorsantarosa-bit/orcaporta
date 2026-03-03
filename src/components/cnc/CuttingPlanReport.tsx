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
  const totalArea = layout.sheetWidth * layout.sheetHeight;
  const usedArea = layout.pieces.reduce((a, p) => a + p.width * p.height, 0);
  const wasteArea = totalArea - usedArea;

  return (
    <div
      className="w-full mx-auto print-report"
      style={{ pageBreakAfter: "always", background: "#fff", color: "#000" }}
    >
      {/* ── Header ≈ 8% ── */}
      <div style={{ height: '8%' }} className="flex items-center justify-between border-b border-gray-300 px-4 py-1">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" style={{ color: '#059669' }} />
          <span className="text-sm font-extrabold tracking-tight" style={{ color: '#000' }}>
            MAX<span style={{ color: '#059669' }}>CUT</span>
          </span>
        </div>
        <div className="flex items-center gap-6 text-[10px]" style={{ color: '#444' }}>
          <div>
            <span style={{ color: '#888' }}>Material: </span>
            <span className="font-semibold">{layout.material}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Chapa: </span>
            <span className="font-mono font-semibold">{layout.sheetWidth}×{layout.sheetHeight}×{layout.espessura}mm</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Aproveit.: </span>
            <span className="font-bold" style={{ color: layout.efficiency > 80 ? '#059669' : layout.efficiency > 60 ? '#D97706' : '#DC2626' }}>
              {layout.efficiency.toFixed(1)}%
            </span>
          </div>
          <div className="font-semibold">Chapa {layout.id}</div>
        </div>
      </div>

      {/* ── Nesting diagram ≈ 70% ── */}
      <div className="flex justify-center items-center px-2" style={{ height: '70%', minHeight: '70vh' }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`-20 -20 ${layout.sheetWidth + 40} ${layout.sheetHeight + 40}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ maxWidth: '100%', maxHeight: '100%', border: '1px solid #ccc', borderRadius: 4 }}
        >
          <defs>
            <pattern id={`reportWaste-${layout.id}`} patternUnits="userSpaceOnUse" width="6" height="6">
              <path d="M0 6L6 0" stroke="#999" strokeWidth="0.3" opacity="0.15" />
            </pattern>
          </defs>

          {/* Sheet background */}
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill="#f5f5f0" stroke="#333" strokeWidth={2} rx={2} />
          <rect x={0} y={0} width={layout.sheetWidth} height={layout.sheetHeight}
            fill={`url(#reportWaste-${layout.id})`} rx={2} />

          {/* Pieces */}
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
                    fill="#555" fontFamily="JetBrains Mono, monospace">
                    {piece.width}×{piece.height}
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Dimension labels */}
          <text x={layout.sheetWidth / 2} y={-8} textAnchor="middle"
            fontSize={11} fill="#555" fontFamily="JetBrains Mono, monospace">{layout.sheetWidth}</text>
          <text x={-8} y={layout.sheetHeight / 2} textAnchor="middle" dominantBaseline="central"
            fontSize={11} fill="#555" fontFamily="JetBrains Mono, monospace"
            transform={`rotate(-90, -8, ${layout.sheetHeight / 2})`}>{layout.sheetHeight}</text>
        </svg>
      </div>

      {/* ── Compact pieces list ≈ 22% ── */}
      <div className="border-t border-gray-300 px-4 py-1" style={{ height: '22%', overflow: 'hidden' }}>
        <table className="w-full text-[9px]" style={{ color: '#000' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', color: '#555' }}>
              <th className="text-left px-1 py-0.5 font-semibold">#</th>
              <th className="text-left px-1 py-0.5 font-semibold">Descrição</th>
              <th className="text-right px-1 py-0.5 font-semibold">C</th>
              <th className="text-right px-1 py-0.5 font-semibold">L</th>
              <th className="text-center px-1 py-0.5 font-semibold">Fitas</th>
              <th className="text-center px-1 py-0.5 font-semibold">Furos</th>
              <th className="text-left px-1 py-0.5 font-semibold">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {layout.pieces.map((p, idx) => (
              <tr key={`${p.pieceId}-${p.x}`} style={{ borderTop: '1px solid #ddd' }}>
                <td className="px-1 py-0.5 font-bold" style={{ color: PRINT_PIECE_COLORS[idx % PRINT_PIECE_COLORS.length] }}>{p.label}</td>
                <td className="px-1 py-0.5 font-medium truncate max-w-[180px]">{p.descricao}</td>
                <td className="px-1 py-0.5 text-right font-mono">{p.width}</td>
                <td className="px-1 py-0.5 text-right font-mono">{p.height}</td>
                <td className="px-1 py-0.5 text-center text-[8px]">
                  {[p.bordaSup && "S", p.bordaInf && "I", p.bordaEsq && "E", p.bordaDir && "D"].filter(Boolean).join("") || "—"}
                </td>
                <td className="px-1 py-0.5 text-center font-mono">{p.furos?.length || 0}</td>
                <td className="px-1 py-0.5 truncate max-w-[100px]" style={{ color: '#777' }}>{p.cliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between text-[8px] mt-0.5" style={{ color: '#888' }}>
          <span>{layout.pieces.length} peças</span>
          <span>Útil: {(usedArea / 1000000).toFixed(3)}m² · Sobra: {(wasteArea / 1000000).toFixed(3)}m²</span>
        </div>
      </div>
    </div>
  );
}
