/**
 * Main G-code generator orchestrator.
 * Combines drilling + contour operations with proper tool sequencing.
 * Supports SmartCut, Mach CNC, and Aspire post-processors.
 * Includes Common Cut optimization for shared edges between adjacent pieces.
 */
import { NestingSheet } from "@/types/promob";
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
      generatePartialContour(lines, piece, pieceIdx, skippableEdges, fresa, pp, zDepth, passLabel, f, f1, f4, sheet.espessura);
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
