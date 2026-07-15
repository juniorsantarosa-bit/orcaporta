import type { ClientPriceTable, Client } from "@/types/commercial";
import type { CuttingPiece } from "@/types/cutting";
import { DEFAULT_PRICE_TABLE, saveClient } from "./commercialStore";

/**
 * Retorna o R$/m² efetivo para uma peça, considerando:
 *  - se `usarMesmoPrecoM2` está ativo → usa `precoM2` global
 *  - se a peça tem `tipoProduto` cadastrado → usa esse preço
 *  - fallback → `precoM2` global (ou default)
 */
export function precoM2ForPiece(piece: CuttingPiece, prices: ClientPriceTable): number {
  const globalPrice = prices.precoM2 ?? DEFAULT_PRICE_TABLE.precoM2!;
  if (prices.usarMesmoPrecoM2 !== false) return globalPrice;
  const tp = (piece.tipoProduto ?? "").trim();
  if (!tp) return globalPrice;
  const found = (prices.tiposProduto ?? []).find(
    t => t.nome.trim().toLowerCase() === tp.toLowerCase(),
  );
  return found?.precoM2 ?? globalPrice;
}

/** Lista de tipos que aparecem nas peças mas não estão cadastrados no cliente. */
export function missingProductTypes(pieces: CuttingPiece[], prices: ClientPriceTable): string[] {
  if (prices.usarMesmoPrecoM2 !== false) return [];
  const known = new Set((prices.tiposProduto ?? []).map(t => t.nome.trim().toLowerCase()));
  const missing = new Set<string>();
  for (const p of pieces) {
    const tp = (p.tipoProduto ?? "").trim();
    if (tp && !known.has(tp.toLowerCase())) missing.add(tp);
  }
  return Array.from(missing);
}

/** Adiciona tipos de produto (com preço) ao cliente e persiste. */
export function addProductTypesToClient(client: Client, novos: { nome: string; precoM2: number }[]): Client {
  const cur = client.precos.tiposProduto ?? [];
  const byName = new Map(cur.map(t => [t.nome.trim().toLowerCase(), t]));
  for (const n of novos) {
    byName.set(n.nome.trim().toLowerCase(), { nome: n.nome.trim(), precoM2: n.precoM2 });
  }
  const nextPrices: ClientPriceTable = {
    ...client.precos,
    tiposProduto: Array.from(byName.values()),
  };
  return saveClient({ ...client, precos: nextPrices });
}
