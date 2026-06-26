import type { CuttingPiece } from "@/types/cutting";

/** Extrai e normaliza o material MDF a partir das descrições lidas no projeto. */
export function cleanMaterialName(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/^MDF\s+/i, "")
    .replace(/\s*[-–—]?\s*\d+(?:[,.]\d+)?\s*mm\b/gi, "")
    .trim();
}

export function extractMdfMaterialFromDescription(descricao?: string | null): string {
  if (!descricao) return "";
  const text = descricao.replace(/\s+/g, " ").trim();
  const match = text.match(/\bMDF\s+(.+?)(?:\s*[-–—]\s*|$)/i);
  return cleanMaterialName(match?.[1]);
}

export function normalizeMaterialName(material?: string | null, descricao?: string | null): string {
  return cleanMaterialName(material) || extractMdfMaterialFromDescription(descricao) || "MDF";
}

/** Retorna o tipo de porta efetivo (com fallback para o flag legado `provencal`). */
export function getDoorType(piece: CuttingPiece): 'single18' | 'provencal' | 'triple6' {
  if (piece.doorType) return piece.doorType;
  return piece.provencal ? 'provencal' : 'single18';
}

/** Lista de (espessura, multiplicador de chapas por unidade) para cada tipo. */
export function doorTypeSheetSpec(type: 'single18' | 'provencal' | 'triple6'): { espessura: number; mult: number }[] {
  switch (type) {
    case 'single18': return [{ espessura: 18, mult: 1 }];
    case 'triple6':  return [{ espessura: 6, mult: 3 }];
    case 'provencal':
    default:         return [{ espessura: 15, mult: 1 }, { espessura: 6, mult: 1 }];
  }
}

export const DOOR_TYPE_LABEL: Record<'single18' | 'provencal' | 'triple6', string> = {
  single18: '1× 18 mm',
  provencal: '1× 15 mm + 1× 6 mm (provençal)',
  triple6: '3× 6 mm (formando 18 mm)',
};

/**
 * Expande cada peça nos planos de corte conforme o tipo da porta:
 *  - 'single18'  → 1 peça de 18mm
 *  - 'provencal' → 1 peça de 15mm + 1 peça de 6mm (mesma área)
 *  - 'triple6'   → 1 peça de 6mm com quantidade × 3
 */
export function expandProvencalPiecesForSheets(pieces: CuttingPiece[]): CuttingPiece[] {
  return pieces.flatMap((piece) => {
    const material = normalizeMaterialName(piece.material, piece.descricao);
    const type = getDoorType(piece);

    if (type === 'single18') {
      return [{ ...piece, material, espessura: 18 }];
    }

    if (type === 'triple6') {
      const qty = Math.max(1, piece.quantidade || 1);
      return [{
        ...piece,
        material,
        espessura: 6,
        quantidade: qty * 3,
        descricao: `${piece.descricao} — 3× 6mm`,
        observacao: `${piece.observacao || ""}${piece.observacao ? " · " : ""}Triple 6mm`,
      }];
    }

    // provencal
    return [
      {
        ...piece,
        material,
        espessura: 15,
        descricao: `${piece.descricao} — fundo 15mm`,
        observacao: `${piece.observacao || ""}${piece.observacao ? " · " : ""}Provençal: fundo 15mm`,
      },
      {
        ...piece,
        material,
        espessura: 6,
        descricao: `${piece.descricao} — quadro 6mm`,
        observacao: `${piece.observacao || ""}${piece.observacao ? " · " : ""}Provençal: quadro 6mm`,
      },
    ];
  });
}