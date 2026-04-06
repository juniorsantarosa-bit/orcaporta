/**
 * Main G-code generator orchestrator.
 * Combines drilling + contour operations with proper tool sequencing.
 * Supports SmartCut, Mach CNC, and Aspire post-processors.
 * Includes Common Cut optimization for shared edges between adjacent pieces.
 */
import { NestingSheet, Usinagem } from "@/types/promob";
import { ToolMagazine, getMainFresa, DEFAULT_TOOL_MAGAZINE } from "@/types/toolMagazine";
import { PostProcessorConfig, SMARTCUT_CONFIG, POST_PROCESSORS, PostProcessorType } from "@/types/postProcessor";
import { collectHoles, groupHolesByDiameter, generateDrillingBlock } from "./drilling";
import { generatePieceContour } from "./contour";
import { detectSharedEdges, generateCommonCutGCode, generatePartialContour } from "./commonCut";

const f = (n: number) => n.toFixed(3);
const f1 = (n: number) => n.toFixed(1);
const f4 = (n: number) => n.toFixed(4);

export interface GenerateOptions {
  postProcessor?: PostProcessorType;
  magazine?: ToolMagazine;
  /** Enable common cut optimization (default: true) */
  useCommonCut?: boolean;
  /** Gap between pieces in mm (for common cut detection) */
  gap?: number;
}

/**
 * Generate complete G-code for a nesting sheet.
 */
