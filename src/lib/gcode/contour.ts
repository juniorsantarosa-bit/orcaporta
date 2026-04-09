/**
 * G-code contour cutting operations generator.
 * Supports SmartCut diagonal ramp, Mach CNC two-pass, and Aspire helical ramp.
 * 
 * CRITICAL: Lead-in/contour/lead-out are strictly separated:
 *   1. Lead-in: ramp descent OUTSIDE the piece contour
 *   2. Contour: complete closed loop (start = end point)
 *   3. Lead-out: lateral exit OUTSIDE the piece, then Z retract
 */
import { PlacedNestingPiece } from "@/types/promob";
import { ToolSlot } from "@/types/toolMagazine";
import { PostProcessorConfig } from "@/types/postProcessor";

/**
 * Detect shared edges between pieces on the same sheet.
 */
export function findSharedEdges(
  pieces: PlacedNestingPiece[],
  gap: number,
  toolDiameter: number,
): Set<string> {
  const skippable = new Set<string>();
  const tolerance = toolDiameter + 2;

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];

      const rightLeftDist = Math.abs((a.x + a.width) - b.x);
      if (rightLeftDist <= tolerance) {
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop > 10) {
          skippable.add(`${j}-left`);
        }
      }

      const bottomTopDist = Math.abs((a.y + a.height) - b.y);
      if (bottomTopDist <= tolerance) {
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight - overlapLeft > 10) {
          skippable.add(`${j}-top`);
        }
      }

      const bRightALeft = Math.abs((b.x + b.width) - a.x);
      if (bRightALeft <= tolerance) {
        const overlapTop = Math.max(a.y, b.y);
        const overlapBot = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBot - overlapTop > 10) {
          skippable.add(`${i}-left`);
        }
      }

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

/** Small overcut distance (mm) to guarantee full separation */
const OVERCUT = 2.0;

