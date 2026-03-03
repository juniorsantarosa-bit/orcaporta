import { CuttingPiece } from "@/types/cutting";
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";

/**
 * Configuration for the nesting optimizer
 */
export interface NestingOptions {
  sheetWidth: number;
  sheetHeight: number;
  espessura: number;
  material: string;
  gap: number;             // spacing between pieces (fresa diameter)
  refiloX: number;         // edge trim X
  refiloY: number;         // edge trim Y
  allowRotation: boolean;
  direction: "vertical" | "horizontal" | "indefinido";
  optimizationLevel: number; // 0-100
}

const DEFAULT_OPTIONS: NestingOptions = {
  sheetWidth: 2750,
  sheetHeight: 1840,
  espessura: 15,
  material: "Branco TX 15mm",
  gap: 6,
  refiloX: 8,
  refiloY: 8,
  allowRotation: true,
  direction: "vertical",
  optimizationLevel: 80,
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Expanded piece: one entry per quantity unit
 */
interface ExpandedPiece {
  piece: CuttingPiece;
  width: number;
  height: number;
  rotated: boolean;
  index: number;
}

/**
 * Skyline node for the skyline bin-packing algorithm
 */
interface SkylineNode {
  x: number;
  y: number;
  width: number;
}

/**
 * Skyline Bottom-Left bin-packing algorithm
 * More efficient and produces better results than naive gravity packing
 */
class SkylinePacker {
  private skyline: SkylineNode[];
  private binWidth: number;
  private binHeight: number;
  private gap: number;

  constructor(binWidth: number, binHeight: number, gap: number) {
    this.binWidth = binWidth;
    this.binHeight = binHeight;
    this.gap = gap;
    this.skyline = [{ x: 0, y: 0, width: binWidth }];
  }

  /**
   * Find the best position for a rectangle using the "best fit" heuristic
   */
  findPosition(width: number, height: number): { x: number; y: number; score: number } | null {
    const w = width + this.gap;
    const h = height + this.gap;
    
    let bestScore = Infinity;
    let bestX = -1;
    let bestY = -1;
    let bestIdx = -1;

    for (let i = 0; i < this.skyline.length; i++) {
      const result = this.fitAtSkyline(i, w, h);
      if (result !== null) {
        const score = result.y + h; // minimize wasted vertical space
        if (score < bestScore) {
          bestScore = score;
          bestX = result.x;
          bestY = result.y;
          bestIdx = i;
        }
      }
    }

    if (bestIdx === -1) return null;
    return { x: bestX, y: bestY, score: bestScore };
  }

  private fitAtSkyline(idx: number, w: number, h: number): { x: number; y: number } | null {
    let x = this.skyline[idx].x;
    if (x + w > this.binWidth) return null;

    let y = 0;
    let remainingWidth = w;
    let i = idx;

    while (remainingWidth > 0 && i < this.skyline.length) {
      y = Math.max(y, this.skyline[i].y);
      if (y + h > this.binHeight) return null;
      remainingWidth -= this.skyline[i].width;
      i++;
    }

    return { x, y };
  }

  /**
   * Place a rectangle and update the skyline
   */
  place(x: number, y: number, width: number, height: number): void {
    const w = width + this.gap;
    const h = height + this.gap;
    const newNode: SkylineNode = { x, y: y + h, width: w };
    
    // Insert new skyline node
    let i = 0;
    while (i < this.skyline.length && this.skyline[i].x < x) i++;
    
    // Remove covered nodes
    const newSkyline: SkylineNode[] = [];
    for (let j = 0; j < this.skyline.length; j++) {
      const node = this.skyline[j];
      const nodeRight = node.x + node.width;
      const newRight = x + w;

      if (nodeRight <= x || node.x >= newRight) {
        // Node is completely outside the new rect
        newSkyline.push(node);
      } else {
        // Node overlaps with new rect
        if (node.x < x) {
          // Left part remains
          newSkyline.push({ x: node.x, y: node.y, width: x - node.x });
        }
        if (nodeRight > newRight) {
          // Right part remains
          newSkyline.push({ x: newRight, y: node.y, width: nodeRight - newRight });
        }
      }
    }

    // Insert the new node
    let insertIdx = 0;
    while (insertIdx < newSkyline.length && newSkyline[insertIdx].x < x) insertIdx++;
    newSkyline.splice(insertIdx, 0, newNode);

    // Merge adjacent nodes with same height
    this.skyline = [];
    for (const node of newSkyline) {
      if (this.skyline.length > 0) {
        const last = this.skyline[this.skyline.length - 1];
        if (Math.abs(last.y - node.y) < 0.01 && Math.abs(last.x + last.width - node.x) < 0.01) {
          last.width += node.width;
          continue;
        }
      }
      this.skyline.push({ ...node });
    }
  }
}

/**
 * Main nesting optimizer
 * Uses Skyline Bottom-Left algorithm with rotation support
 */
export function optimizeNesting(
  pieces: CuttingPiece[],
  options?: Partial<NestingOptions>,
  existingHoles?: Map<number, PromobHole[]>
): NestingSheet[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Group pieces by material
  const byMaterial = new Map<string, CuttingPiece[]>();
  for (const piece of pieces) {
    const key = `${piece.material}|${piece.espessura}`;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key)!.push(piece);
  }

  const allSheets: NestingSheet[] = [];
  let sheetIdCounter = 1;

  for (const [matKey, matPieces] of byMaterial) {
    const [material] = matKey.split("|");
    const espessura = matPieces[0].espessura;

    // Expand quantities
    const expanded: ExpandedPiece[] = [];
    let labelCounter = 0;
    for (const piece of matPieces) {
      for (let q = 0; q < piece.quantidade; q++) {
        expanded.push({
          piece,
          width: piece.largura,
          height: piece.altura,
          rotated: false,
          index: labelCounter++,
        });
      }
    }

    // Sort by area (largest first) for better packing
    expanded.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // Available space after refilo
    const usableW = opts.sheetWidth - opts.refiloX * 2;
    const usableH = opts.sheetHeight - opts.refiloY * 2;

    let remaining = [...expanded];

    while (remaining.length > 0) {
      const packer = new SkylinePacker(usableW, usableH, opts.gap);
      const placed: { ep: ExpandedPiece; x: number; y: number; w: number; h: number; rotated: boolean }[] = [];
      const notPlaced: ExpandedPiece[] = [];

      for (const ep of remaining) {
        // Try normal orientation
        const pos1 = packer.findPosition(ep.width, ep.height);
        
        // Try rotated (if allowed and piece doesn't have grain constraint)
        let pos2: ReturnType<SkylinePacker["findPosition"]> = null;
        if (opts.allowRotation && !ep.piece.veio && ep.width !== ep.height) {
          pos2 = packer.findPosition(ep.height, ep.width);
        }

        // Pick best position
        let bestPos = pos1;
        let useRotated = false;

        if (pos1 && pos2) {
          if (pos2.score < pos1.score) {
            bestPos = pos2;
            useRotated = true;
          }
        } else if (!pos1 && pos2) {
          bestPos = pos2;
          useRotated = true;
        }

        if (bestPos) {
          const w = useRotated ? ep.height : ep.width;
          const h = useRotated ? ep.width : ep.height;
          packer.place(bestPos.x, bestPos.y, w, h);
          placed.push({
            ep,
            x: bestPos.x + opts.refiloX,
            y: bestPos.y + opts.refiloY,
            w, h,
            rotated: useRotated,
          });
        } else {
          notPlaced.push(ep);
        }
      }

      if (placed.length === 0) {
        // Can't fit any more pieces — they're too large for the sheet
        console.warn(`${notPlaced.length} peças não cabem na chapa ${opts.sheetWidth}x${opts.sheetHeight}`);
        break;
      }

      // Calculate efficiency
      const totalArea = opts.sheetWidth * opts.sheetHeight;
      const usedArea = placed.reduce((a, p) => a + p.w * p.h, 0);
      const efficiency = (usedArea / totalArea) * 100;

      // Build NestingSheet
      const sheet: NestingSheet = {
        id: sheetIdCounter++,
        sheetWidth: opts.sheetWidth,
        sheetHeight: opts.sheetHeight,
        espessura,
        material,
        codCorte: 7000 + sheetIdCounter,
        efficiency,
        pieces: placed.map((p, idx) => {
          const holes = existingHoles?.get(p.ep.piece.id) || [];
          return {
            pieceId: p.ep.piece.id,
            x: p.x,
            y: p.y,
            width: p.w,
            height: p.h,
            rotated: p.rotated,
            label: String(idx),
            descricao: p.ep.piece.descricao,
            furos: holes,
            bordaSup: p.ep.piece.bordaSup,
            bordaInf: p.ep.piece.bordaInf,
            bordaEsq: p.ep.piece.bordaEsq,
            bordaDir: p.ep.piece.bordaDir,
            cliente: p.ep.piece.cliente,
            moduloDesc: p.ep.piece.projeto,
            espessura,
          };
        }),
      };

      allSheets.push(sheet);
      remaining = notPlaced;
    }
  }

  return allSheets;
}

/**
 * Calculate total statistics for a set of sheets
 */
export function calculateNestingStats(sheets: NestingSheet[]) {
  const totalSheets = sheets.length;
  const totalPieces = sheets.reduce((a, s) => a + s.pieces.length, 0);
  const avgEfficiency = sheets.length > 0
    ? sheets.reduce((a, s) => a + s.efficiency, 0) / sheets.length
    : 0;
  const totalSheetArea = sheets.reduce((a, s) => a + s.sheetWidth * s.sheetHeight, 0);
  const totalUsedArea = sheets.reduce((a, s) =>
    a + s.pieces.reduce((b, p) => b + p.width * p.height, 0), 0);
  const totalWasteArea = totalSheetArea - totalUsedArea;

  return {
    totalSheets,
    totalPieces,
    avgEfficiency,
    totalSheetArea: totalSheetArea / 1_000_000, // m²
    totalUsedArea: totalUsedArea / 1_000_000,
    totalWasteArea: totalWasteArea / 1_000_000,
  };
}
