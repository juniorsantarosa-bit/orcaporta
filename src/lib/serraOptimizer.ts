/**
 * Serra (guillotine) optimizer.
 *
 * All cuts go from one edge of the panel to the other (full-width or full-height),
 * matching how a panel/table saw works. Uses recursive guillotine partitioning,
 * trying both horizontal-first and vertical-first splits at each step and picking
 * whichever places more pieces. This is significantly more efficient than BFDH
 * because remainder regions are themselves recursively packed.
 */
import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";

export interface SerraOptions {
  sheetWidth: number;
  sheetHeight: number;
  espessura: number;
  material: string;
  gap: number; // kerf / blade thickness
  refiloX: number;
  refiloY: number;
  allowRotation: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ExpandedPiece {
  piece: CuttingPiece;
  width: number;
  height: number;
  index: number;
}

interface PlacedResult {
  ep: ExpandedPiece;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

let globalLabel = 1;

/**
 * Recursive guillotine packer: places one best-fit piece in `rect`, then splits
 * the remainder into two sub-rectangles. Tries horizontal-first and vertical-first
 * splits and returns the variant that places the most pieces.
 */
function guillotinePack(
  remaining: ExpandedPiece[],
  rect: Rect,
  gap: number,
  allowRotation: boolean,
): PlacedResult[] {
  if (remaining.length === 0 || rect.w < 10 || rect.h < 10) return [];

  // Pick the piece that fits and leaves the least area waste in this rect.
  let bestIdx = -1;
  let bestRotated = false;
  let bestWaste = Infinity;

  for (let i = 0; i < remaining.length; i++) {
    const ep = remaining[i];
    if (ep.width <= rect.w && ep.height <= rect.h) {
      const waste = rect.w * rect.h - ep.width * ep.height;
      if (waste < bestWaste) {
        bestWaste = waste;
        bestIdx = i;
        bestRotated = false;
      }
    }
    if (allowRotation && ep.width !== ep.height) {
      if (ep.height <= rect.w && ep.width <= rect.h) {
        const waste = rect.w * rect.h - ep.width * ep.height;
        if (waste < bestWaste) {
          bestWaste = waste;
          bestIdx = i;
          bestRotated = true;
        }
      }
    }
  }

  if (bestIdx === -1) return [];

  const ep = remaining[bestIdx];
  const pw = bestRotated ? ep.height : ep.width;
  const ph = bestRotated ? ep.width : ep.height;

  const placed: PlacedResult = {
    ep,
    x: rect.x,
    y: rect.y,
    w: pw,
    h: ph,
    rotated: bestRotated,
  };

  const rest = [...remaining];
  rest.splice(bestIdx, 1);

  const results: PlacedResult[][] = [];

  // Horizontal-first split
  {
    const r1: Rect = { x: rect.x + pw + gap, y: rect.y, w: rect.w - pw - gap, h: ph };
    const r2: Rect = { x: rect.x, y: rect.y + ph + gap, w: rect.w, h: rect.h - ph - gap };
    const p1 = guillotinePack([...rest], r1, gap, allowRotation);
    const leftover1 = rest.filter(e => !p1.some(p => p.ep === e));
    const p2 = guillotinePack(leftover1, r2, gap, allowRotation);
    results.push([placed, ...p1, ...p2]);
  }

  // Vertical-first split
  {
    const r1: Rect = { x: rect.x, y: rect.y + ph + gap, w: pw, h: rect.h - ph - gap };
    const r2: Rect = { x: rect.x + pw + gap, y: rect.y, w: rect.w - pw - gap, h: rect.h };
    const p1 = guillotinePack([...rest], r1, gap, allowRotation);
    const leftover1 = rest.filter(e => !p1.some(p => p.ep === e));
    const p2 = guillotinePack(leftover1, r2, gap, allowRotation);
    results.push([placed, ...p1, ...p2]);
  }

  return results.reduce((best, curr) => (curr.length > best.length ? curr : best), results[0]);
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

  globalLabel = 1;

  // Group by material + thickness
  const byMaterial = new Map<string, CuttingPiece[]>();
  for (const piece of pieces) {
    const normalizedMaterial = piece.material.trim().toLowerCase();
    const key = `${normalizedMaterial}|${piece.espessura}`;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key)!.push(piece);
  }

  const allSheets: NestingSheet[] = [];
  let sheetIdCounter = 1;

