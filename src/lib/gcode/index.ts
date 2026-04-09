/**
 * Main G-code generator orchestrator.
 * Combines drilling + contour operations with proper tool sequencing.
 * Supports SmartCut, Mach CNC, and Aspire post-processors.
 * 
 * Key behaviors:
 * - Dynamic zRapido based on material thickness (espessura + offset)
 * - Consistent 3-decimal formatting for SmartCut
 * - Deduplication of usinagens
 * - No redundant tool changes when same fresa used for usinagens + contour
 */
import { NestingSheet, Usinagem } from "@/types/promob";
import { ToolMagazine, getMainFresa, DEFAULT_TOOL_MAGAZINE } from "@/types/toolMagazine";
import { PostProcessorConfig, SMARTCUT_CONFIG, POST_PROCESSORS, PostProcessorType } from "@/types/postProcessor";
import { collectHoles, groupHolesByDiameter, generateDrillingBlock } from "./drilling";
import { generatePieceContour } from "./contour";

const f = (n: number) => n.toFixed(3);
const f1 = (n: number) => n.toFixed(1);
const f4 = (n: number) => n.toFixed(4);

export interface GenerateOptions {
  postProcessor?: PostProcessorType;
  magazine?: ToolMagazine;
  /** Gap between pieces in mm */
  gap?: number;
}

/** Compute dynamic zRapido */
function computeZRapido(pp: PostProcessorConfig, espessura: number): number {
  if (pp.zRapidoAutoCalc) return espessura + pp.zRapidoOffset;
  return pp.zRapido;
}

/** Compute dynamic zSeguro */
function computeZSeguro(pp: PostProcessorConfig, espessura: number): number {
  if (pp.zSeguroAutoCalc) return espessura + pp.zSeguroOffset;
  return pp.zSeguro;
}

