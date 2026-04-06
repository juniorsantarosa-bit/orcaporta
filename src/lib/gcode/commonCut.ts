/**
 * Common Cut (Corte Compartilhado) optimization.
 * 
 * When two pieces are adjacent (separated by the tool gap), the fresa
 * can pass once between them, cutting both edges simultaneously.
 * 
 * Key principles:
 * 1. The cut line runs exactly at the center between the two pieces
 * 2. Tool diameter (kerf) is considered so each piece gets its exact final dimension
 * 3. Redundancy checks ensure no dimensional errors
 * 4. Shared edges are tracked so the contour generator skips them
 */

import { PlacedNestingPiece } from "@/types/promob";
import { ToolSlot } from "@/types/toolMagazine";
import { PostProcessorConfig } from "@/types/postProcessor";

export interface SharedEdge {
  /** Index of piece A in the sheet pieces array */
  pieceAIndex: number;
  /** Index of piece B in the sheet pieces array */
  pieceBIndex: number;
  /** Which edge of A is shared: right or bottom */
  edgeA: "right" | "bottom";
  /** Which edge of B is shared: left or top */
  edgeB: "left" | "top";
  /** The cut line coordinates (start and end) */
  cutStart: { x: number; y: number };
  cutEnd: { x: number; y: number };
  /** Center position of the cut (where fresa passes) */
  cutCenter: number;
  /** Overlap range along the shared dimension */
  overlapStart: number;
  overlapEnd: number;
  /** Orientation of the cut line */
  orientation: "vertical" | "horizontal";
}

/**
 * Tolerance for detecting adjacency: pieces within gap + small margin
 */
const ADJACENCY_TOLERANCE = 2.0; // mm

/**
 * Minimum overlap required to consider edges as shared (avoid tiny slivers)
 */
const MIN_OVERLAP = 10.0; // mm

/**
 * Detect all shared edges between pieces on a sheet.
 * Returns both the shared edges and a set of edge keys to skip in per-piece contours.
 */
