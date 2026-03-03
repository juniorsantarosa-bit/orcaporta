import { NestingSheet, PlacedNestingPiece } from "@/types/promob";

interface LabelPreviewProps {
  layout: NestingSheet;
}

function PieceLabel({ piece, sheetId, material, chapaDims }: {
  piece: PlacedNestingPiece;
  sheetId: number;
  material: string;
  chapaDims: string;
}) {
  const dims = `${piece.width} x ${piece.height} x ${piece.espessura}`;
  const edges = [
    piece.bordaSup && "S",
    piece.bordaInf && "I",
    piece.bordaEsq && "E",
    piece.bordaDir && "D",
  ].filter(Boolean);
  const edgeStr = edges.length > 0 ? edges.join("+") : "—";
  const holesCount = piece.furos?.length || 0;

  return (
    <div className="w-[320px] h-[200px] border border-border rounded-lg bg-card p-3 flex flex-col justify-between shadow-sm print:shadow-none print:border-black">
      {/* Top section */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[9px] text-muted-foreground">Dimen:</div>
          <div className="text-xs font-bold font-mono">{dims}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Chapa:</div>
          <div className="text-[10px] font-semibold">{material}</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] text-muted-foreground">Pç: {piece.label}</div>
          <div className="text-[8px] text-muted-foreground">Ch: {sheetId}</div>
        </div>
      </div>

      {/* Middle - piece drawing */}
      <div className="flex items-center justify-center py-2">
        <div className="relative">
          <svg width={80} height={50} viewBox={`0 0 ${piece.width} ${piece.height}`} className="border border-dashed border-muted-foreground/30">
            <rect x={0} y={0} width={piece.width} height={piece.height}
              fill="none" stroke="hsl(var(--foreground))" strokeWidth={piece.width * 0.02} />
            {/* Edge bands */}
            {piece.bordaSup && <line x1={0} y1={0} x2={piece.width} y2={0} stroke="hsl(var(--warning))" strokeWidth={piece.width * 0.04} />}
            {piece.bordaInf && <line x1={0} y1={piece.height} x2={piece.width} y2={piece.height} stroke="hsl(var(--warning))" strokeWidth={piece.width * 0.04} />}
            {piece.bordaEsq && <line x1={0} y1={0} x2={0} y2={piece.height} stroke="hsl(var(--warning))" strokeWidth={piece.width * 0.04} />}
            {piece.bordaDir && <line x1={piece.width} y1={0} x2={piece.width} y2={piece.height} stroke="hsl(var(--warning))" strokeWidth={piece.width * 0.04} />}
            {/* Holes */}
            {piece.furos?.map((h, i) => (
              <circle key={i} cx={h.X} cy={h.Y} r={Math.max(h.DIAM * 2, 8)}
                fill={h.DIAM >= 15 ? "hsl(var(--warning))" : "hsl(var(--primary))"} opacity={0.6} />
            ))}
          </svg>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] font-mono text-muted-foreground">
            {piece.width}
          </div>
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 text-[7px] font-mono text-muted-foreground rotate-90">
            {piece.height}
          </div>
        </div>
        <div className="ml-6 text-[8px] text-muted-foreground leading-tight">
          {edges.length > 0 && <div>Fitas: {edgeStr}</div>}
          {holesCount > 0 && <div>Furos: {holesCount}</div>}
        </div>
      </div>

      {/* Bottom section */}
      <div className="border-t border-border pt-1.5 flex justify-between text-[9px]">
        <div>
          <span className="text-muted-foreground">Cliente: </span>
          <span className="font-semibold">{piece.cliente}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Módulo: </span>
          <span className="font-medium">{piece.moduloDesc}</span>
        </div>
      </div>
      <div className="flex justify-between text-[9px]">
        <div>
          <span className="text-muted-foreground">Peça: </span>
          <span className="font-semibold">{piece.descricao}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ID: </span>
          <span className="font-mono">{piece.pieceId}</span>
        </div>
      </div>
    </div>
  );
}

export function LabelPreview({ layout }: LabelPreviewProps) {
  const chapaDims = `${layout.sheetWidth}x${layout.sheetHeight}x${layout.espessura}`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">Etiquetas — Chapa {layout.id}</h3>
        <p className="text-[10px] text-muted-foreground">{layout.material} · {chapaDims} · {layout.pieces.length} peças</p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center print:gap-1">
        {layout.pieces.map((piece) => (
          <PieceLabel
            key={`${piece.pieceId}-${piece.x}`}
            piece={piece}
            sheetId={layout.id}
            material={layout.material}
            chapaDims={chapaDims}
          />
        ))}
      </div>
    </div>
  );
}
