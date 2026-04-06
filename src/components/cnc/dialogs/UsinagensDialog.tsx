import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { PlacedNestingPiece, Usinagem, PromobHole } from "@/types/promob";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pieces: PlacedNestingPiece[];
}

function getPiecesWithMachining(pieces: PlacedNestingPiece[]) {
  return pieces.filter(p => {
    const hasFuros = p.furos && p.furos.length > 0;
    const hasUsinagens = p.usinagens && p.usinagens.length > 0;
    return hasFuros || hasUsinagens;
  });
}

function summarizeMachining(piece: PlacedNestingPiece) {
  const furos = piece.furos?.length || 0;
  const canais = piece.usinagens?.filter(u => u.tipo === "canal").length || 0;
  const recortesCirc = piece.usinagens?.filter(u => u.tipo === "recorte_circular").length || 0;
  const recortesRect = piece.usinagens?.filter(u => u.tipo === "recorte_retangular").length || 0;
  const rebaixos = piece.usinagens?.filter(u => u.tipo === "rebaixo").length || 0;
  const contornos = piece.usinagens?.filter(u => u.tipo === "contorno").length || 0;
  const items: string[] = [];
  if (furos > 0) items.push(`${furos} furo${furos > 1 ? "s" : ""}`);
  if (canais > 0) items.push(`${canais} canal${canais > 1 ? "is" : ""}`);
  if (recortesCirc > 0) items.push(`${recortesCirc} recorte circ.`);
  if (recortesRect > 0) items.push(`${recortesRect} recorte ret.`);
  if (rebaixos > 0) items.push(`${rebaixos} rebaixo${rebaixos > 1 ? "s" : ""}`);
  if (contornos > 0) items.push(`${contornos} contorno${contornos > 1 ? "s" : ""}`);
  return items.join(", ");
}

function tipoLabel(tipo: Usinagem["tipo"]) {
  switch (tipo) {
    case "canal": return "Canal";
    case "recorte_circular": return "Recorte Circular";
    case "recorte_retangular": return "Recorte Retangular";
    case "rebaixo": return "Rebaixo";
    case "contorno": return "Contorno";
    default: return tipo;
  }
}

function tipoBadgeVariant(tipo: Usinagem["tipo"]): "default" | "secondary" | "destructive" | "outline" {
  switch (tipo) {
    case "canal": return "default";
    case "recorte_circular": return "secondary";
    case "recorte_retangular": return "outline";
    case "rebaixo": return "destructive";
    default: return "secondary";
  }
}

/** Mini SVG preview of a single piece showing only machining ops */
function PieceMiniPreview({ piece, size = 120 }: { piece: PlacedNestingPiece; size?: number }) {
  const pw = piece.width;
  const ph = piece.height;
  const aspect = pw / ph;
  const svgW = aspect >= 1 ? size : size * aspect;
  const svgH = aspect >= 1 ? size / aspect : size;
  const margin = 8;

  return (
    <svg width={svgW + margin * 2} height={svgH + margin * 2} viewBox={`${-margin} ${-margin} ${pw + margin * 2} ${ph + margin * 2}`}>
      <rect x={0} y={0} width={pw} height={ph} fill="hsl(40 30% 90%)" stroke="hsl(var(--border))" strokeWidth={2} rx={2} />

      {/* Furos */}
      {piece.furos?.map((hole, i) => (
        <circle key={`h-${i}`} cx={hole.X} cy={hole.Y} r={Math.max(hole.DIAM / 2, 2)}
          fill={hole.DIAM >= 15 ? "hsl(40 90% 50%)" : hole.DIAM >= 5 ? "hsl(217 91% 45%)" : "hsl(0 70% 50%)"}
          opacity={0.8} />
      ))}

      {/* Usinagens */}
      {piece.usinagens?.map((u, i) => {
        if (u.tipo === "recorte_circular") {
          return <circle key={`u-${i}`} cx={u.x} cy={u.y} r={u.largura / 2}
            fill="none" stroke="hsl(120 60% 40%)" strokeWidth={2} strokeDasharray="4,2" />;
        }
        if (u.tipo === "canal") {
          const gw = u.comprimento || u.largura;
          const gh = u.largura || 12;
          return <rect key={`u-${i}`} x={u.x} y={u.y - gh / 2} width={gw} height={gh}
            fill="hsl(200 70% 50% / 0.25)" stroke="hsl(200 70% 50%)" strokeWidth={1.5} strokeDasharray="3,2" rx={1} />;
        }
        if (u.tipo === "recorte_retangular") {
          const rw = u.comprimento || u.largura;
          const rh = u.largura;
          return <rect key={`u-${i}`} x={u.x} y={u.y - rh / 2} width={rw} height={rh}
            fill="hsl(30 80% 50% / 0.2)" stroke="hsl(30 80% 50%)" strokeWidth={1.5} strokeDasharray="5,3" rx={1} />;
        }
        // rebaixo / contorno
        const w = u.comprimento || u.largura;
        const h = u.largura;
        return <rect key={`u-${i}`} x={u.x} y={u.y - h / 2} width={w} height={h}
          fill="hsl(280 60% 50% / 0.2)" stroke="hsl(280 60% 50%)" strokeWidth={1.5} strokeDasharray="4,2" rx={1} />;
      })}
    </svg>
  );
}