export function generateGCode(
  sheet: NestingSheet,
  options: GenerateOptions = {},
): string {
  const ppType = options.postProcessor || "smartcut";
  const pp = POST_PROCESSORS[ppType];
  const magazine = options.magazine || DEFAULT_TOOL_MAGAZINE;
  const useCommonCut = options.useCommonCut !== false; // default true
  const gap = options.gap || 6;
  const lines: string[] = [];

  const zSeguro = pp.zSeguroAutoCalc ? sheet.espessura + pp.zSeguroOffset : pp.zSeguro;

  // === DETECT COMMON CUTS ===
  const fresa = getMainFresa(magazine);
  const { sharedEdges, skippableEdges } = useCommonCut
    ? detectSharedEdges(sheet.pieces, gap, fresa.diametro)
    : { sharedEdges: [], skippableEdges: new Set<string>() };

  // === METADATA HEADER (Mach CNC only) ===
  if (pp.includeMetadata) {
    lines.push(`( Powered by MAX CUT )`);
    lines.push(`( Criacao: ${new Date().toISOString().slice(0, 19)} )`);
    lines.push(`( Pos processador:  ${pp.nome} )`);
    lines.push(`( Material:  ${sheet.material} )`);
    lines.push(`( Dimensoes:  X:${f4(sheet.sheetWidth)} Y:${f4(sheet.sheetHeight)} Z:${f4(sheet.espessura)} )`);
    
    if (useCommonCut && sharedEdges.length > 0) {
      lines.push(`( Common Cut: ${sharedEdges.length} cortes compartilhados )`);
    }
    
    // List tools that will be used
    const usedTools = new Set<number>();
    const allHoles = collectHoles(sheet);
    const groups = groupHolesByDiameter(allHoles);
    
    for (const [diam] of groups) {
      const tool = magazine.slots.find(s => s.ativo && s.diametro === diam && s.tipo === "broca");
      if (tool) usedTools.add(tool.position);
    }
    
    usedTools.add(fresa.position);
    
    lines.push(`( Ferramentas para execucao: )`);
    for (const pos of Array.from(usedTools).sort((a, b) => a - b)) {
      const slot = magazine.slots.find(s => s.position === pos);
      if (slot) lines.push(`( ${slot.position} - ${slot.nome} )`);
    }
    lines.push("");
  }

  // === HEADER ===
  for (const line of pp.headerLines) {
    lines.push(line);
  }
  lines.push("");

  // === DRILLING OPERATIONS ===
  const allHoles = collectHoles(sheet);
  const holeGroups = groupHolesByDiameter(allHoles);

  // Sort by diameter (small brocas first)
  const sortedDiameters = Array.from(holeGroups.keys()).sort((a, b) => a - b);
  
  for (const diam of sortedDiameters) {
    generateDrillingBlock(lines, holeGroups.get(diam)!, diam, sheet, magazine, pp, f, f1, f4);
  }

  // === MACHINING OPERATIONS (usinagens: grooves, circular cutouts) ===
  // After drilling, before contour cuts — standard CNC workflow
  const allUsinagens: { u: Usinagem; pieceX: number; pieceY: number; label: string; rotated: boolean }[] = [];
  sheet.pieces.forEach(piece => {
    if (piece.usinagens && piece.usinagens.length > 0) {
      piece.usinagens.forEach(u => {
        allUsinagens.push({ u, pieceX: piece.x, pieceY: piece.y, label: piece.label || "?", rotated: piece.rotated });
      });
    }
  });

  if (allUsinagens.length > 0) {
    // Tool change for fresa (same tool for machining)
    if (pp.tipo === "smartcut") {
      lines.push("(#### TROCA DE FERRAMENTAS ####)");
      lines.push(`(#### FERRAMENTA: ${fresa.nome} - ${f1(fresa.diametro)}mm ####)`);
      lines.push(`M6 T${fresa.position}`);
      lines.push(`M3 S${fresa.rpm}`);
    } else if (pp.tipo === "mach_cnc") {
      lines.push(`( FERRAMENTA: ${fresa.position} - ${fresa.nome} )`);
      lines.push("");
      lines.push(`M6 T${fresa.position}`);
      lines.push(`M3 S${f4(fresa.rpm)}`);
      lines.push("");
    } else {
      lines.push(`(########_Troca_de_Ferramentas_########)`);
      lines.push(`(Numero_da_Ferramenta:${fresa.position})`);
      lines.push(`(Descricao:${fresa.nome})`);
      lines.push(` `);
      lines.push(`M6 T${fresa.position}`);
      lines.push(`M3 S${fresa.rpm}`);
      lines.push(` `);
    }

    const zSeguroVal = pp.zSeguroAutoCalc ? sheet.espessura + pp.zSeguroOffset : pp.zSeguro;
    const feedEntry = pp.avancoEntradaOverride || fresa.avancoEntrada;
    const feedCut = pp.avancoCorteOverride || fresa.avancoCorte;

    if (pp.tipo === "mach_cnc") lines.push(`( === USINAGENS: ${allUsinagens.length} operações === )`);
    else lines.push(`(=== Usinagens ===)`);
    lines.push("");

    for (let ui = 0; ui < allUsinagens.length; ui++) {
      const { u, pieceX, pieceY, label, rotated } = allUsinagens[ui];
      // Handle rotation: swap X/Y coordinates for rotated pieces
      const ux = rotated ? -(pieceX + (u.y || 0)) : -(pieceX + (u.x || 0));
      const uy = rotated ? pieceY + (u.x || 0) : pieceY + (u.y || 0);
      // Max allowed depth: sheet thickness + 0.1mm (mesa de sacrifício limit)
      const maxDepth = -(sheet.espessura + 0.1);

      // Clamp depth: never exceed maxDepth (more negative = deeper)
      const clampDepth = (raw: number) => Math.max(raw, maxDepth);

      if (u.tipo === "recorte_circular") {
        const r = (u.largura || 0) / 2;
        const circDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        lines.push(`( Recorte Circular Ø${u.largura}mm prof.${Math.abs(circDepth).toFixed(1)}mm - Peça ${label} )`);
        
        // Move to entry point (edge of circle)
        lines.push(`G0 X${f4(ux - r)} Y${f4(uy)} Z${f4(zSeguroVal)}`);
        lines.push(`G1 Z${f4(circDepth)} F${f4(feedEntry)}`);
        // Circular interpolation G2 (clockwise)
        lines.push(`G2 X${f4(ux - r)} Y${f4(uy)} I${f4(r)} J0 F${f4(feedCut)}`);
        lines.push(`G0 Z${f4(zSeguroVal)}`);
        lines.push("");
      } else if (u.tipo === "recorte_retangular") {
        // Rectangular cutout — trace full perimeter
        const w = u.comprimento || u.largura;
        const h = u.largura;
        const grooveDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        
        lines.push(`( Recorte Retangular ${w}mm×${h}mm prof.${Math.abs(grooveDepth).toFixed(1)}mm - Peça ${label} )`);
        
        // Start at corner, plunge, trace 4 sides
        const x1 = ux, y1 = uy;
        const x2 = ux - w, y2 = uy + h; // Mirror X
        
        lines.push(`G0 X${f4(x1)} Y${f4(y1)} Z${f4(zSeguroVal)}`);
        lines.push(`G1 Z${f4(grooveDepth)} F${f4(feedEntry)}`);
        lines.push(`G1 X${f4(x2)} Y${f4(y1)} F${f4(feedCut)}`);
        lines.push(`G1 X${f4(x2)} Y${f4(y2)} F${f4(feedCut)}`);
        lines.push(`G1 X${f4(x1)} Y${f4(y2)} F${f4(feedCut)}`);
        lines.push(`G1 X${f4(x1)} Y${f4(y1)} F${f4(feedCut)}`);
        lines.push(`G0 Z${f4(zSeguroVal)}`);
        lines.push("");
      } else {
        // Canal/groove — linear cut
        const gLen = u.comprimento || u.largura;
        const endX = ux - gLen; // Mirror
        const grooveDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        
        const tipoLabel = u.tipo === "canal" ? "Canal" : u.tipo === "rebaixo" ? "Rebaixo" : "Usinagem";
        lines.push(`( ${tipoLabel} ${u.largura}mm×${gLen}mm prof.${Math.abs(grooveDepth).toFixed(1)}mm - Peça ${label} )`);
        
        lines.push(`G0 X${f4(ux)} Y${f4(uy)} Z${f4(zSeguroVal)}`);
        lines.push(`G1 Z${f4(grooveDepth)} F${f4(feedEntry)}`);
        lines.push(`G1 X${f4(endX)} Y${f4(uy)} F${f4(feedCut)}`);
        lines.push(`G0 Z${f4(zSeguroVal)}`);
        lines.push("");
      }
    }
  }

  // === CONTOUR CUTTING ===
  // Tool change for fresa
  if (pp.tipo === "smartcut") {
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: ${fresa.nome} - ${f1(fresa.diametro)}mm ####)`);
    lines.push(`M6 T${fresa.position}`);
    lines.push(`M3 S${fresa.rpm}`);
  } else if (pp.tipo === "mach_cnc") {
    lines.push(`( FERRAMENTA: ${fresa.position} - ${fresa.nome} )`);
    lines.push("");
    lines.push(`M6 T${fresa.position} `);
    lines.push(`M3 S${f4(fresa.rpm)}`);
    lines.push("");
  } else {
    lines.push(`(########_Troca_de_Ferramentas_########)`);
    lines.push(`(Numero_da_Ferramenta:${fresa.position})`);
    lines.push(`(Descricao:${fresa.nome})`);
    lines.push(` `);
    lines.push(`M6 T${fresa.position}`);
    lines.push(`M3 S${fresa.rpm}`);
    lines.push(` `);
  }

  // === COMMON CUT LINES (before individual contours) ===
  if (useCommonCut && sharedEdges.length > 0) {
    generateCommonCutGCode(lines, sharedEdges, sheet.pieces, fresa, pp, sheet.espessura, f, f1, f4);
  }

  // === INDIVIDUAL CONTOURS (with shared edges skipped) ===
  // Classify pieces as small or large for two-pass strategy
  const smallPieces = pp.usarDoisPasses
    ? sheet.pieces.filter(p =>
        p.width <= pp.larguraPequena || (p.width * p.height) <= pp.areaPequena
      )
    : [];
  const largePieces = pp.usarDoisPasses
    ? sheet.pieces.filter(p =>
        p.width > pp.larguraPequena && (p.width * p.height) > pp.areaPequena
      )
    : sheet.pieces;

  // Helper to generate contour for a piece, using partial if it has shared edges
  const generateContourForPiece = (piece: typeof sheet.pieces[0], zDepth: number, passLabel: string) => {
    const pieceIdx = sheet.pieces.indexOf(piece);
    const hasSkippable = useCommonCut && (
      skippableEdges.has(`${pieceIdx}-right`) ||
      skippableEdges.has(`${pieceIdx}-left`) ||
      skippableEdges.has(`${pieceIdx}-top`) ||
      skippableEdges.has(`${pieceIdx}-bottom`)
    );

    if (hasSkippable) {
      generatePartialContour(lines, piece, pieceIdx, sharedEdges, fresa, pp, zDepth, passLabel, f, f1, f4, sheet.espessura);
    } else {
      generatePieceContour(lines, piece, fresa, pp, zDepth, passLabel, f, f1, f4, sheet.espessura);
    }
  };

  // Two-pass for small pieces
  if (pp.usarDoisPasses && smallPieces.length > 0) {
    if (pp.tipo === "smartcut") lines.push("(#### Corte Small P1 ####)");
    for (const piece of smallPieces) {
      generateContourForPiece(piece, pp.passePreCorte, "PECA_P1");
    }
    if (pp.tipo === "smartcut") lines.push("(#### Corte Small ####)");
    for (const piece of smallPieces) {
      generateContourForPiece(piece, pp.passeFinal, "PECA");
    }
  }

  // Single pass for large pieces (or all pieces when no two-pass)
  if (largePieces.length > 0) {
    if (pp.tipo === "smartcut") lines.push("(#### Corte ####)");
    for (const piece of largePieces) {
      generateContourForPiece(piece, pp.passeFinal, "PECA");
    }
  }

  // === FOOTER ===
  for (const line of pp.footerLines) {
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Generate G-code filename following convention.
 * SmartCut/Mach: "0001_Branco_TX_15mm.nc"
 * Aspire: "0001_Branco_TX_15mm.tap"
 */
export function generateGCodeFilename(
  sheetIndex: number,
  material: string,
  ppType: PostProcessorType = "smartcut",
): string {
  const pp = POST_PROCESSORS[ppType];
  const idx = String(sheetIndex + 1).padStart(4, "0");
  const matName = material
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return `${idx}_${matName}${pp.extensao}`;
}
