import { CuttingPiece } from "@/types/cutting";
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";

export interface NestingOptions {
  sheetWidth: number;
  sheetHeight: number;
  espessura: number;
  material: string;
  gap: number;
  refiloX: number;
  refiloY: number;
  allowRotation: boolean;
  direction: "vertical" | "horizontal" | "indefinido";
  optimizationLevel: number;
}

const DEFAULT_OPTIONS: NestingOptions = {
  sheetWidth: 1840,
  sheetHeight: 2750,
  espessura: 15,
  material: "Branco TX 15mm",
  gap: 6,
  refiloX: 8,
  refiloY: 8,
  allowRotation: true,
  direction: "vertical",
  optimizationLevel: 80,
};

interface SkylineNode {
  x: number;
  y: number;
  width: number;
}

interface ExpandedPiece {
  piece: CuttingPiece;
  width: number;
  height: number;
  rotated: boolean;
  index: number;
}

type PackingDirection = "vertical" | "horizontal";

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

  findPosition(width: number, height: number): { x: number; y: number; score: number } | null {
    const w = width + this.gap;
    const h = height + this.gap;

    let bestScore = Infinity;
    let bestWaste = Infinity;
    let bestX = -1;
    let bestY = -1;

    for (let i = 0; i < this.skyline.length; i++) {
      const result = this.fitAtSkyline(i, w, h);
      if (result !== null) {
        const topY = result.y + h;
        const waste = this.calculateWaste(i, w, result.y);

        if (
          topY < bestScore ||
          (topY === bestScore && waste < bestWaste) ||
          (topY === bestScore && waste === bestWaste && result.x < bestX)
        ) {
          bestScore = topY;
          bestWaste = waste;
          bestX = result.x;
          bestY = result.y;
        }
      }
    }

    if (bestX === -1) return null;
    return { x: bestX, y: bestY, score: bestScore };
  }

  private calculateWaste(startIdx: number, w: number, maxY: number): number {
    let waste = 0;
    let remaining = w;
    let i = startIdx;
    while (remaining > 0 && i < this.skyline.length) {
      const nodeW = Math.min(this.skyline[i].width, remaining);
      waste += nodeW * (maxY - this.skyline[i].y);
      remaining -= this.skyline[i].width;
      i++;
    }
    return waste;
  }

  private fitAtSkyline(idx: number, w: number, h: number): { x: number; y: number } | null {
    const x = this.skyline[idx].x;
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

  place(x: number, y: number, width: number, height: number): void {
    const w = width + this.gap;
    const h = height + this.gap;
    const newNode: SkylineNode = { x, y: y + h, width: w };

    const newSkyline: SkylineNode[] = [];
    for (const node of this.skyline) {
      const nodeRight = node.x + node.width;
      const newRight = x + w;

      if (nodeRight <= x || node.x >= newRight) {
        newSkyline.push(node);
      } else {
        if (node.x < x) {
          newSkyline.push({ x: node.x, y: node.y, width: x - node.x });
        }
        if (nodeRight > newRight) {
          newSkyline.push({ x: newRight, y: node.y, width: nodeRight - newRight });
        }
      }
    }

    let insertIdx = 0;
    while (insertIdx < newSkyline.length && newSkyline[insertIdx].x < x) insertIdx++;
    newSkyline.splice(insertIdx, 0, newNode);

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

  getUsedHeight(): number {
    return Math.max(...this.skyline.map((n) => n.y));
  }
}

/**
 * Global sequential label counter — resets per optimize call (project scope)
 */
let globalLabelCounter = 1;

export function optimizeNesting(
  pieces: CuttingPiece[],
  options?: Partial<NestingOptions>,
  existingHoles?: Map<number, PromobHole[]>
): NestingSheet[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Reset global label counter for new optimization
  globalLabelCounter = 1;

  const byMaterial = new Map<string, CuttingPiece[]>();
  for (const piece of pieces) {
    const key = `${piece.material}|${piece.espessura}`;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key)!.push(piece);
  }

  console.log(`[Nesting] ${byMaterial.size} grupo(s) de material:`, [...byMaterial.entries()].map(([k, v]) => `${k} (${v.length} peças)`));

  const allSheets: NestingSheet[] = [];
  let sheetIdCounter = 1;

  for (const [matKey, matPieces] of byMaterial) {
    const [material] = matKey.split("|");
    const espessura = matPieces[0].espessura;

    const expanded: ExpandedPiece[] = [];
    let labelCounter = 0;
    for (const piece of matPieces) {
      const qty = Math.max(1, Math.round(piece.quantidade || 1));
      console.log(`[Nesting] Peça "${piece.descricao}" (${piece.largura}x${piece.altura}) qty=${qty}`);
      for (let q = 0; q < qty; q++) {
        expanded.push({
          piece,
          width: piece.largura,
          height: piece.altura,
          rotated: false,
          index: labelCounter++,
        });
      }
    }

    const usableW = opts.sheetWidth - opts.refiloX * 2;
    const usableH = opts.sheetHeight - opts.refiloY * 2;

    const sortStrategies: ((a: ExpandedPiece, b: ExpandedPiece) => number)[] = [
      (a, b) => (b.width * b.height) - (a.width * a.height),
      (a, b) => b.height - a.height || b.width - a.width,
      (a, b) => b.width - a.width || b.height - a.height,
      (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
      (a, b) => (b.width + b.height) - (a.width + a.height),
    ];

    let bestResult: PackResult | null = null;
    const packingDirections: PackingDirection[] =
      opts.direction === "indefinido" ? ["vertical", "horizontal"] : [opts.direction];

    for (const direction of packingDirections) {
      for (const sortFn of sortStrategies) {
        const sorted = [...expanded].sort(sortFn);
        const result = packWithOrder(sorted, usableW, usableH, opts, direction);

        if (comparePackResults(bestResult, result, opts.direction)) {
          bestResult = result;
        }
      }
    }

    if (!bestResult) continue;

    for (const packedSheet of bestResult.sheets) {
      const totalArea = opts.sheetWidth * opts.sheetHeight;
      const usedArea = packedSheet.reduce((a, p) => a + p.w * p.h, 0);
      const efficiency = (usedArea / totalArea) * 100;

      const sheet: NestingSheet = {
        id: sheetIdCounter++,
        sheetWidth: opts.sheetWidth,
        sheetHeight: opts.sheetHeight,
        espessura,
        material,
        codCorte: 7000 + sheetIdCounter,
        efficiency,
        pieces: packedSheet.map((p) => {
          const holes = existingHoles?.get(p.ep.piece.id) || p.ep.piece.furos || [];
          const label = String(globalLabelCounter++);
          return {
            pieceId: p.ep.piece.id,
            x: p.x,
            y: p.y,
            width: p.w,
            height: p.h,
            rotated: p.rotated,
            label,
            descricao: p.ep.piece.descricao,
            furos: holes,
            usinagens: (p.ep.piece as any).usinagens || [],
            noContour: (p.ep.piece as any).noContour === true,
            bordaSup: p.ep.piece.bordaSup,
            bordaInf: p.ep.piece.bordaInf,
            bordaEsq: p.ep.piece.bordaEsq,
            bordaDir: p.ep.piece.bordaDir,
            cliente: p.ep.piece.cliente,
            ambiente: p.ep.piece.observacao || '',
            moduloDesc: p.ep.piece.projeto,
            espessura,
          };
        }),
      };

      allSheets.push(sheet);
    }
  }

  return allSheets;
}

interface PackedPiece {
  ep: ExpandedPiece;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

interface PackResult {
  sheets: PackedPiece[][];
  totalEfficiency: number;
  maxUsedX: number;
  maxUsedY: number;
}

function comparePackResults(
  current: PackResult | null,
  candidate: PackResult,
  requestedDirection: NestingOptions["direction"]
): boolean {
  if (!current) return true;

  if (candidate.sheets.length !== current.sheets.length) {
    return candidate.sheets.length < current.sheets.length;
  }

  if (requestedDirection === "vertical") {
    if (Math.abs(candidate.maxUsedX - current.maxUsedX) > 0.01) {
      return candidate.maxUsedX < current.maxUsedX;
    }

    if (Math.abs(candidate.maxUsedY - current.maxUsedY) > 0.01) {
      return candidate.maxUsedY > current.maxUsedY;
    }
  }

  if (requestedDirection === "horizontal") {
    if (Math.abs(candidate.maxUsedY - current.maxUsedY) > 0.01) {
      return candidate.maxUsedY < current.maxUsedY;
    }

    if (Math.abs(candidate.maxUsedX - current.maxUsedX) > 0.01) {
      return candidate.maxUsedX > current.maxUsedX;
    }
  }

  return candidate.totalEfficiency > current.totalEfficiency;
}

function packWithOrder(
  sorted: ExpandedPiece[],
  usableW: number,
  usableH: number,
  opts: NestingOptions,
  direction: PackingDirection
): PackResult {
  const sheets: { packer: SkylinePacker; pieces: PackedPiece[] }[] = [];
  let remaining = [...sorted];
  const isVertical = direction === "vertical";

  while (remaining.length > 0) {
    const packer = new SkylinePacker(
      isVertical ? usableH : usableW,
      isVertical ? usableW : usableH,
      opts.gap
    );
    const placed: PackedPiece[] = [];
    const notPlaced: ExpandedPiece[] = [];

    for (const ep of remaining) {
      const result = tryPlace(packer, ep, opts, direction);
      if (result) {
        placed.push(result);
      } else {
        notPlaced.push(ep);
      }
    }

    if (placed.length === 0) {
      console.warn(`${notPlaced.length} peças não cabem na chapa ${opts.sheetWidth}x${opts.sheetHeight}`);
      break;
    }

    sheets.push({ packer, pieces: placed });

    const stillNotPlaced: ExpandedPiece[] = [];
    for (const ep of notPlaced) {
      let fitted = false;
      for (const existingSheet of sheets) {
        const result = tryPlace(existingSheet.packer, ep, opts, direction);
        if (result) {
          existingSheet.pieces.push(result);
          fitted = true;
          break;
        }
      }
      if (!fitted) {
        stillNotPlaced.push(ep);
      }
    }

    remaining = stillNotPlaced;
  }

  const totalArea = sheets.length * usableW * usableH;
  const usedArea = sheets.reduce(
    (a, s) => a + s.pieces.reduce((b, p) => b + p.w * p.h, 0),
    0
  );

  const maxUsedX = sheets.reduce(
    (maxSheetX, sheet) => Math.max(maxSheetX, ...sheet.pieces.map((piece) => piece.x + piece.w), 0),
    0
  );
  const maxUsedY = sheets.reduce(
    (maxSheetY, sheet) => Math.max(maxSheetY, ...sheet.pieces.map((piece) => piece.y + piece.h), 0),
    0
  );

  return {
    sheets: sheets.map((s) => s.pieces),
    totalEfficiency: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    maxUsedX,
    maxUsedY,
  };
}

function tryPlace(
  packer: SkylinePacker,
  ep: ExpandedPiece,
  opts: NestingOptions,
  direction: PackingDirection
): PackedPiece | null {
  const isVertical = direction === "vertical";
  const pos1 = packer.findPosition(
    isVertical ? ep.height : ep.width,
    isVertical ? ep.width : ep.height
  );
  let pos2: ReturnType<SkylinePacker["findPosition"]> = null;
  if (opts.allowRotation && !ep.piece.veio && ep.width !== ep.height) {
    pos2 = packer.findPosition(
      isVertical ? ep.width : ep.height,
      isVertical ? ep.height : ep.width
    );
  }

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

  if (!bestPos) return null;

  const w = useRotated ? ep.height : ep.width;
  const h = useRotated ? ep.width : ep.height;

  packer.place(
    bestPos.x,
    bestPos.y,
    isVertical ? h : w,
    isVertical ? w : h
  );

  return {
    ep,
    x: (isVertical ? bestPos.y : bestPos.x) + opts.refiloX,
    y: (isVertical ? bestPos.x : bestPos.y) + opts.refiloY,
    w,
    h,
    rotated: useRotated,
  };
}

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
    totalSheetArea: totalSheetArea / 1_000_000,
    totalUsedArea: totalUsedArea / 1_000_000,
    totalWasteArea: totalWasteArea / 1_000_000,
  };
}
