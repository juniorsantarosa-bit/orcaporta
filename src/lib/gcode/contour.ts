/**
 * G-code contour cutting operations generator.
 * Supports SmartCut diagonal ramp, Mach CNC two-pass, and Aspire helical ramp.
 * Optimized: detects shared edges between adjacent pieces to avoid double cuts.
 */
import { PlacedNestingPiece } from "@/types/promob";
import { ToolSlot } from "@/types/toolMagazine";
import { PostProcessorConfig } from "@/types/postProcessor";
import { NestingSheet } from "@/types/promob";

/**
 * Detect shared edges between pieces on the same sheet.
 * Two pieces share an edge when they are separated by exactly the gap distance
 * and their edges overlap along the shared dimension.
 * Returns a set of edge keys that should be skipped (already cut by neighbor).
 */
export function findSharedEdges(
  pieces: PlacedNestingPiece[],
  gap: number,
  toolDiameter: number,
): Set<string> {
  const skippable = new Set<string>();
  const tolerance = toolDiameter + 2; // pieces within tool diameter + small tolerance share a cut

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];

      // Check if A's right edge aligns with B's left edge
      const rightLeftDist = Math.abs((a.x + a.width) - b.x);
      if (rightLeftDist <= tolerance) {
        // Check vertical overlap
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop > 10) {
          // A's right and B's left share a cut — mark B's left as skippable
          skippable.add(`${j}-left`);
        }
      }

      // Check if A's bottom edge aligns with B's top edge
      const bottomTopDist = Math.abs((a.y + a.height) - b.y);
      if (bottomTopDist <= tolerance) {
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight - overlapLeft > 10) {
          skippable.add(`${j}-top`);
        }
      }

      // Check if B's right edge aligns with A's left edge
      const bRightALeft = Math.abs((b.x + b.width) - a.x);
      if (bRightALeft <= tolerance) {
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop > 10) {
          skippable.add(`${i}-left`);
        }
      }

      // Check if B's bottom edge aligns with A's top edge
      const bBottomATop = Math.abs((b.y + b.height) - a.y);
      if (bBottomATop <= tolerance) {
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight - overlapLeft > 10) {
          skippable.add(`${i}-top`);
        }
      }
    }
  }

  return skippable;
}

function generateHelicalRamp(
  lines: string[],
  startX: number,
  startY: number,
  zStart: number,
  zEnd: number,
  pp: PostProcessorConfig,
  feedEntry: number,
  f4: (n: number) => string,
) {
  const steps = pp.rampSteps || 30;
  const radius = 3.0;

  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    const z = zStart + (zEnd - zStart) * t;
    const angle = t * Math.PI * 2;
    const dx = Math.sin(angle) * radius;
    const dy = (1 - Math.cos(angle)) * radius;

    if (i === 0) {
      lines.push(`G1 X${f4(startX + dx)} Y${f4(startY + dy)} Z${f4(z)} F${f4(feedEntry)}`);
    } else {
      lines.push(`G1 X${f4(startX + dx)} Y${f4(startY + dy)} Z${f4(z)} `);
    }
  }
}

function arcCmd(
  gCode: "G2" | "G3",
  targetX: number | null,
  targetY: number | null,
  fromX: number,
  fromY: number,
  centerX: number,
  centerY: number,
  radius: number,
  pp: PostProcessorConfig,
  f4: (n: number) => string,
): string {
  const xPart = targetX !== null ? `X${f4(targetX)} ` : "";
  const yPart = targetY !== null ? `Y${f4(targetY)} ` : "";

  if (pp.arcFormat === "IJ") {
    const i = centerX - fromX;
    const j = centerY - fromY;
    return `${gCode} ${xPart}${yPart}I${f4(i)} J${f4(j)} `;
  } else {
    return `${gCode} ${xPart}${yPart}R${f4(radius)}`;
  }
}

/**
 * Generate contour cut for a single piece.
 */
