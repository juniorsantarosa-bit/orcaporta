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
 * Generate modified contour for a piece with skipped shared edges.
 * Instead of a full rectangle, the contour skips edges that are handled by common cuts.
 * Remaining edges are cut as individual segments with proper lead-in/out.
 */
export function generatePartialContour(
  lines: string[],
  piece: PlacedNestingPiece,
  pieceIndex: number,
  skippableEdges: Set<string>,
  tool: ToolSlot,
  pp: PostProcessorConfig,
  zDepth: number,
  passLabel: string,
  f: (n: number) => string,
  f1: (n: number) => string,
  f4: (n: number) => string,
  espessura: number,
): void {
  const halfFresa = tool.diametro / 2;
  const R = pp.raioContorno;
  
  const skipRight = skippableEdges.has(`${pieceIndex}-right`);
  const skipLeft = skippableEdges.has(`${pieceIndex}-left`);
  const skipTop = skippableEdges.has(`${pieceIndex}-top`);
  const skipBottom = skippableEdges.has(`${pieceIndex}-bottom`);
  
  // If no edges are skipped, use full contour
  const skippedCount = [skipRight, skipLeft, skipTop, skipBottom].filter(Boolean).length;
  if (skippedCount === 0) {
    // Import and use the standard full contour
    return; // Caller should use generatePieceContour instead
  }

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zSeguroAutoCalc ? espessura : pp.zRapido;
  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;

  // CNC coordinates (X mirrored)
  const x1 = -(piece.x + piece.width) - halfFresa; // left in CNC
  const x2 = -piece.x + halfFresa;                 // right in CNC
  const y1 = piece.y - halfFresa;                   // bottom
  const y2 = piece.y + piece.height + halfFresa;    // top

  // Build segments: top, right, bottom, left
  // Each segment is a line from corner to corner
  interface Segment {
    name: string;
    skip: boolean;
    startX: number; startY: number;
    endX: number; endY: number;
  }

  const segments: Segment[] = [
    { name: "top",    skip: skipTop,    startX: x1 + R, startY: y2, endX: x2 - R, endY: y2 },
    { name: "right",  skip: skipRight,  startX: x2, startY: y2 - R, endX: x2, endY: y1 + R },
    { name: "bottom", skip: skipBottom, startX: x2 - R, startY: y1, endX: x1 + R, endY: y1 },
    { name: "left",   skip: skipLeft,   startX: x1, startY: y1 + R, endX: x1, endY: y2 - R },
  ];

  const activeSegments = segments.filter(s => !s.skip);
  
  if (activeSegments.length === 0) return;

  const dimW = piece.rotated ? piece.height : piece.width;
  const dimH = piece.rotated ? piece.width : piece.height;

  if (pp.tipo === "mach_cnc") {
    lines.push(`(${passLabel} - ${dimW} x ${dimH} - Partial contour, ${skippedCount} shared edges)`);
  }

  // Cut each active segment independently with approach/retract
  for (const seg of activeSegments) {
    if (pp.tipo === "mach_cnc") {
      lines.push(`G0 X${f4(seg.startX)} Y${f4(seg.startY)} Z${f4(zSeguro)}`);
      lines.push(`G0 Z${f4(zRapido)}`);
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
      lines.push(`G0 Z${f1(zRapido)}`);
      lines.push(`G1 Z${f(zDepth)} F${f(feedEntry)}`);
      lines.push(`G1 X${f(seg.endX)} Y${f1(seg.endY)} F${f(feedCut)}`);
      lines.push(`G0 Z${f1(zSeguro)}`);
    }
  }
}
