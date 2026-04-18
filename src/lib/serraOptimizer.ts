/**
 * Serra (guillotine) optimizer.
 * Uses Best-Fit Decreasing Height (BFDH) — strips chosen by best fit, with rotation.
 * Significantly better packing than naive NFDH for panel saws.
 */
import { CuttingPiece } from "@/types/cutting";
import { NestingSheet, PlacedNestingPiece } from "@/types/promob";

export interface SerraOptions {
  sheetWidth: number;
  sheetHeight: number;
  espessura: number;
  material: string;
  gap: number;
  refiloX: number;
  refiloY: number;
  allowRotation: boolean;
}

interface ExpandedPiece {
  piece: CuttingPiece;
  w: number;
  h: number;
  rotated: boolean;
  index: number;
  placed: boolean;
}

interface Strip {
  y: number;
  height: number;
  usedWidth: number; // includes refiloX offset
  pieces: { ep: ExpandedPiece; x: number; w: number; h: number; rotated: boolean }[];
}

function expandPieces(pieces: CuttingPiece[]): ExpandedPiece[] {
  const out: ExpandedPiece[] = [];
  let idx = 0;
  for (const p of pieces) {
    for (let i = 0; i < p.quantidade; i++) {
      // Normalize so longer side is height (helps BFDH)
      const w = p.largura;
      const h = p.altura;
      out.push({ piece: p, w, h, rotated: false, index: idx++, placed: false });
    }
  }
  return out;
}

/**
 * Pack a single sheet using Best-Fit Decreasing Height.
 * Returns indices of placed pieces and the placement list.
 */
function packSheet(
  pool: ExpandedPiece[],
  opts: SerraOptions,
): PlacedNestingPiece[] {
  const usableW = opts.sheetWidth - opts.refiloX * 2;
  const usableH = opts.sheetHeight - opts.refiloY * 2;
  const placed: PlacedNestingPiece[] = [];
  const strips: Strip[] = [];

  // Helper: orient a piece so it fits a given strip height (or returns null)
  const orientForStrip = (ep: ExpandedPiece, stripH: number): { w: number; h: number; rotated: boolean } | null => {
    if (ep.h <= stripH) return { w: ep.w, h: ep.h, rotated: false };
    if (opts.allowRotation && ep.w <= stripH) return { w: ep.h, h: ep.w, rotated: true };
    return null;
  };

  // Sort pieces by max(w,h) desc — biggest first
  const sortable = pool
    .filter(p => !p.placed)
    .slice()
    .sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || (b.w * b.h) - (a.w * a.h));

  let labelN = 1;
  let totalUsedHeight = 0; // refiloY consumed by strips so far

  for (const ep of sortable) {
    if (ep.placed) continue;

    // Try to fit in existing strips (best fit by remaining width)
    let bestStrip: Strip | null = null;
    let bestOrient: { w: number; h: number; rotated: boolean } | null = null;
    let bestRemaining = Infinity;

    for (const s of strips) {
      const orient = orientForStrip(ep, s.height);
      if (!orient) continue;
      const remainingW = (opts.refiloX + usableW) - s.usedWidth;
      const needed = orient.w + (s.pieces.length > 0 ? opts.gap : 0);
      if (needed > remainingW) continue;
      const leftover = remainingW - needed;
      if (leftover < bestRemaining) {
        bestRemaining = leftover;
        bestStrip = s;
        bestOrient = orient;
      }
    }

    if (bestStrip && bestOrient) {
      const x = bestStrip.usedWidth + (bestStrip.pieces.length > 0 ? opts.gap : 0);
      bestStrip.pieces.push({ ep, x, w: bestOrient.w, h: bestOrient.h, rotated: bestOrient.rotated });
      bestStrip.usedWidth = x + bestOrient.w;
      ep.placed = true;
      continue;
    }

    // Create a new strip if there's vertical room
    // Try original orientation first
    let candidates: { w: number; h: number; rotated: boolean }[] = [{ w: ep.w, h: ep.h, rotated: false }];
    if (opts.allowRotation) candidates.push({ w: ep.h, h: ep.w, rotated: true });
    // Choose the orientation that fits and minimizes height (less wasted strip height)
    candidates = candidates.filter(c => c.w <= usableW && totalUsedHeight + c.h <= usableH);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.h - b.h);
    const orient = candidates[0];

    const newStrip: Strip = {
      y: opts.refiloY + totalUsedHeight,
      height: orient.h,
      usedWidth: opts.refiloX + orient.w,
      pieces: [{ ep, x: opts.refiloX, w: orient.w, h: orient.h, rotated: orient.rotated }],
    };
    strips.push(newStrip);
    totalUsedHeight += orient.h + opts.gap;
    ep.placed = true;
  }

  // Emit placements
  for (const s of strips) {
    for (const item of s.pieces) {
      placed.push({
        pieceId: item.ep.piece.id,
        label: String(labelN++),
        x: item.x,
        y: s.y,
        width: item.w,
        height: item.h,
        rotated: item.rotated,
        descricao: item.ep.piece.descricao,
        furos: item.ep.piece.furos || [],
        usinagens: item.ep.piece.usinagens || [],
        bordaSup: item.ep.piece.bordaSup,
        bordaInf: item.ep.piece.bordaInf,
        bordaEsq: item.ep.piece.bordaEsq,
        bordaDir: item.ep.piece.bordaDir,
        cliente: item.ep.piece.cliente,
        ambiente: "",
        moduloDesc: "",
        espessura: item.ep.piece.espessura,
        noContour: item.ep.piece.noContour,
      });
    }
  }
  return placed;
}

