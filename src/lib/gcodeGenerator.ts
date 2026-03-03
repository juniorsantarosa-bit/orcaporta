import { GCodeConfig, DEFAULT_GCODE_CONFIG, NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";

/**
 * G-code generator following SmartCut pattern:
 * 1. Header (%, G0 G53 Z0.0, M752)
 * 2. Furação B3mm (T2) - all 3mm holes
 * 3. Furação B5mm (T2) - 5mm holes (same tool, different depth)
 * 4. Furação B15mm (T4) - 15mm holes (dobradiças)
 * 5. Corte Small P1 (T1) - first pass for small pieces (Z1.0)
 * 6. Corte Small (T1) - second pass for small pieces (Z-0.1)
 * 7. Corte (T1) - single pass for large pieces (Z-0.1)
 * 8. Footer (M5, G0 G53 Z0.0, M750, M30, %)
 */
export function generateGCode(
  sheet: NestingSheet,
  config: GCodeConfig = DEFAULT_GCODE_CONFIG
): string {
  const lines: string[] = [];
  const f = (n: number) => n.toFixed(3);
  const f1 = (n: number) => n.toFixed(1);

  // Collect all holes grouped by diameter
  const allHoles: { piece: PlacedNestingPiece; hole: PromobHole; absX: number; absY: number }[] = [];

  for (const piece of sheet.pieces) {
    if (!piece.furos) continue;
    for (const hole of piece.furos) {
      // Transform hole coordinates to sheet absolute coordinates
      // The piece origin is at bottom-left of the placed piece
      // Sheet origin (machine) is at back-left
      let absX: number, absY: number;

      if (piece.rotated) {
        absX = -(piece.x + hole.Y);
        absY = piece.y + hole.X;
      } else {
        absX = -(piece.x + hole.X);
        absY = piece.y + hole.Y;
      }

      allHoles.push({ piece, hole, absX, absY });
    }
  }

  // Group holes by diameter
  const holes3mm = allHoles.filter(h => h.hole.DIAM === 3.0);
  const holes5mm = allHoles.filter(h => h.hole.DIAM === 5.0);
  const holes15mm = allHoles.filter(h => h.hole.DIAM >= 15.0);
  const holesOther = allHoles.filter(h => h.hole.DIAM !== 3.0 && h.hole.DIAM !== 5.0 && h.hole.DIAM < 15.0);

  // Classify pieces as small or large
  const smallPieces = sheet.pieces.filter(p =>
    p.width <= config.larguraPequena || (p.width * p.height) <= config.areaPequena
  );
  const largePieces = sheet.pieces.filter(p =>
    p.width > config.larguraPequena && (p.width * p.height) > config.areaPequena
  );

  // === HEADER ===
  lines.push("%");
  lines.push("G0 G53 Z0.0");
  lines.push(config.mInicio);

  // === FURAÇÃO B3mm ===
  if (holes3mm.length > 0) {
    lines.push("(#### Furação B3mm ####)");
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: Broca 3mm - 3.00mm ####)`);
    lines.push(`M6 T${config.toolBroca3mm}`);
    lines.push(`M3 S${config.rpmBroca3mm}`);

    let firstHole = true;
    for (const h of holes3mm) {
      lines.push(`G0 X${f(h.absX)} Y${f1(h.absY)}`);
      lines.push(`G0 Z${f1(config.zRapido)}`);
      // Z depth: for face INF through the material, for face SUP partial
      const zDepth = h.hole.FACE === "INF"
        ? -(h.hole.Z - sheet.espessura)  // goes through
        : sheet.espessura - h.hole.Z;     // partial from top
      if (firstHole) {
        lines.push(`G1 Z${f1(zDepth)} F${f(config.avancoBroca)}`);
        firstHole = false;
      } else {
        lines.push(`G1 Z${f1(zDepth)}`);
      }
      lines.push(`G0 Z${f1(config.zSeguro)}`);
    }
  }

  // === FURAÇÃO B5mm ===
  if (holes5mm.length > 0) {
    lines.push("(#### Furação B5mm ####)");
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: Broca 5mm - 5.00mm ####)`);
    // Same tool T2 but could be different
    lines.push(`M6 T${config.toolBroca3mm}`);
    lines.push(`M3 S${config.rpmBroca3mm}`);

    let firstHole = true;
    for (const h of holes5mm) {
      lines.push(`G0 X${f(h.absX)} Y${f1(h.absY)}`);
      lines.push(`G0 Z${f1(config.zRapido)}`);
      const zDepth = h.hole.FACE === "INF"
        ? -(h.hole.Z - sheet.espessura)
        : sheet.espessura - h.hole.Z;
      if (firstHole) {
        lines.push(`G1 Z${f1(zDepth)} F${f(config.avancoBroca)}`);
        firstHole = false;
      } else {
        lines.push(`G1 Z${f1(zDepth)}`);
      }
      lines.push(`G0 Z${f1(config.zSeguro)}`);
    }
  }

  // === FURAÇÃO B15mm (dobradiças) ===
  if (holes15mm.length > 0) {
    lines.push("(#### Furação B15mm ####)");
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: Broca 15mm - 15.00mm ####)`);
    lines.push(`M6 T${config.toolBroca15mm}`);
    lines.push(`M3 S${config.rpmBroca15mm}`);

    let firstHole = true;
    for (const h of holes15mm) {
      lines.push(`G0 X${f(h.absX)} Y${f1(h.absY)}`);
      lines.push(`G0 Z${f1(config.zRapido)}`);
      const zDepth = h.hole.FACE === "INF"
        ? -(h.hole.Z - sheet.espessura)
        : sheet.espessura - h.hole.Z;
      if (firstHole) {
        lines.push(`G1 Z${f1(zDepth)} F${f(config.avancoBroca)}`);
        firstHole = false;
      } else {
        lines.push(`G1 Z${f1(zDepth)}`);
      }
      lines.push(`G0 Z${f1(config.zSeguro)}`);
    }
  }

  // === CORTE (contour cutting with fresa) ===
  lines.push("(#### TROCA DE FERRAMENTAS ####)");
  lines.push(`(#### FERRAMENTA: Fresa ${config.fresaDiametro}x22mm - ${f1(config.fresaDiametro / 10 * 10)}mm ####)`);
  lines.push(`M6 T${config.toolFresa6mm}`);
  lines.push(`M3 S${config.rpmFresa6mm}`);

  // Small pieces - two passes
  if (config.usarDoisPasses && smallPieces.length > 0) {
    lines.push("(#### Corte Small P1 ####)");
    for (const piece of smallPieces) {
      generatePieceContourCut(lines, piece, config, config.passePrimeiroProfundidade, f, f1);
    }
    lines.push("(#### Corte Small ####)");
    for (const piece of smallPieces) {
      generatePieceContourCut(lines, piece, config, config.passeSegundoProfundidade, f, f1);
    }
  }

  // Large pieces - single pass
  if (largePieces.length > 0) {
    lines.push("(#### Corte ####)");
    for (const piece of largePieces) {
      generatePieceContourCut(lines, piece, config, config.passeSegundoProfundidade, f, f1);
    }
  }

  // All pieces single pass if no dois passes
  if (!config.usarDoisPasses) {
    lines.push("(#### Corte ####)");
    for (const piece of sheet.pieces) {
      generatePieceContourCut(lines, piece, config, config.passeSegundoProfundidade, f, f1);
    }
  }

  // === FOOTER ===
  lines.push("M5");
  lines.push("G0 G53 Z0.0");
  lines.push(config.mFim);
  lines.push("M30");
  lines.push("%");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate contour cut for a single piece with helical ramp entry
 * Following SmartCut pattern exactly
 */
function generatePieceContourCut(
  lines: string[],
  piece: PlacedNestingPiece,
  config: GCodeConfig,
  zDepth: number,
  f: (n: number) => string,
  f1: (n: number) => string
) {
  const R = config.raioContorno;
  const halfFresa = config.fresaDiametro / 2;

  // Piece rectangle in machine coordinates (offset by fresa radius for compensation)
  const x1 = -(piece.x + piece.width) - halfFresa; // left
  const x2 = -piece.x + halfFresa;                 // right  
  const y1 = piece.y - halfFresa;                   // bottom
  const y2 = piece.y + piece.height + halfFresa;    // top

  // Lead-in point (middle of top edge for entry)
  const leadInX = (x1 + x2) / 2;
  const leadInY = y2;

  // Entry ramp approach point
  const rampStartX = leadInX;
  const rampStartY = y2;

  if (config.entradaRampa === "helicoidal") {
    // Helical ramp entry (following SmartCut pattern)
    // Approach above the ramp start point
    lines.push(`G0 X${f(rampStartX)} Y${f1(rampStartY)}`);
    lines.push(`G0 Z${f1(config.zRapido)}`);

    // Helical descent over 10 steps
    const steps = 10;
    const zStart = config.zRapido;
    const zEnd = zDepth;
    const arcRadius = R;

    // Generate helical ramp as series of small linear moves with Z descent
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const z = zStart + (zEnd - zStart) * t;
      const angle = (t * Math.PI * 2);
      const dx = Math.sin(angle) * arcRadius;
      const dy = (1 - Math.cos(angle)) * arcRadius;
      
      if (i === 0) {
        lines.push(`G1 X${f(rampStartX + dx)} Y${f1(rampStartY + dy)} Z${f(z)} F${f(config.avancoEntrada)}`);
      } else {
        lines.push(`G1 X${f(rampStartX + dx)} Y${f1(rampStartY + dy)} Z${f(z)}`);
      }
    }

    // Now at cutting depth, move to lead-in point
    lines.push(`G1 X${f(leadInX)} Z${f1(zDepth)}`);
  } else {
    // Diagonal ramp entry (Aspire style)
    lines.push(`G0 X${f(rampStartX)} Y${f1(rampStartY)}`);
    lines.push(`G0 Z${f1(config.zRapido)}`);
    lines.push(`G1 X${f(leadInX)} Z${f(zDepth)} F${f(config.avancoEntrada)}`);
  }

  // Cut contour: clockwise rectangle with rounded corners
  // Right side (top to right corner)
  lines.push(`G1 X${f(x2 - R)} F${f(config.avancoCorteRapido)}`);
  lines.push(`G2 X${f(x2)} Y${f1(y2 - R)} R${f(R)}`);
  
  // Right side down
  lines.push(`G1 Y${f1(y1 + R)}`);
  lines.push(`G2 X${f(x2 - R)} Y${f1(y1)} R${f(R)}`);
  
  // Bottom side
  lines.push(`G1 X${f(x1 + R)}`);
  lines.push(`G2 X${f(x1)} Y${f1(y1 + R)} R${f(R)}`);
  
  // Left side up
  lines.push(`G1 Y${f1(y2 - R)}`);
  lines.push(`G2 X${f(x1 + R)} Y${f1(y2)} R${f(R)}`);
  
  // Close back to lead-in
  lines.push(`G1 X${f(leadInX)}`);

  // Lead-out
  lines.push(`G1 X${f(leadInX - 50)} F${f(config.avancoEntrada)}`);
  lines.push(`G0 Z${f1(config.zSeguro)}`);
}

/**
 * Generate G-code filename following SmartCut convention
 * e.g., "0001_Branco_TX_15mm.nc"
 */
export function generateGCodeFilename(
  sheetIndex: number,
  material: string
): string {
  const idx = String(sheetIndex + 1).padStart(4, "0");
  const matName = material
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return `${idx}_${matName}.nc`;
}