/** Detailed view of a single piece */
function PieceDetail({ piece }: { piece: PlacedNestingPiece }) {
  // Group furos by diameter
  const furosByDiam = new Map<number, PromobHole[]>();
  piece.furos?.forEach(h => {
    const key = h.DIAM;
    if (!furosByDiam.has(key)) furosByDiam.set(key, []);
    furosByDiam.get(key)!.push(h);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-start">
        <PieceMiniPreview piece={piece} size={200} />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">{piece.label} — {piece.descricao}</p>
          <p className="text-muted-foreground font-mono">{piece.width} × {piece.height} × {piece.espessura}mm</p>
          <p className="text-muted-foreground">{piece.cliente} / {piece.ambiente}</p>
        </div>
      </div>

      {/* Furos table */}
      {furosByDiam.size > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-foreground">Furos</h4>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-4 gap-y-1 text-xs font-mono">
            <span className="font-semibold text-muted-foreground">Ø</span>
            <span className="font-semibold text-muted-foreground">Qtd</span>
            <span className="font-semibold text-muted-foreground">Prof.</span>
            <span className="font-semibold text-muted-foreground">Face</span>
            {[...furosByDiam.entries()].map(([diam, holes]) => (
              <div key={diam} className="contents">
                <span>{diam}mm</span>
                <span>{holes.length}</span>
                <span>{holes[0].Z}mm</span>
                <span>{holes[0].FACE}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usinagens list */}
      {piece.usinagens && piece.usinagens.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-foreground">Usinagens</h4>
          <div className="space-y-2">
            {piece.usinagens.map((u, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-muted/50 rounded px-3 py-2">
                <Badge variant={tipoBadgeVariant(u.tipo)} className="text-[10px]">{tipoLabel(u.tipo)}</Badge>
                <span className="font-mono text-muted-foreground">
                  {u.tipo === "recorte_circular"
                    ? `Ø${u.largura}mm`
                    : `${u.comprimento || u.largura} × ${u.largura}mm`
                  }
                </span>
                {(() => {
                  const maxProf = piece.espessura + 0.1;
                  const rawProf = u.profundidade;
                  const clamped = Math.min(rawProf, maxProf);
                  const exceeded = rawProf > maxProf;
                  return (
                    <span className={`font-mono ${exceeded ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      Prof: {clamped.toFixed(1)}mm
                      {exceeded && ` (orig: ${rawProf}mm ⚠)`}
                    </span>
                  );
                })()}
                <span className="text-muted-foreground">Face: {u.face}</span>
                {u.passante && <Badge variant="destructive" className="text-[9px]">Passante</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function UsinagensDialog({ open, onOpenChange, pieces }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const piecesWithMachining = getPiecesWithMachining(pieces);
  const selectedPiece = selectedIdx !== null ? piecesWithMachining[selectedIdx] : null;

  const handleClose = (v: boolean) => {
    if (!v) setSelectedIdx(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedPiece && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedIdx(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selectedPiece ? `Usinagens — ${selectedPiece.label}` : "Usinagens por Peça"}
          </DialogTitle>
          <DialogDescription>
            {selectedPiece
              ? "Detalhes de todas as operações de usinagem desta peça (exceto cortes de contorno)."
              : `${piecesWithMachining.length} peça${piecesWithMachining.length !== 1 ? "s" : ""} com usinagem nesta chapa.`
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {selectedPiece ? (
            <PieceDetail piece={selectedPiece} />
          ) : (
            <div className="space-y-1">
              {piecesWithMachining.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma peça possui usinagens nesta chapa.</p>
              ) : (
                piecesWithMachining.map((piece, idx) => (
                  <button
                    key={`${piece.pieceId}-${idx}`}
                    onClick={() => setSelectedIdx(idx)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <PieceMiniPreview piece={piece} size={60} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{piece.label} — {piece.descricao}</p>
                      <p className="text-xs text-muted-foreground font-mono">{piece.width} × {piece.height}mm</p>
                      <p className="text-xs text-muted-foreground">{summarizeMachining(piece)}</p>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
