/** Extrai e normaliza o material MDF a partir das descrições lidas no projeto. */
export function cleanMaterialName(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/^MDF\s+/i, "")
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