  for (const [, matPieces] of byMaterial) {
    const material = matPieces[0].material;
    const espessura = matPieces[0].espessura;

    // Expand quantities
    const expanded: ExpandedPiece[] = [];
    let idx = 0;
    for (const piece of matPieces) {
      const qty = Math.max(1, Math.round(piece.quantidade || 1));
      for (let q = 0; q < qty; q++) {
        expanded.push({ piece, width: piece.largura, height: piece.altura, index: idx++ });
      }
    }

    // Sort by area desc — biggest pieces first
    let remaining = [...expanded].sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const usableW = opts.sheetWidth - opts.refiloX * 2;
    const usableH = opts.sheetHeight - opts.refiloY * 2;

    let safety = 0;
    while (remaining.length > 0 && safety++ < 200) {
      const rect: Rect = { x: 0, y: 0, w: usableW, h: usableH };
      const placed = guillotinePack(remaining, rect, opts.gap, opts.allowRotation);

      if (placed.length === 0) {
        console.warn(`[Serra] ${remaining.length} peças não cabem na chapa ${opts.sheetWidth}x${opts.sheetHeight}`);
        break;
      }

      const placedSet = new Set(placed.map(p => p.ep));
      remaining = remaining.filter(e => !placedSet.has(e));

      const totalArea = opts.sheetWidth * opts.sheetHeight;
      const usedArea = placed.reduce((a, p) => a + p.w * p.h, 0);

      allSheets.push({
        id: sheetIdCounter,
        codCorte: 7000 + sheetIdCounter,
        sheetWidth: opts.sheetWidth,
        sheetHeight: opts.sheetHeight,
        espessura,
        material,
        efficiency: (usedArea / totalArea) * 100,
        pieces: placed.map(p => ({
          pieceId: p.ep.piece.id,
          x: p.x + opts.refiloX,
          y: p.y + opts.refiloY,
          width: p.w,
          height: p.h,
          rotated: p.rotated,
          label: String(globalLabel++),
          descricao: p.ep.piece.descricao,
          furos: p.ep.piece.furos || [],
          usinagens: p.ep.piece.usinagens || [],
          bordaSup: p.ep.piece.bordaSup,
          bordaInf: p.ep.piece.bordaInf,
          bordaEsq: p.ep.piece.bordaEsq,
          bordaDir: p.ep.piece.bordaDir,
          cliente: p.ep.piece.cliente,
          ambiente: p.ep.piece.observacao || "",
          moduloDesc: p.ep.piece.projeto,
          espessura,
          noContour: p.ep.piece.noContour,
          isAspire: p.ep.piece.source === "aspire",
          aspireContour: p.ep.piece.aspireContour,
        })),
      });
      sheetIdCounter++;
    }
  }

  return allSheets;
}

/**
 * Count guillotine cuts on a sheet. Each cut goes edge-to-edge (full-width or
 * full-height). Cuts within `gap` distance of each other are merged. Adds refilo
 * (edge trim) cuts when pieces sit at sheet borders.
 */
export function countSerraCuts(sheet: NestingSheet): number {
  const pieces = sheet.pieces;
  if (pieces.length === 0) return 0;

  const hCuts = new Set<number>();
  const vCuts = new Set<number>();

  const refiloX = 8;
  const refiloY = 8;

  let hasTop = false, hasBottom = false, hasLeft = false, hasRight = false;

  for (const p of pieces) {
    const top = p.y + p.height;
    const right = p.x + p.width;

    if (p.y <= refiloY + 2) hasBottom = true;
    if (top >= sheet.sheetHeight - refiloY - 2) hasTop = true;
    if (p.x <= refiloX + 2) hasLeft = true;
    if (right >= sheet.sheetWidth - refiloX - 2) hasRight = true;

    if (p.y > refiloY + 1) hCuts.add(Math.round(p.y));
    if (top < sheet.sheetHeight - refiloY - 1) hCuts.add(Math.round(top));
    if (p.x > refiloX + 1) vCuts.add(Math.round(p.x));
    if (right < sheet.sheetWidth - refiloX - 1) vCuts.add(Math.round(right));
  }

  const gap = 6;
  const mergeSet = (s: Set<number>): number => {
    const sorted = [...s].sort((a, b) => a - b);
    let count = 0;
    let last = -Infinity;
    for (const v of sorted) {
      if (v - last > gap) {
        count++;
        last = v;
      }
    }
    return count;
  };

  let totalCuts = mergeSet(hCuts) + mergeSet(vCuts);
  if (hasTop) totalCuts++;
  if (hasBottom) totalCuts++;
  if (hasLeft) totalCuts++;
  if (hasRight) totalCuts++;
  return totalCuts;
}

export function countTotalSerraCuts(sheets: NestingSheet[]): number {
  return sheets.reduce((total, sheet) => total + countSerraCuts(sheet), 0);
}
