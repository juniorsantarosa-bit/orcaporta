/**
 * Tipos do módulo comercial: clientes, valores negociados, orçamentos
 * salvos e status. Persistência atual em localStorage (migra para Cloud
 * depois sem mudar a interface).
 */
import type { CuttingPiece } from "./cutting";
import type { NestingSheet } from "./promob";

export interface ProductTypePrice {
  /** Ex: "Porta clássica", "Painel", "Clássica c/ vidro canelado" */
  nome: string;
  /** R$/m² aplicado a peças deste tipo */
  precoM2: number;
}

export interface ClientPriceTable {
  /** R$ por corte de serra (chapa inteira) */
  corte: number;
  /** R$ por corte em peça (lado de Aspire configurado como serra) */
  cortePeca: number;
  /** R$ por metro de fita de borda */
  fita: number;
  /**
   * R$ por metro de fita MANUAL (aplicada à mão em recortes internos —
   * nichos, faces curvas — onde a coladeira automática não chega).
   */
  fitaManual: number;
  /** R$ por furo */
  furo: number;
  /** R$ por metro de fresa (router) */
  fresaMetro: number;
  /** R$ por metro de serra (Aspire / metro linear) */
  serraMetro: number;
  /** R$ por m² de chapa (opcional, informativo) */
  chapaM2?: number;
  /** R$ por m² de peça acabada — valor GLOBAL (fallback) */
  precoM2?: number;
  /** R$ por metro linear de fita de borda (modo orçamento por imagem) */
  precoFitaMetro?: number;
  /** R$ por furo de dobradiça (modo orçamento por imagem) */
  precoFuroDobradica?: number;
  /**
   * Preços de m² diferenciados por TIPO de produto (porta clássica, painel,
   * porta vazada, com vidro canelado, etc). Quando `usarMesmoPrecoM2` = true
   * essa tabela é ignorada e o `precoM2` global vale para todos os tipos.
   */
  tiposProduto?: ProductTypePrice[];
  /**
   * Quando true (default), usa `precoM2` global para todos os tipos.
   * Quando false, cada peça é cobrada pelo `precoM2` do seu `tipoProduto`
   * — caindo em `precoM2` se o tipo não estiver cadastrado.
   */
  usarMesmoPrecoM2?: boolean;
}

export interface Client {
  id: string;
  /** Nome de fantasia ou pessoa física */
  nome: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  endereco?: string;
  responsavel?: string;
  email?: string;
  telefone?: string;
  observacoes?: string;
  /** Valores negociados — sobrescrevem os defaults do orçamento ao selecionar este cliente */
  precos: ClientPriceTable;
  createdAt: string;
  updatedAt: string;
}

/** Status por orçamento (enviado / pago) */
export interface QuoteStatus {
  enviado: boolean;
  pago: boolean;
  /** Data ISO em que foi marcado como enviado (opcional) */
  dataEnvio?: string;
  /** Data ISO em que foi marcado como pago (opcional) */
  dataPagamento?: string;
}

/** Status de recebimento de material — por peça */
export interface PieceReceiptStatus {
  /** Material desta peça já chegou */
  recebido: boolean;
  /** Data ISO em que foi recebido */
  dataRecebimento?: string;
  /** Ordem de Serviço vinculada ao material */
  os?: string;
  /** Endereço onde o material foi/será entregue */
  enderecoEntrega?: string;
}

/** Estado por peça armazenado no orçamento */
export type PieceMetaMap = Record<number, PieceReceiptStatus>;

export interface MaterialQuoteLine {
  /** Tipo/cor do MDF, ex: Branco TX */
  material: string;
  /** Espessura da chapa (6, 15 ou 18 mm conforme o tipo de porta) */
  espessura: number;
  /** Quantidade de chapas usada no orçamento */
  quantidade: number;
  /** Valor unitário da chapa */
  precoChapa: number;
  /** Total da linha */
  valorTotal: number;
}

export interface SavedQuote {
  id: string;
  /** Número sequencial amigável (auto) */
  numero: number;
  clientId?: string;
  /** Snapshot do nome do cliente no momento do salvamento */
  clienteNome?: string;
  /** Snapshot do endereço de entrega global (opcional) */
  enderecoEntregaPadrao?: string;
  /** Snapshot dos preços efetivamente usados */
  precos: ClientPriceTable;
  pieces: CuttingPiece[];
  layouts: NestingSheet[];
  /** Status comercial */
  status: QuoteStatus;
  /** Estado por peça (recebimento, OS, entrega) */
  pieceMeta: PieceMetaMap;
  /** Total computado no momento do salvamento (R$) */
  totalCalculado: number;
  /** Observações livres */
  observacoes?: string;
  /** Desconto percentual aplicado no total (0-100) */
  descontoPct?: number;
  /** Imposto percentual aplicado no total (0-100) */
  impostoPct?: number;
  /** Valor do imposto calculado sobre o total (R$) */
  valorImposto?: number;
  /** Imagem de referência anexa (data URL) — mostrada no PDF (legado, uma imagem) */
  imagemReferencia?: string;
  /** Imagens de referência anexas (data URLs) — mostradas no PDF */
  imagensReferencia?: string[];
  /** Incluir material (chapas 6mm + 15mm provençal) no orçamento */
  incluirMaterial?: boolean;
  /** Preço por chapa de 6mm (R$) — usado no cálculo de material */
  materialPrecoChapa6?: number;
  /** Preço por chapa de 15mm (R$) — usado no cálculo de material */
  materialPrecoChapa15?: number;
  /** Preço por chapa de 18mm (R$) — usado no cálculo de material */
  materialPrecoChapa18?: number;
  /** Quantidade override (manual) de chapas 6mm */
  materialQtdChapa6?: number;
  /** Quantidade override (manual) de chapas 15mm */
  materialQtdChapa15?: number;
  /** Linhas detalhadas de material por cor/tipo e espessura */
  materialChapas?: MaterialQuoteLine[];
  createdAt: string;
  updatedAt: string;
}
