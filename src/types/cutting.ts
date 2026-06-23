import { PromobHole, Usinagem } from "./promob";
import type { AspireContourSeg } from "@/lib/aspireParser";

export interface AspireSideInfo {
  index: number;
  lengthMm: number;
  kind: "reto" | "curvo";
  /** When true, this side gets edge-banding tape */
  banded: boolean;
  /** When true, this side gets MANUAL edge-banding (applied by hand) */
  bandedManual?: boolean;
  /** Tipo de corte deste lado: "fresa" (router) ou "serra" (esquadrejadeira) */
  cutType?: "fresa" | "serra";
}

export interface CuttingPiece {
  id: number;
  projeto: string;
  cliente: string;
  descricao: string;
  largura: number;
  altura: number;
  espessura: number;
  material: string;
  quantidade: number;
  bordaInf: boolean;
  bordaSup: boolean;
  bordaEsq: boolean;
  bordaDir: boolean;
  /** Edge-banding manual aplicada às bordas (independente da fita normal) */
  bordaManualSup?: boolean;
  bordaManualInf?: boolean;
  bordaManualEsq?: boolean;
  bordaManualDir?: boolean;
  veio: boolean;
  observacao: string;
  furos?: PromobHole[];
  usinagens?: Usinagem[];
  /** When true, skip outer contour cutting (machining-only piece) */
  noContour?: boolean;
  /** Number of holes counted for budget purposes (overrides furos.length) */
  numFurosOrcamento?: number;
  /** Source of the piece — "aspire" means imported from a Vectric .tap/.nc file */
  source?: "promob" | "aspire" | "manual";
  /** Aspire-specific: detected sides with their real machined lengths */
  aspireSides?: AspireSideInfo[];
  /** Aspire-specific: total perimeter actually machined (mm) */
  aspirePerimeter?: number;
  /** Aspire-specific: tool diameter detected (mm) */
  aspireToolDiameter?: number;
  /** Aspire-specific: outer contour in local coords (0..largura × 0..altura) */
  aspireContour?: AspireContourSeg[];
  /** Aspire-specific: where the file's machine zero sits relative to the piece bbox (mm) */
  aspireOrigin?: { minX: number; minY: number; maxX: number; maxY: number };
  /** "contour" = peça com contorno fechado · "frisos" = N passagens individuais (sem fita) */
  aspireMode?: "contour" | "frisos";
  /** Quando aspireMode = "frisos": número de frisos (editável) */
  aspireFrisoCount?: number;
  /**
   * Quando aspireMode = "frisos": LARGURA do vão (medida principal visível
   * para o cliente, ex: 600mm). Editável.
   */
  aspireFrisoLarguraMm?: number;
  /**
   * Quando aspireMode = "frisos": ALTURA do vão (medida perpendicular, ex:
   * 10mm). Default = Ø fresa. Editável.
   */
  aspireFrisoAlturaMm?: number;
  /**
   * Quando aspireMode = "frisos": comprimento por friso usado no ORÇAMENTO
   * (em mm). Calculado automaticamente como
   *   2 × (largura + Ø) + 2 × altura
   * mas pode ser sobrescrito manualmente pelo usuário. Quando presente,
   * SUBSTITUI a soma dos `aspireSides` no cálculo de orçamento de frisos.
   */
  aspireFrisoBilledLengthMm?: number;
  /** @deprecated alias de aspireFrisoLarguraMm — mantido para retrocompat */
  aspireFrisoLengthMm?: number;
  /** Quando aspireMode = "frisos": tipo de corte aplicado a TODOS os frisos */
  aspireFrisoCutType?: "fresa" | "serra";

  // -------- Comercial / gestão de pedido (por peça) --------
  /** Ordem de Serviço vinculada ao material desta peça */
  os?: string;
  /** Data ISO em que o material desta peça foi recebido */
  dataRecebimento?: string;
  /** true quando o material já foi recebido */
  materialRecebido?: boolean;
  /** Endereço de entrega específico desta peça (se diferente do padrão) */
  enderecoEntrega?: string;

