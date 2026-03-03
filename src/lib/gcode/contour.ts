/**
 * G-code contour cutting operations generator.
 * Supports SmartCut diagonal ramp, Mach CNC two-pass, and Aspire helical ramp.
 */
import { PlacedNestingPiece } from "@/types/promob";
import { ToolSlot } from "@/types/toolMagazine";
import { PostProcessorConfig } from "@/types/postProcessor";

/**
 * Generate helical ramp entry (Aspire pattern).
 * 30 micro-steps descending in a circle of radius 3mm while plunging to cut depth.
 */
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
  const radius = 3.0; // ramp radius

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

/**
 * Generate arc command based on post-processor format.
 * R-format: G2 X... Y... R3.000
 * IJ-format: G2 X... Y... I0.0000 J3.0000
 */
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
 * Follows the exact patterns found in production files.
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

  // Piece rectangle in machine coordinates (X negative, offset by fresa radius)
  const x1 = -(piece.x + piece.width) - halfFresa; // left
  const x2 = -piece.x + halfFresa;                  // right  
  const y1 = piece.y - halfFresa;                    // bottom
  const y2 = piece.y + piece.height + halfFresa;     // top

  const zSeguro = pp.zSeguroAutoCalc ? espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zSeguroAutoCalc ? espessura : pp.zRapido;

  const feedEntry = pp.avancoEntradaOverride || tool.avancoEntrada;
  const feedCut = pp.avancoCorteOverride || tool.avancoCorte;
  const feedLeadOut = pp.avancoLeadOut || feedEntry;

  // Lead-in point: middle of top edge
  const leadInX = (x1 + x2) / 2;
  const leadInY = y2;

  if (pp.tipo === "mach_cnc") {
    // === Mach CNC pattern: metadata comment, Step labels ===
    const dimW = piece.rotated ? piece.height : piece.width;
    const dimH = piece.rotated ? piece.width : piece.height;
    lines.push(`(${passLabel} - ${dimW} x ${dimH})`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY - 14.7)}Z${f4(zSeguro)}`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY - 14.7)}Z${f4(zRapido)}`);

    // Entry ramp: diagonal
    if (zDepth > 0) {
      // Pre-cut pass (Step 1/2): Z above surface  
      lines.push(`(Step:1/2)`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedEntry)}`);
    } else {
      // Final pass or single pass
      lines.push(`(Step:${pp.usarDoisPasses ? "2/2" : "1/1"})`);
      lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(pp.usarDoisPasses ? feedEntry * 0.7 : feedEntry)}`);
    }

    // Contour: rectangle with R3 corners
    lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedCut)}`);
    
    // Clockwise rectangle: top-right -> right -> bottom-right -> bottom -> bottom-left -> left -> top-left -> back
    lines.push(`G1 X${f4(x2 - R)}Y${f4(y2)}Z${f4(zDepth)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1 Y${f4(y1 + R)}`);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}`);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1 Y${f4(y2 - R)}`);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    lines.push(`G1 X${f4(leadInX)}`);

    // Lead-out with reduced feed
    lines.push(`G1 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zDepth)}F${f4(feedLeadOut)}`);
    lines.push(`G0 X${f4(leadInX)}Y${f4(leadInY)}Z${f4(zSeguro)}`);

  } else if (pp.tipo === "aspire") {
    // === Aspire pattern: helical ramp, I/J arcs ===
    lines.push(`G0 X${f4(leadInX)} Y${f4(leadInY)} `);
    lines.push(`G0   Z${f4(zSeguro)}`);

    // Helical ramp entry
    lines.push(`G1   Z${f4(zRapido)} F${f4(feedEntry)}`);
    generateHelicalRamp(lines, leadInX, leadInY, zRapido, zDepth, pp, feedEntry, f4);

    // Move to the start of the lead-in
    lines.push(`G1 X${f4(leadInX)} Z${f4(zDepth)} `);

    // Contour with I/J arcs
    lines.push(`G1 X${f4(x2 - R)}  Z${f4(zDepth)} F${f4(feedCut)}`);
    lines.push(arcCmd("G2", x2, y2 - R, x2 - R, y2, x2 - R, y2 - R, R, pp, f4));
    lines.push(`G1  Y${f4(y1 + R)}  `);
    lines.push(arcCmd("G2", x2 - R, y1, x2, y1 + R, x2 - R, y1 + R, R, pp, f4));
    lines.push(`G1 X${f4(x1 + R)}   `);
    lines.push(arcCmd("G2", x1, y1 + R, x1 + R, y1, x1 + R, y1 + R, R, pp, f4));
    lines.push(`G1  Y${f4(y2 - R)}  `);
    lines.push(arcCmd("G2", x1 + R, y2, x1, y2 - R, x1 + R, y2 - R, R, pp, f4));
    lines.push(`G1 X${f4(leadInX)}   `);

    // Lead-out
    lines.push(`G0   Z${f4(zSeguro)}`);

  } else {
    // === SmartCut pattern: diagonal ramp, R arcs ===
    lines.push(`G0 X${f(leadInX)} Y${f1(leadInY)}`);
    lines.push(`G0 Z${f1(zRapido)}`);

    // Diagonal ramp entry
    lines.push(`G1 X${f(leadInX + pp.leadOutDistance)} Z${f(zDepth)} F${f(feedEntry)}`);

    // Contour with R-format arcs
    lines.push(`G1 X${f(x2 - R)} F${f(feedCut)}`);
    lines.push(`G2 X${f(x2)} Y${f1(y2 - R)} R${f(R)}`);
    lines.push(`G1 Y${f1(y1 + R)}`);
    lines.push(`G2 X${f(x2 - R)} Y${f1(y1)} R${f(R)}`);
    lines.push(`G1 X${f(x1 + R)}`);
    lines.push(`G2 X${f(x1)} Y${f1(y1 + R)} R${f(R)}`);
    lines.push(`G1 Y${f1(y2 - R)}`);
    lines.push(`G2 X${f(x1 + R)} Y${f1(y2)} R${f(R)}`);
    lines.push(`G1 X${f(leadInX)}`);

    // Lead-out
    lines.push(`G1 X${f(leadInX - pp.leadOutDistance)} F${f(feedLeadOut)}`);
    lines.push(`G0 Z${f1(zSeguro)}`);
  }
}