export function optimizeSerra(
  pieces: CuttingPiece[],
  options: Partial<SerraOptions> = {},
): NestingSheet[] {
  const opts: SerraOptions = {
    sheetWidth: 1840,
    sheetHeight: 2750,
    espessura: pieces[0]?.espessura || 15,
    material: pieces[0]?.material || "Material",
    gap: 4,
    refiloX: 8,
    refiloY: 8,
    allowRotation: true,
    ...options,
  };

  // Group by material+espessura so we don't mix
  const groups = new Map<string, CuttingPiece[]>();
  for (const p of pieces) {
    const key = `${p.material}__${p.espessura}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const sheets: NestingSheet[] = [];
  for (const [, groupPieces] of groups) {
    const pool = expandPieces(groupPieces);
    let safety = 0;
    while (pool.some(p => !p.placed) && safety++ < 200) {
      const placed = packSheet(pool, {
        ...opts,
        material: groupPieces[0].material,
        espessura: groupPieces[0].espessura,
      });
      if (placed.length === 0) break;
      const totalArea = opts.sheetWidth * opts.sheetHeight;
      const usedArea = placed.reduce((a, p) => a + p.width * p.height, 0);
      sheets.push({
        id: sheets.length + 1,
        codCorte: sheets.length + 1,
        sheetWidth: opts.sheetWidth,
        sheetHeight: opts.sheetHeight,
        material: groupPieces[0].material,
        espessura: groupPieces[0].espessura,
        pieces: placed,
        efficiency: (usedArea / totalArea) * 100,
      });
    }
  }

  return sheets;
}

/** Count guillotine cuts (transversal strips + longitudinal divisions per strip). */
export function countSerraCuts(sheet: NestingSheet): number {
  if (sheet.pieces.length === 0) return 0;
  const rows = new Map<number, number>();
  for (const p of sheet.pieces) {
    rows.set(p.y, (rows.get(p.y) || 0) + 1);
  }
  let cuts = rows.size;
  for (const n of rows.values()) cuts += Math.max(0, n - 1);
  return cuts;
}

export function countTotalSerraCuts(sheets: NestingSheet[]): number {
  return sheets.reduce((a, s) => a + countSerraCuts(s), 0);
}