  // -------- Orçamento por imagem (m²/fita/dobradiças) --------
  /** Número de furos de dobradiça por unidade (cobrado por unidade) */
  furosDobradica?: number;
  /**
   * Fita de borda DUPLA (provençal): cobra fita externa + interna
   * (= 2 × perímetro). Default true quando importado por imagem.
   */
  bordaDuplaProvencal?: boolean;
  /** Metros lineares de fita de borda por unidade — override manual */
  fitaMetrosOverride?: number;
  /** Override do valor UNITÁRIO (R$ por unidade) para compensações/ajustes no orçamento */
  precoUnitarioOverride?: number;
  /**
   * Porta provençal: cada unidade consome 2 peças — uma de 15mm (fundo) e
   * uma de 6mm (quadro), ambas nas mesmas dimensões. Usado para cálculo de
   * material no orçamento.
   */
  provencal?: boolean;
}

export interface SheetLayout {
  id: number;
  sheetWidth: number;
  sheetHeight: number;
  pieces: PlacedPiece[];
  efficiency: number;
}

export interface PlacedPiece {
  pieceId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
}

export interface CuttingConfig {
  serraSerpentina: number;
  margemChapa: number;
  espacamentoEntreCortes: number;
  permitirRotacao: boolean;
  usarDisponiveis: boolean;
  cadastrarNovas: boolean;
  removerUsadas: boolean;
  useCommonCut?: boolean;
}

export interface NestingConfig {
  espessuraCorte: number;
  considerarRetangulares: boolean;
  pontoInicial: "traseira-esquerda" | "traseira-direita" | "frente-esquerda" | "frente-direita";
  refiloX: number;
  refiloY: number;
  direcaoNesting: "vertical" | "horizontal" | "indefinido";
  otimizacao: number;
}

export interface GeneralConfig {
  chapaX: number;
  chapaY: number;
  sobraX: number;
  sobraY: number;
  distanciaX: number;
  distanciaY: number;
  usarDisponiveis: boolean;
  cadastrarNovas: boolean;
  removerUsadas: boolean;
  exibirDinabox: boolean;
  exibirSeletorSobras: boolean;
  fresaDiametroMaior: number;
  fresaAngulo: number;
  fresaDiametroMenor: number;
  ignorarMateriais: string[];
  companyLogo: string;
}

export interface MachineConfig {
  nome: string;
  descricao: string;
  posProcessador: string;
  tipoOtimizacao: string;
  pastaExportacao: string;
  salvarEtiqueta: boolean;
  salvarLista: boolean;
  etiquetaModelo: string;
  zSeguro: number;
  zRapido: number;
  maxZMenos: number;
  deslocamentoX: number;
  deslocamentoY: number;
  usarLargura: boolean;
  larguraPequena: number;
  usarArea: boolean;
  areaPequena: number;
  pontoZeramento: string;
  rotacaoPeloMaterial: boolean;
  offsetChanfros: boolean;
  prioridadeFaceSuperior: boolean;
  ignorarLayers: string[];
}

export interface BitmapConfig {
  prevLargura: number;
  prevAltura: number;
  materialVeio: boolean;
  fitaSuperior: boolean;
  fitaInferior: boolean;
  fitaEsquerda: boolean;
  fitaDireita: boolean;
  largura: number;
  altura: number;
  margem: number;
  espessuraLinha: number;
  tamanhoTexto: number;
  tamanhoLegenda: number;
  rotacao: number;
  exibirFaceAlinhamento: boolean;
  exibirLegendaFace: boolean;
}

export interface MaterialItem {
  id: number;
  biblioteca: string;
  nome: string;
  nomeExportacao: string;
  comprimento: number;
  largura: number;
  espessura: number;
  possuiVeio: boolean;
  direcaoVeio: string;
  possiveisNomes: string[];
}

export interface SobraMaterial {
  id: number;
  largura: number;
  altura: number;
  quantidade: number;
  descricao: string;
}

export interface DXFFile {
  id: number;
  descricao: string;
  material: string;
  veio: boolean;
  operacao: string;
  quantidade: number;
  observacao: string;
}

export interface LayerInfo {
  nome: string;
  tipo: "R" | "I" | "";
}