export function detectSharedEdges(
  pieces: PlacedNestingPiece[],
  gap: number,
  toolDiameter: number,
): { sharedEdges: SharedEdge[]; skippableEdges: Set<string> } {
  const sharedEdges: SharedEdge[] = [];
  const skippableEdges = new Set<string>();
  const halfTool = toolDiameter / 2;
  const tolerance = gap + ADJACENCY_TOLERANCE;

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];

      // Check A.right ↔ B.left (vertical cut line)
      const distAR_BL = Math.abs((a.x + a.width) - b.x);
      if (distAR_BL <= tolerance) {
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop >= MIN_OVERLAP) {
          const cutCenterX = (a.x + a.width + b.x) / 2;

          // REDUNDANCY: Verify final dimensions are preserved
          const aFinalWidth = cutCenterX - halfTool - a.x;
          const bFinalStart = cutCenterX + halfTool;
          const widthErrorA = Math.abs(aFinalWidth - a.width);
          const widthErrorB = Math.abs((b.x + b.width) - bFinalStart - b.width);
          
          // Only use common cut if dimensional error is within 0.5mm tolerance
          if (widthErrorA <= 0.5 && widthErrorB <= 0.5) {
            sharedEdges.push({
              pieceAIndex: i,
              pieceBIndex: j,
              edgeA: "right",
              edgeB: "left",
              cutStart: { x: cutCenterX, y: overlapTop - halfTool },
              cutEnd: { x: cutCenterX, y: overlapBot + halfTool },
              cutCenter: cutCenterX,
              overlapStart: overlapTop,
              overlapEnd: overlapBot,
              orientation: "vertical",
            });
            skippableEdges.add(`${i}-right`);
            skippableEdges.add(`${j}-left`);
          }
        }
      }

      // Check B.right ↔ A.left (vertical cut line)
      const distBR_AL = Math.abs((b.x + b.width) - a.x);
      if (distBR_AL <= tolerance) {
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop >= MIN_OVERLAP) {
          const cutCenterX = (b.x + b.width + a.x) / 2;
          
          const bFinalWidth = cutCenterX - halfTool - b.x;
          const aFinalStart = cutCenterX + halfTool;
          const widthErrorB = Math.abs(bFinalWidth - b.width);
          const widthErrorA = Math.abs((a.x + a.width) - aFinalStart - a.width);
          
          if (widthErrorA <= 0.5 && widthErrorB <= 0.5) {
            sharedEdges.push({
              pieceAIndex: j,
              pieceBIndex: i,
              edgeA: "right",
              edgeB: "left",
              cutStart: { x: cutCenterX, y: overlapTop - halfTool },
              cutEnd: { x: cutCenterX, y: overlapBot + halfTool },
              cutCenter: cutCenterX,
              overlapStart: overlapTop,
              overlapEnd: overlapBot,
              orientation: "vertical",
            });
            skippableEdges.add(`${j}-right`);
            skippableEdges.add(`${i}-left`);
          }
        }
      }

      // Check A.bottom ↔ B.top (horizontal cut line)
      const distAB_BT = Math.abs((a.y + a.height) - b.y);
      if (distAB_BT <= tolerance) {
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight - overlapLeft >= MIN_OVERLAP) {
          const cutCenterY = (a.y + a.height + b.y) / 2;

          const aFinalH = cutCenterY - halfTool - a.y;
          const bFinalStart = cutCenterY + halfTool;
          const hErrorA = Math.abs(aFinalH - a.height);
          const hErrorB = Math.abs((b.y + b.height) - bFinalStart - b.height);

          if (hErrorA <= 0.5 && hErrorB <= 0.5) {
            sharedEdges.push({
              pieceAIndex: i,
              pieceBIndex: j,
              edgeA: "bottom",
              edgeB: "top",
              cutStart: { x: overlapLeft - halfTool, y: cutCenterY },
              cutEnd: { x: overlapRight + halfTool, y: cutCenterY },
              cutCenter: cutCenterY,
              overlapStart: overlapLeft,
              overlapEnd: overlapRight,
              orientation: "horizontal",
            });
            skippableEdges.add(`${i}-bottom`);
            skippableEdges.add(`${j}-top`);
          }
        }
      }

      // Check B.bottom ↔ A.top (horizontal cut line)
      const distBB_AT = Math.abs((b.y + b.height) - a.y);
      if (distBB_AT <= tolerance) {
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight - overlapLeft >= MIN_OVERLAP) {
          const cutCenterY = (b.y + b.height + a.y) / 2;

          const bFinalH = cutCenterY - halfTool - b.y;
          const aFinalStart = cutCenterY + halfTool;
          const hErrorB = Math.abs(bFinalH - b.height);
          const hErrorA = Math.abs((a.y + a.height) - aFinalStart - a.height);

          if (hErrorA <= 0.5 && hErrorB <= 0.5) {
            sharedEdges.push({
              pieceAIndex: j,
              pieceBIndex: i,
              edgeA: "bottom",
              edgeB: "top",
              cutStart: { x: overlapLeft - halfTool, y: cutCenterY },
              cutEnd: { x: overlapRight + halfTool, y: cutCenterY },
              cutCenter: cutCenterY,
              overlapStart: overlapLeft,
              overlapEnd: overlapRight,
              orientation: "horizontal",
            });
            skippableEdges.add(`${j}-bottom`);
            skippableEdges.add(`${i}-top`);
          }
        }
      }
    }
  }

  // Remove duplicate edges (same pair, same orientation)
  const uniqueEdges = deduplicateEdges(sharedEdges);

  return { sharedEdges: uniqueEdges, skippableEdges };
}

function deduplicateEdges(edges: SharedEdge[]): SharedEdge[] {
  const seen = new Set<string>();
  const result: SharedEdge[] = [];
  for (const edge of edges) {
    const keyA = `${Math.min(edge.pieceAIndex, edge.pieceBIndex)}-${Math.max(edge.pieceAIndex, edge.pieceBIndex)}-${edge.orientation}`;
    if (!seen.has(keyA)) {
      seen.add(keyA);
      result.push(edge);
    }
  }
  return result;
}

/**
 * Generate G-code for common cut lines.
 * These are straight passes between adjacent pieces.
 */
