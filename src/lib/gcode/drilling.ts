/**
 * G-code drilling operations generator.
 * Generates drilling cycles grouped by tool diameter.
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

  const zSeguro = pp.zSeguroAutoCalc ? sheet.espessura + pp.zSeguroOffset : pp.zSeguro;
  const zRapido = pp.zSeguroAutoCalc ? sheet.espessura + pp.zSeguroOffset - 2 : pp.zRapido;

  // Section header
  if (pp.tipo === "smartcut") {
    lines.push(`(#### Furação B${Math.round(diameter)}mm ####)`);
    lines.push("(#### TROCA DE FERRAMENTAS ####)");
    lines.push(`(#### FERRAMENTA: ${tool.nome} - ${f1(diameter)}mm ####)`);
    lines.push(`M6 T${tool.position}`);
    lines.push(`M3 S${tool.rpm}`);
  } else if (pp.tipo === "mach_cnc") {
    lines.push(`( FERRAMENTA: ${tool.position} - ${tool.nome} )`);
    lines.push("");
    lines.push(`M6 T${tool.position} `);
    lines.push(`M3 S${f4(tool.rpm)}`);
    lines.push("");
  } else {
    // Aspire - brocas are less common but supported
    lines.push(`(########_Troca_de_Ferramentas_########)`);
    lines.push(`(Numero_da_Ferramenta:${tool.position})`);
    lines.push(`(Descricao:${tool.nome})`);
    lines.push(` `);
    lines.push(`M6 T${tool.position}`);
    lines.push(`M3 S${tool.rpm}`);
  }

  let firstHole = true;
  for (const h of holes) {
    const zDepth = h.hole.FACE === "INF"
      ? -(h.hole.Z - sheet.espessura)
      : sheet.espessura - h.hole.Z;

    if (pp.tipo === "mach_cnc") {
      // Mach CNC style: explicit XYZ on each line, with step comments
      const label = `FURO_D${Math.round(diameter)}_P${Math.round(h.hole.Z)}`;
      lines.push(`(${label})`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zSeguro)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zRapido)}`);
      lines.push(`(Step:1/1)`);
      lines.push(`G1 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zDepth)}F${f4(tool.avancoCorte)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zRapido)}`);
      lines.push(`G0 X${f4(h.absX)}Y${f4(h.absY)}Z${f4(zSeguro)}`);
    } else {
      // SmartCut style: concise
      lines.push(`G0 X${f(h.absX)} Y${f1(h.absY)}`);
      lines.push(`G0 Z${f1(zRapido)}`);
      if (firstHole) {
        lines.push(`G1 Z${f1(zDepth)} F${f(tool.avancoCorte)}`);
        firstHole = false;
      } else {
        lines.push(`G1 Z${f1(zDepth)}`);
      }
      lines.push(`G0 Z${f1(zSeguro)}`);
    }
  }
}