/** Deduplicate usinagens by comparing coordinates and dimensions */
function deduplicateUsinagens(items: { u: Usinagem; pieceX: number; pieceY: number; label: string; rotated: boolean }[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.u.tipo}_${item.pieceX}_${item.pieceY}_${item.u.x}_${item.u.y}_${item.u.largura}_${item.u.comprimento}_${item.u.profundidade}_${item.rotated}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const lines: string[] = [];

  const zSeguro = computeZSeguro(pp, sheet.espessura);
  const zRapido = computeZRapido(pp, sheet.espessura);
  const fresa = getMainFresa(magazine);

  // === METADATA HEADER (Mach CNC only) ===
  if (pp.includeMetadata) {
    lines.push(`( Powered by MAX CUT )`);
    lines.push(`( Criacao: ${new Date().toISOString().slice(0, 19)} )`);
    lines.push(`( Pos processador:  ${pp.nome} )`);
    lines.push(`( Material:  ${sheet.material} )`);
    lines.push(`( Dimensoes:  X:${f4(sheet.sheetWidth)} Y:${f4(sheet.sheetHeight)} Z:${f4(sheet.espessura)} )`);
    
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

  // === DRILLING OPERATIONS ===
  const allHoles = collectHoles(sheet);
  const holeGroups = groupHolesByDiameter(allHoles);
  const sortedDiameters = Array.from(holeGroups.keys()).sort((a, b) => a - b);
  
  for (const diam of sortedDiameters) {
    generateDrillingBlock(lines, holeGroups.get(diam)!, diam, sheet, magazine, pp, f, f1, f4);
  }

  // === MACHINING OPERATIONS (usinagens: grooves, circular cutouts) ===
  let allUsinagens: { u: Usinagem; pieceX: number; pieceY: number; label: string; rotated: boolean }[] = [];
  sheet.pieces.forEach(piece => {
    if (piece.usinagens && piece.usinagens.length > 0) {
      piece.usinagens.forEach(u => {
        allUsinagens.push({ u, pieceX: piece.x, pieceY: piece.y, label: piece.label || "?", rotated: piece.rotated });
      });
    }
  });

  // Deduplicate usinagens (same piece, same coords, same dimensions)
  allUsinagens = deduplicateUsinagens(allUsinagens);

  // Track if we already did a tool change for the fresa
  let fresaToolChangeEmitted = false;

  if (allUsinagens.length > 0) {
    // Tool change for fresa
    if (pp.tipo === "smartcut") {
      lines.push("(#### TROCA DE FERRAMENTAS ####)");
      lines.push(`(#### FERRAMENTA: ${fresa.nome} - ${fresa.diametro.toFixed(2)}mm ####)`);
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
    fresaToolChangeEmitted = true;

    if (pp.tipo === "mach_cnc") lines.push(`( === USINAGENS: ${allUsinagens.length} operações === )`);
    else lines.push(`(=== Usinagens ===)`);
    lines.push("");

    const feedEntry = pp.avancoEntradaOverride || fresa.avancoEntrada;
    const feedCut = pp.avancoCorteOverride || fresa.avancoCorte;

    for (let ui = 0; ui < allUsinagens.length; ui++) {
      const { u, pieceX, pieceY, label, rotated } = allUsinagens[ui];
      const ux = rotated ? -(pieceX + (u.y || 0)) : -(pieceX + (u.x || 0));
      const uy = rotated ? pieceY + (u.x || 0) : pieceY + (u.y || 0);
      const maxDepth = -(sheet.espessura + 0.1);
      const clampDepth = (raw: number) => Math.max(raw, maxDepth);

      if (u.tipo === "recorte_circular") {
        const r = (u.largura || 0) / 2;
        const circDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        lines.push(`( Recorte Circular Ø${u.largura}mm prof.${Math.abs(circDepth).toFixed(1)}mm - Peça ${label} )`);
        lines.push(`G0 X${f(ux - r)} Y${f(uy)} Z${f(zSeguro)}`);
        lines.push(`G1 Z${f(circDepth)} F${f(feedEntry)}`);
        lines.push(`G2 X${f(ux - r)} Y${f(uy)} I${f(r)} J0 F${f(feedCut)}`);
        lines.push(`G0 Z${f(zSeguro)}`);
        lines.push("");
      } else if (u.tipo === "recorte_retangular") {
        const w = u.comprimento || u.largura;
        const h = u.largura;
        const grooveDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        lines.push(`( Recorte Retangular ${w}mm×${h}mm prof.${Math.abs(grooveDepth).toFixed(1)}mm - Peça ${label} )`);
        const x1 = ux, y1 = uy;
        const x2 = ux - w, y2 = uy + h;
        lines.push(`G0 X${f(x1)} Y${f(y1)} Z${f(zSeguro)}`);
        lines.push(`G1 Z${f(grooveDepth)} F${f(feedEntry)}`);
        lines.push(`G1 X${f(x2)} Y${f(y1)} F${f(feedCut)}`);
        lines.push(`G1 X${f(x2)} Y${f(y2)} F${f(feedCut)}`);
        lines.push(`G1 X${f(x1)} Y${f(y2)} F${f(feedCut)}`);
        lines.push(`G1 X${f(x1)} Y${f(y1)} F${f(feedCut)}`);
        lines.push(`G0 Z${f(zSeguro)}`);
        lines.push("");
      } else {
        const gLen = u.comprimento || u.largura;
        const endX = ux - gLen;
        const grooveDepth = u.passante ? maxDepth : clampDepth(-(u.profundidade || 0));
        const tipoLabel = u.tipo === "canal" ? "Canal" : u.tipo === "rebaixo" ? "Rebaixo" : "Usinagem";
        lines.push(`( ${tipoLabel} ${u.largura}mm×${gLen}mm prof.${Math.abs(grooveDepth).toFixed(1)}mm - Peça ${label} )`);
        lines.push(`G0 X${f(ux)} Y${f(uy)} Z${f(zSeguro)}`);
        lines.push(`G1 Z${f(grooveDepth)} F${f(feedEntry)}`);
        lines.push(`G1 X${f(endX)} Y${f(uy)} F${f(feedCut)}`);
        lines.push(`G0 Z${f(zSeguro)}`);
        lines.push("");
      }
    }
  }

  // === CONTOUR CUTTING ===
  // Only emit tool change if we haven't already (same fresa for usinagens + contour)
  if (!fresaToolChangeEmitted) {
    if (pp.tipo === "smartcut") {
      lines.push("(#### TROCA DE FERRAMENTAS ####)");
      lines.push(`(#### FERRAMENTA: ${fresa.nome} - ${fresa.diametro.toFixed(2)}mm ####)`);
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
  }

  // === INDIVIDUAL CONTOURS ===
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

  // Two-pass for small pieces
  if (pp.usarDoisPasses && smallPieces.length > 0) {
    if (pp.tipo === "smartcut") lines.push("(#### Corte Small P1 ####)");
    for (const piece of smallPieces) {
      generatePieceContour(lines, piece, fresa, pp, pp.passePreCorte, "PECA_P1", f, f1, f4, sheet.espessura);
    }
    if (pp.tipo === "smartcut") lines.push("(#### Corte Small ####)");
    for (const piece of smallPieces) {
      generatePieceContour(lines, piece, fresa, pp, pp.passeFinal, "PECA", f, f1, f4, sheet.espessura);
    }
  }

  // Single pass for large pieces (or all pieces when no two-pass)
  if (largePieces.length > 0) {
    if (pp.tipo === "smartcut") lines.push("(#### Corte ####)");
    for (const piece of largePieces) {
      generatePieceContour(lines, piece, fresa, pp, pp.passeFinal, "PECA", f, f1, f4, sheet.espessura);
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