export function generateCommonCutGCode(
  lines: string[],
  sharedEdges: SharedEdge[],
  pieces: PlacedNestingPiece[],
  tool: ToolSlot,
  pp: PostProcessorConfig,
  espessura: number,
  f: (n: number) => string,
  f1: (n: number) => string,
  f4: (n: number) => string,
): void {
  if (sharedEdges.length === 0) return;

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zSeguroAutoCalc ? espessura : pp.zRapido;
  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;
  const zDepth = pp.passeFinal;

  // Sort edges for optimal travel: group by orientation, then by position
  const sorted = [...sharedEdges].sort((a, b) => {
    if (a.orientation !== b.orientation) return a.orientation === "vertical" ? -1 : 1;
    if (a.orientation === "vertical") return a.cutCenter - b.cutCenter;
    return a.cutCenter - b.cutCenter;
  });

  if (pp.tipo === "mach_cnc") {
    lines.push(`( === COMMON CUT - Corte Compartilhado === )`);
    lines.push(`( ${sorted.length} cortes compartilhados detectados )`);
  } else if (pp.tipo === "smartcut") {
    lines.push(`(#### COMMON CUT - Corte Compartilhado ####)`);
  } else {
    lines.push(`(=== Common Cut ===)`);
  }
  lines.push("");

  for (let idx = 0; idx < sorted.length; idx++) {
    const edge = sorted[idx];
    const pA = pieces[edge.pieceAIndex];
    const pB = pieces[edge.pieceBIndex];

    // Mirror X axis for CNC coordinate system (negative X)
    const startX = -edge.cutStart.x;
    const startY = edge.cutStart.y;
    const endX = -edge.cutEnd.x;
    const endY = edge.cutEnd.y;

    const labelA = pA.label || String(edge.pieceAIndex + 1);
    const labelB = pB.label || String(edge.pieceBIndex + 1);

    if (pp.tipo === "mach_cnc") {
      lines.push(`( CommonCut ${idx + 1}: Peca ${labelA} <-> Peca ${labelB} | ${edge.orientation} )`);
      
      // Approach with lead-in
      const approachX = edge.orientation === "vertical" ? startX : startX - 5;
      const approachY = edge.orientation === "horizontal" ? startY : startY - 5;
      
      lines.push(`G0 X${f4(approachX)} Y${f4(approachY)} Z${f4(zSeguro)}`);
      lines.push(`G0 Z${f4(zRapido)}`);
      
      // Ramp entry (diagonal)
      lines.push(`G1 X${f4(startX)} Y${f4(startY)} Z${f4(zDepth)} F${f4(feedEntry)}`);
      
      // Common cut line
      lines.push(`G1 X${f4(endX)} Y${f4(endY)} F${f4(feedCut)}`);
      
      // Retract
      lines.push(`G0 Z${f4(zSeguro)}`);
      lines.push("");

    } else if (pp.tipo === "aspire") {
      lines.push(`( CommonCut ${idx + 1}: ${labelA}-${labelB} )`);
      
      lines.push(`G0 X${f4(startX)} Y${f4(startY)} `);
      lines.push(`G0 Z${f4(zSeguro)}`);
      lines.push(`G1 Z${f4(zRapido)} F${f4(feedEntry)}`);
      lines.push(`G1 Z${f4(zDepth)} F${f4(feedEntry * 0.7)}`);
      lines.push(`G1 X${f4(endX)} Y${f4(endY)} F${f4(feedCut)}`);
      lines.push(`G0 Z${f4(zSeguro)}`);
      lines.push("");

    } else {
      // SmartCut
      lines.push(`(CommonCut ${idx + 1}: ${labelA}-${labelB})`);
      
      lines.push(`G0 X${f(startX)} Y${f1(startY)}`);
      lines.push(`G0 Z${f1(zRapido)}`);
      lines.push(`G1 Z${f(zDepth)} F${f(feedEntry)}`);
      lines.push(`G1 X${f(endX)} Y${f1(endY)} F${f(feedCut)}`);
      lines.push(`G0 Z${f1(zSeguro)}`);
      lines.push("");
    }
  }
}

/**
 * Generate remaining contour segments for a piece after removing only the
 * exact overlapping spans handled by common cut.
 */
type PieceSide = "top" | "right" | "bottom" | "left";

