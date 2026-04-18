/**
 * Serra (guillotine) optimizer.
 * Stacks pieces in horizontal strips, suitable for panel saws (squadrejadeira).
 * Counts horizontal (transversal) and vertical (longitudinal) cuts per sheet.
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
  width: number;
  height: number;
  rotated: boolean;
  index: number;
}

function expandPieces(pieces: CuttingPiece[]): ExpandedPiece[] {
  const out: ExpandedPiece[] = [];
  let idx = 0;
  for (const p of pieces) {
    for (let i = 0; i < p.quantidade; i++) {
      out.push({ piece: p, width: p.largura, height: p.altura, rotated: false, index: idx++ });
    }
  }
  // Sort by height desc, then width desc — classic guillotine heuristic
  out.sort((a, b) => (b.height - a.height) || (b.width - a.width));
  return out;
}

/** Try to fit one sheet using horizontal strips. Returns placed + remaining. */
function packSheet(
  remaining: ExpandedPiece[],
  opts: SerraOptions,
): { placed: PlacedNestingPiece[]; leftover: ExpandedPiece[] } {
  const usableW = opts.sheetWidth - opts.refiloX * 2;
  const usableH = opts.sheetHeight - opts.refiloY * 2;
  const placed: PlacedNestingPiece[] = [];
  const leftover: ExpandedPiece[] = [];
  const used = new Set<number>();

  let cursorY = opts.refiloY;
  let labelN = 1;

  while (true) {
    // Find tallest unused piece that fits remaining height
    let stripHeight = 0;
    let stripPieces: ExpandedPiece[] = [];
    let stripWidthUsed = opts.refiloX;

    // Pick first unused fitting piece to seed the strip
    let seed: ExpandedPiece | null = null;
    for (const ep of remaining) {
      if (used.has(ep.index)) continue;
      const fitsNoRot = ep.width <= usableW && ep.height <= usableH - (cursorY - opts.refiloY);
      const fitsRot = opts.allowRotation && ep.height <= usableW && ep.width <= usableH - (cursorY - opts.refiloY);
      if (fitsNoRot || fitsRot) {
        seed = ep;
        if (!fitsNoRot && fitsRot) {
          seed = { ...ep, width: ep.height, height: ep.width, rotated: true };
        }
        break;
      }
    }
    if (!seed) break;

    stripHeight = seed.height;
    used.add(seed.index);
    stripPieces.push({ ...seed, width: seed.width, height: seed.height });
    stripWidthUsed += seed.width + opts.gap;

    // Fill strip with pieces that fit in this strip height
    for (const ep of remaining) {
      if (used.has(ep.index)) continue;
      let w = ep.width, h = ep.height, rot = false;
      const fitsHeight = h <= stripHeight;
      const fitsHeightRot = opts.allowRotation && w <= stripHeight;
      if (!fitsHeight && !fitsHeightRot) continue;
      if (!fitsHeight && fitsHeightRot) {
        w = ep.height; h = ep.width; rot = true;
      }
      if (stripWidthUsed + w > opts.refiloX + usableW) continue;
      used.add(ep.index);
      stripPieces.push({ ...ep, width: w, height: h, rotated: rot });
      stripWidthUsed += w + opts.gap;
    }

    // Place strip pieces
    let cx = opts.refiloX;
    for (const sp of stripPieces) {
      placed.push({
        pieceId: sp.piece.id,
        label: String(labelN++),
        x: cx,
        y: cursorY,
        width: sp.width,
        height: sp.height,
        rotated: sp.rotated,
        descricao: sp.piece.descricao,
        furos: sp.piece.furos || [],
        usinagens: sp.piece.usinagens || [],
        bordaSup: sp.piece.bordaSup,
        bordaInf: sp.piece.bordaInf,
        bordaEsq: sp.piece.bordaEsq,
        bordaDir: sp.piece.bordaDir,
        cliente: sp.piece.cliente,
        ambiente: "",
        moduloDesc: "",
        espessura: sp.piece.espessura,
        noContour: sp.piece.noContour,
      });
      cx += sp.width + opts.gap;
    }

    cursorY += stripHeight + opts.gap;
    if (cursorY >= opts.refiloY + usableH) break;
  }

  for (const ep of remaining) {
    if (!used.has(ep.index)) leftover.push(ep);
  }

  return { placed, leftover };
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

  let remaining = expandPieces(pieces);
  const sheets: NestingSheet[] = [];
  let safety = 0;

  while (remaining.length > 0 && safety++ < 100) {
    const { placed, leftover } = packSheet(remaining, opts);
    if (placed.length === 0) break;
    const totalArea = opts.sheetWidth * opts.sheetHeight;
    const usedArea = placed.reduce((a, p) => a + p.width * p.height, 0);
    sheets.push({
      id: sheets.length + 1,
      codCorte: sheets.length + 1,
      sheetWidth: opts.sheetWidth,
      sheetHeight: opts.sheetHeight,
      material: opts.material,
      espessura: opts.espessura,
      pieces: placed,
      efficiency: (usedArea / totalArea) * 100,
    });
    remaining = leftover;
  }

  return sheets;
}

/** Count guillotine cuts (transversal strips + longitudinal divisions per strip). */
export function countSerraCuts(sheet: NestingSheet): number {
  if (sheet.pieces.length === 0) return 0;
  // Group pieces by Y row
  const rows = new Map<number, number>();
  for (const p of sheet.pieces) {
    rows.set(p.y, (rows.get(p.y) || 0) + 1);
  }
  let cuts = rows.size; // one transversal cut per strip
  for (const n of rows.values()) cuts += Math.max(0, n - 1); // longitudinal cuts inside strip
  return cuts;
}

export function countTotalSerraCuts(sheets: NestingSheet[]): number {
  return sheets.reduce((a, s) => a + countSerraCuts(s), 0);
}
