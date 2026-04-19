import { PromobHole, Usinagem } from "./promob";
import type { AspireContourSeg } from "@/lib/aspireParser";

export interface AspireSideInfo {
  index: number;
  lengthMm: number;
  kind: "reto" | "curvo";
  /** When true, this side gets edge-banding tape */
  banded: boolean;
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
  /** Quando aspireMode = "frisos": número de frisos */
  aspireFrisoCount?: number;
  /** Quando aspireMode = "frisos": comprimento em mm de cada friso */
  aspireFrisoLengthMm?: number;
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