export interface RemainingContourSegment {
  side: PieceSide;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Range {
  start: number;
  end: number;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= last.end + 0.1) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function subtractRanges(min: number, max: number, blocked: Range[]): Range[] {
  if (max <= min) return [];
  const merged = mergeRanges(blocked);
  const remaining: Range[] = [];
  let cursor = min;

  for (const range of merged) {
    if (range.start > cursor + 0.1) {
      remaining.push({ start: cursor, end: Math.min(range.start, max) });
    }
    cursor = Math.max(cursor, range.end);
    if (cursor >= max) break;
  }

  if (cursor < max - 0.1) {
    remaining.push({ start: cursor, end: max });
  }

  return remaining.filter(range => range.end - range.start > 0.5);
}

export function getRemainingContourSegments(
  piece: PlacedNestingPiece,
  pieceIndex: number,
  sharedEdges: SharedEdge[],
  toolDiameter: number,
  cornerInset: number = 0,
): RemainingContourSegment[] {
  const halfTool = toolDiameter / 2;
  const x1 = piece.x - halfTool;
  const x2 = piece.x + piece.width + halfTool;
  const y1 = piece.y - halfTool;
  const y2 = piece.y + piece.height + halfTool;

  const hMin = x1 + cornerInset;
  const hMax = x2 - cornerInset;
  const vMin = y1 + cornerInset;
  const vMax = y2 - cornerInset;

  if (hMax <= hMin || vMax <= vMin) return [];

  const blocked: Record<PieceSide, Range[]> = {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };

  const addBlockedRange = (side: PieceSide, start: number, end: number, axisMin: number, axisMax: number) => {
    const clampedStart = Math.max(axisMin, Math.min(start, end));
    const clampedEnd = Math.min(axisMax, Math.max(start, end));
    if (clampedEnd - clampedStart > 0.5) {
      blocked[side].push({ start: clampedStart, end: clampedEnd });
    }
  };

  for (const edge of sharedEdges) {
    const side = edge.pieceAIndex === pieceIndex
      ? edge.edgeA
      : edge.pieceBIndex === pieceIndex
        ? edge.edgeB
        : null;

    if (!side) continue;

    if (edge.orientation === "vertical" && (side === "left" || side === "right")) {
      addBlockedRange(side, edge.cutStart.y, edge.cutEnd.y, vMin, vMax);
    }

    if (edge.orientation === "horizontal" && (side === "top" || side === "bottom")) {
      addBlockedRange(side, edge.cutStart.x, edge.cutEnd.x, hMin, hMax);
    }
  }

  const segments: RemainingContourSegment[] = [];

  for (const span of subtractRanges(hMin, hMax, blocked.bottom)) {
    segments.push({ side: "bottom", from: { x: span.start, y: y1 }, to: { x: span.end, y: y1 } });
  }

  for (const span of subtractRanges(vMin, vMax, blocked.right)) {
    segments.push({ side: "right", from: { x: x2, y: span.start }, to: { x: x2, y: span.end } });
  }

  for (const span of subtractRanges(hMin, hMax, blocked.top)) {
    segments.push({ side: "top", from: { x: span.end, y: y2 }, to: { x: span.start, y: y2 } });
  }

  for (const span of subtractRanges(vMin, vMax, blocked.left)) {
    segments.push({ side: "left", from: { x: x1, y: span.end }, to: { x: x1, y: span.start } });
  }

  return segments;
}

/**
 * Generate modified contour for a piece with skipped shared edge spans.
 * Only the exact overlapping intervals are skipped; remaining edge stubs
 * are still cut normally.
 */
export function generatePartialContour(
  lines: string[],
  piece: PlacedNestingPiece,
  pieceIndex: number,
  sharedEdges: SharedEdge[],
  tool: ToolSlot,
  pp: PostProcessorConfig,
  zDepth: number,
  passLabel: string,
  f: (n: number) => string,
  f1: (n: number) => string,
  f4: (n: number) => string,
  espessura: number,
): void {
  const R = pp.raioContorno;
  const activeSegments = getRemainingContourSegments(piece, pieceIndex, sharedEdges, tool.diametro, R)
    .map(seg => ({
      name: seg.side,
      startX: -seg.from.x,
      startY: seg.from.y,
      endX: -seg.to.x,
      endY: seg.to.y,
    }));

  if (activeSegments.length === 0) return;

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;
  const dimW = piece.rotated ? piece.height : piece.width;
  const dimH = piece.rotated ? piece.width : piece.height;

  if (pp.tipo === "mach_cnc") {
    lines.push(`(${passLabel} - ${dimW} x ${dimH} - Partial contour by shared spans)`);
  }

  for (const seg of activeSegments) {
    if (pp.tipo === "mach_cnc") {
      lines.push(`G0 X${f4(seg.startX)} Y${f4(seg.startY)} Z${f4(zSeguro)}`);
      lines.push(`G0 Z${f4(pp.zSeguroAutoCalc ? espessura : pp.zRapido)}`);
      lines.push(`G1 Z${f4(zDepth)} F${f4(feedEntry)}`);
      lines.push(`G1 X${f4(seg.endX)} Y${f4(seg.endY)} F${f4(feedCut)}`);
      lines.push(`G0 Z${f4(zSeguro)}`);
    } else if (pp.tipo === "aspire") {
      lines.push(`G0 X${f4(seg.startX)} Y${f4(seg.startY)} `);
      lines.push(`G0 Z${f4(zSeguro)}`);
      lines.push(`G1 Z${f4(zDepth)} F${f4(feedEntry)}`);
      lines.push(`G1 X${f4(seg.endX)} Y${f4(seg.endY)} F${f4(feedCut)}`);
      lines.push(`G0 Z${f4(zSeguro)}`);
    } else {
      lines.push(`G0 X${f(seg.startX)} Y${f1(seg.startY)}`);
      lines.push(`G0 Z${f1(pp.zSeguroAutoCalc ? espessura : pp.zRapido)}`);
      lines.push(`G1 Z${f(zDepth)} F${f(feedEntry)}`);
      lines.push(`G1 X${f(seg.endX)} Y${f1(seg.endY)} F${f(feedCut)}`);
      lines.push(`G0 Z${f1(zSeguro)}`);
    }
  }
}
