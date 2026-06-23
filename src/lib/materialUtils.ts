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

/**
 * Porta provençal sempre vira 2 planos de corte: uma peça de 15mm (fundo)
 * e outra de 6mm (quadro), mantendo material/cor e quantidade da porta.
 */
export function expandProvencalPiecesForSheets(pieces: CuttingPiece[]): CuttingPiece[] {
  return pieces.flatMap((piece) => {
    const material = normalizeMaterialName(piece.material, piece.descricao);
    if (!piece.provencal) return [{ ...piece, material }];

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