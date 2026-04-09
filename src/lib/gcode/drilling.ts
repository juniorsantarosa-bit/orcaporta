/**
 * G-code drilling operations generator.
 * Generates drilling cycles grouped by tool diameter.
 * Uses dynamic zRapido based on material thickness.
 */
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { ToolMagazine, findToolByDiameter } from "@/types/toolMagazine";
import { PostProcessorConfig } from "@/types/postProcessor";

interface AbsoluteHole {
  piece: PlacedNestingPiece;
  hole: PromobHole;
  absX: number;
  absY: number;
}

/** Collect all holes from placed pieces and transform to absolute sheet coordinates */
export function collectHoles(sheet: NestingSheet): AbsoluteHole[] {
  const result: AbsoluteHole[] = [];
  for (const piece of sheet.pieces) {
    if (!piece.furos) continue;
    for (const hole of piece.furos) {
      let absX: number, absY: number;
      if (piece.rotated) {
        absX = -(piece.x + hole.Y);
        absY = piece.y + hole.X;
      } else {
        absX = -(piece.x + hole.X);
        absY = piece.y + hole.Y;
      }
      result.push({ piece, hole, absX, absY });
    }
  }
  return result;
}

/** Group holes by diameter for efficient tool changes */
export function groupHolesByDiameter(holes: AbsoluteHole[]): Map<number, AbsoluteHole[]> {
  const groups = new Map<number, AbsoluteHole[]>();
  for (const h of holes) {
    const key = h.hole.DIAM;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }
  return groups;
}

/** Compute dynamic zRapido based on post-processor config and material thickness */
function computeZRapido(pp: PostProcessorConfig, espessura: number): number {
  if (pp.zRapidoAutoCalc) return espessura + pp.zRapidoOffset;
  return pp.zRapido;
}

/** Compute dynamic zSeguro based on post-processor config and material thickness */
function computeZSeguro(pp: PostProcessorConfig, espessura: number): number {
  if (pp.zSeguroAutoCalc) return espessura + pp.zSeguroOffset;
  return pp.zSeguro;
}

/** Generate drilling G-code for a group of holes with the same tool */
export function generateDrillingBlock(
  lines: string[],
  holes: AbsoluteHole[],
  diameter: number,
  sheet: NestingSheet,
  magazine: ToolMagazine,
  pp: PostProcessorConfig,
  f: (n: number) => string,
  f1: (n: number) => string,
  f4: (n: number) => string,
) {
  if (holes.length === 0) return;

  const tool = findToolByDiameter(magazine, diameter, "broca");
  if (!tool) return;

  const zSeguro = computeZSeguro(pp, sheet.espessura);
  const zRapido = computeZRapido(pp, sheet.espessura);

  // Section header
  if (pp.tipo === "smartcut") {
    lines.push(`(#### Furação B${Math.round(diameter)}mm ####)`);
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: ${tool.nome} - ${diameter.toFixed(2)}mm ####)`);
    lines.push(`M6 T${tool.position}`);
    lines.push(`M3 S${tool.rpm}`);
  } else if (pp.tipo === "mach_cnc") {
    lines.push(`( FERRAMENTA: ${tool.position} - ${tool.nome} )`);
    lines.push("");
    lines.push(`M6 T${tool.position} `);
    lines.push(`M3 S${f4(tool.rpm)}`);
    lines.push("");
  } else {
    // Aspire
    lines.push(`(########_Troca_de_Ferramentas_########)`);
    lines.push(`(Numero_da_Ferramenta:${tool.position})`);
    lines.push(`(Descricao:${tool.nome})`);
    lines.push(` `);
    lines.push(`M6 T${tool.position}`);
    lines.push(`M3 S${tool.rpm}`);
  }

  let firstHole = true;
  for (const h of holes) {
    // Calculate drill depth based on face
    let zDepth: number;
    if (h.hole.FACE === "INF") {
      // Drilling from bottom: positive Z (into material from below)
      zDepth = sheet.espessura - h.hole.Z;
      // For passante from bottom, go past surface
      if (h.hole.Z >= sheet.espessura) {
        zDepth = -pp.passanteDrillOvershoot;
      }
    } else {
      // Drilling from top: negative Z (into material from above)
      if (h.hole.Z >= sheet.espessura) {
        // Passante hole: go past material by overshoot amount
        zDepth = -pp.passanteDrillOvershoot;
      } else {
        // Blind hole: depth = thickness - hole depth (positive = above zero)
        zDepth = sheet.espessura - h.hole.Z;
      }
    }

    if (pp.tipo === "mach_cnc") {
      const label = `FURO_D${Math.round(diameter)}_P${Math.round(h.hole.Z)}`;
      lines.push(`(${label})`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zSeguro)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zRapido)}`);
      lines.push(`(Step:1/1)`);
      lines.push(`G1 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zDepth)}F${f4(tool.avancoCorte)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zRapido)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zSeguro)}`);
    } else {
      // SmartCut & Aspire: consistent 3-decimal format
      lines.push(`G0 X${f(h.absX)} Y${f(h.absY)} Z${f(zSeguro)}`);
      lines.push(`G0 Z${f(zRapido)}`);
      if (firstHole) {
        lines.push(`G1 Z${f(zDepth)} F${f(tool.avancoCorte)}`);
        firstHole = false;
      } else {
        lines.push(`G1 Z${f(zDepth)}`);
      }
      lines.push(`G0 Z${f(zSeguro)}`);
    }
  }
}