/**
 * Generate contour cut for a single piece.
 * 
 * Structure:
 *   1. Rapid to lead-in point (OUTSIDE contour, above piece top edge)
 *   2. Ramp descent to cutting depth at lead-in point
 *   3. Linear move to contour start point (entry into contour)
 *   4. Complete closed-loop contour (returns to contour start + overcut)
 *   5. Lead-out move to point OUTSIDE contour
 *   6. Retract to safe Z
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

  // Contour rectangle (with tool compensation)
  const x1 = -(piece.x + piece.width) - halfFresa;  // left
  const x2 = -piece.x + halfFresa;                   // right
  const y1 = piece.y - halfFresa;                     // bottom
  const y2 = piece.y + piece.height + halfFresa;      // top

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zRapidoAutoCalc ? espessura + pp.zRapidoOffset : pp.zRapido;

  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;
  const feedLeadOut = pp.avancoLeadOut || feedEntry;

  // Contour start point: middle of top edge
  const contourStartX = (x1 + x2) / 2;
  const contourStartY = y2;

  // Lead-in/out along X axis (along top edge), NOT perpendicular
  // Reference pattern: lead-in is LEFT of contour start (more negative X),
  // ramp diagonally to contour start, loop closes past start, lead-out retraces back
  const leadDistance = pp.leadOutDistance;
  const leadInX = contourStartX - leadDistance;  // LEFT of contour start (along top edge)
  const leadInY = contourStartY;                 // SAME Y as top edge

  if (pp.tipo === "mach_cnc") {
    const dimW = piece.rotated ? piece.height : piece.width;
    const dimH = piece.rotated ? piece.width : piece.height;
    lines.push(`(${passLabel} - ${dimW} x ${dimH})`);

    // 1. Rapid to lead-in point (OUTSIDE contour)
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zSeguro)}`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zRapido)}`);

    // 2. Ramp descent at lead-in point (OUTSIDE contour)
    if (zDepth > 0) {
      lines.push(`(Step:1/2)`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedEntry)}`);
    } else {
      lines.push(`(Step:${pp.usarDoisPasses ? "2/2" : "1/1"})`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(pp.usarDoisPasses ? feedEntry * 0.7 : feedEntry)}`);
    }

    // 3. Linear entry: lead-in → contour start (at cutting depth)
    lines.push(`G1 X${f4(contourStartX)}Y${f4(contourStartY)}Z${f4(zDepth)}F${f4(feedCut)}`);

    // 4. Complete closed-loop contour
    lines.push(`G1 X${f4(x2 - R)}Y${f4(y2)}Z${f4(zDepth)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1 Y${f4(y1 + R)}`);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}`);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1 Y${f4(y2 - R)}`);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    // Close loop: continue past contour start to lead-in point (overcut along X)
    lines.push(`G1 X${f4(leadInX)}`);

    // 5. Lead-out: retrace along X back to contour start point
    lines.push(`G1 X${f4(contourStartX)} F${f4(feedLeadOut)}`);

    // 6. Retract to safe Z
    lines.push(`G0 Z${f4(zSeguro)}`);

  } else if (pp.tipo === "aspire") {
    // 1. Rapid to lead-in point (OUTSIDE contour)
    lines.push(`G0 X${f4(leadInX)} Y${f4(leadInY)} `);
    lines.push(`G0   Z${f4(zSeguro)}`);

    // 2. Helical ramp at lead-in point (OUTSIDE contour)
    lines.push(`G1   Z${f4(zRapido)} F${f4(feedEntry)}`);
    generateHelicalRamp(lines, leadInX, leadInY, zRapido, zDepth, pp, feedEntry, f4);

    // 3. Linear entry: lead-in → contour start
    lines.push(`G1 X${f4(contourStartX)} Y${f4(contourStartY)} Z${f4(zDepth)} F${f4(feedCut)}`);

    // 4. Complete closed-loop contour
    lines.push(`G1 X${f4(x2 - R)} Z${f4(zDepth)} F${f4(feedCut)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1  Y${f4(y1 + R)}  `);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}   `);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1  Y${f4(y2 - R)}  `);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    // Close loop: continue past contour start to lead-in point (overcut along X)
    lines.push(`G1 X${f4(leadInX)}   `);

    // 5. Lead-out: retrace along X back to contour start point
    lines.push(`G1 X${f4(contourStartX)} F${f4(feedLeadOut || feedEntry)}`);

    // 6. Retract
    lines.push(`G0   Z${f4(zSeguro)}`);

  } else {
    // SmartCut: consistent 3-decimal format matching production files
    // 1. Rapid to lead-in point (OUTSIDE contour, above top edge)
    lines.push(`G0 X${f(leadInX)} Y${f(leadInY)}`);
    lines.push(`G0 Z${f(zRapido)}`);

    // 2. Diagonal ramp descent at lead-in (OUTSIDE → contour start)
    lines.push(`G1 X${f(contourStartX)} Y${f(contourStartY)} Z${f(zDepth)} F${f(feedEntry)}`);

    // 3. Complete closed-loop contour (start at contourStart, full rectangle, back to start)
    lines.push(`G1 X${f(x2 - R)} F${f(feedCut)}`);
    lines.push(`G2 X${f(x2)} Y${f(y2 - R)} R${f(R)}`);
    lines.push(`G1 Y${f(y1 + R)}`);
    lines.push(`G2 X${f(x2 - R)} Y${f(y1)} R${f(R)}`);
    lines.push(`G1 X${f(x1 + R)}`);
    lines.push(`G2 X${f(x1)} Y${f(y1 + R)} R${f(R)}`);
    lines.push(`G1 Y${f(y2 - R)}`);
    lines.push(`G2 X${f(x1 + R)} Y${f(y2)} R${f(R)}`);
    // Close loop: return to contour start + overcut
    lines.push(`G1 X${f(contourStartX + OVERCUT)}`);

    // 4. Lead-out: exit OUTSIDE contour
    lines.push(`G1 X${f(leadInX)} Y${f(leadInY)} F${f(feedLeadOut)}`);

    // 5. Retract to safe Z
    lines.push(`G0 Z${f(zSeguro)}`);
  }
}