export function generatePieceContour(
  lines: string[],
  piece: PlacedNestingPiece,
  tool: ToolSlot,
  pp: PostProcessorConfig,
  zDepth: number,
  passLabel: string,
  f: (n: number) => string,
  f1: (n: number) => string,
  f4: (n: number) => string,
  espessura: number,
) {
  const R = pp.raioContorno;
  const halfFresa = tool.diametro / 2;

  const x1 = -(piece.x + piece.width) - halfFresa;
  const x2 = -piece.x + halfFresa;
  const y1 = piece.y - halfFresa;
  const y2 = piece.y + piece.height + halfFresa;

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zSeguroAutoCalc ? espessura : pp.zRapido;

  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;
  const feedLeadOut = pp.avancoLeadOut || feedEntry;

  const leadInX = (x1 + x2) / 2;
  const leadInY = y2;

  if (pp.tipo === "mach_cnc") {
    const dimW = piece.rotated ? piece.height : piece.width;
    const dimH = piece.rotated ? piece.width : piece.height;
    lines.push(`(${passLabel} - ${dimW} x ${dimH})`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY - 14.7)}Z${f4(zSeguro)}`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY - 14.7)}Z${f4(zRapido)}`);

    if (zDepth > 0) {
      lines.push(`(Step:1/2)`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedEntry)}`);
    } else {
      lines.push(`(Step:${pp.usarDoisPasses ? "2/2" : "1/1"})`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(pp.usarDoisPasses ? feedEntry * 0.7 : feedEntry)}`);
    }

    lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedCut)}`);
    
    lines.push(`G1 X${f4(x2 - R)}Y${f4(y2)}Z${f4(zDepth)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1 Y${f4(y1 + R)}`);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}`);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1 Y${f4(y2 - R)}`);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    lines.push(`G1 X${f4(leadInX)}`);

    lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedLeadOut)}`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zSeguro)}`);

  } else if (pp.tipo === "aspire") {
    lines.push(`G0 X${f4(leadInX)} Y${f4(leadInY)} `);
    lines.push(`G0   Z${f4(zSeguro)}`);

    lines.push(`G1   Z${f4(zRapido)} F${f4(feedEntry)}`);
    generateHelicalRamp(lines, leadInX, leadInY, zRapido, zDepth, pp, feedEntry, f4);

    lines.push(`G1 X${f4(leadInX)} Z${f4(zDepth)} `);

    lines.push(`G1 X${f4(x2 - R)}  Z${f4(zDepth)} F${f4(feedCut)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1  Y${f4(y1 + R)}  `);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}   `);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1  Y${f4(y2 - R)}  `);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    lines.push(`G1 X${f4(leadInX)}   `);

    lines.push(`G0   Z${f4(zSeguro)}`);

  } else {
    lines.push(`G0 X${f(leadInX)} Y${f1(leadInY)}`);
    lines.push(`G0 Z${f1(zRapido)}`);

    lines.push(`G1 X${f(leadInX + pp.leadOutDistance)} Z${f(zDepth)} F${f(feedEntry)}`);

    lines.push(`G1 X${f(x2 - R)} F${f(feedCut)}`);
    lines.push(`G2 X${f(x2)} Y${f1(y2 - R)} R${f(R)}`);
    lines.push(`G1 Y${f1(y1 + R)}`);
    lines.push(`G2 X${f(x2 - R)} Y${f1(y1)} R${f(R)}`);
    lines.push(`G1 X${f(x1 + R)}`);
    lines.push(`G2 X${f(x1)} Y${f1(y1 + R)} R${f(R)}`);
    lines.push(`G1 Y${f1(y2 - R)}`);
    lines.push(`G2 X${f(x1 + R)} Y${f1(y2)} R${f(R)}`);
    lines.push(`G1 X${f(leadInX)}`);

    lines.push(`G1 X${f(leadInX - pp.leadOutDistance)} F${f(feedLeadOut)}`);
    lines.push(`G0 Z${f1(zSeguro)}`);
  }
}
