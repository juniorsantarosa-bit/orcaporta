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
