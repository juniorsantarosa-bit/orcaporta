// Types for Promob data (CSV/JSON import) and extended piece info

export interface PromobHole {
  FACE: "SUP" | "INF";
  X: number;
  Y: number;
  DIAM: number;
  Z: number; // depth
}

export interface PromobContourPoint {
  X: number;
  Y: number;
  ANG: string; // "NAO" = no arc
}

export interface PromobPiece {
  CLIENTE: string;
  COD_CLIENTE: string | null;
  AMBIENTE: string;
  ID_UNICO: number;
  QUANTIDADE: number;
  DESCRICAO: string;
  COMPRIMENTO: number;
  PROFUNDIDADE: number;
  CHAPA: string;
  COR_1C: string | null;
  COR_2C: string | null;
  COR_1P: string | null;
  COR_2P: string | null;
  ROTEIRO: string;
  CATEGORIA: string;
  SETOR: string;
  ESTRUTURA: number;
  MODULO_DESC: string;
  COD_CORTE: number;
  COMP_CHAPA: number;
  PROF_CHAPA: number;
  ESP_CHAPA: number;
  VEIO: number;
  CNC_A: string;
  CNC_B: string;
  CNC_FUROS_TOTAL: string;
  OBS: string | null;
  ALINHAMENTO: "NORMAL" | "INVERSO";
  FRESAS: any[];
  FUROS: PromobHole[];
  CONTORNO: PromobContourPoint[];
  HAS_FRESAS_SUP: boolean;
  HAS_FRESAS_INF: boolean;
  HAS_FUROS_SUP: boolean;
  HAS_FUROS_INF: boolean;
  HAS_FUROS_TOPOS: boolean;
}

// Extended piece for nesting with drill info
export interface NestingPiece {
  id: number;
  descricao: string;
  comprimento: number;
  profundidade: number;
  espessura: number;
  material: string;
  quantidade: number;
  veio: boolean;
  alinhamento: "NORMAL" | "INVERSO";
  cliente: string;
  ambiente: string;
  moduloDesc: string;
  codCorte: number;
  estrutura: number;
  bordaSup: boolean;
  bordaInf: boolean;
  bordaEsq: boolean;
  bordaDir: boolean;
  furos: PromobHole[];
  fresas: any[];
  contorno: PromobContourPoint[];
  cncA: string;
  cncB: string;
  observacao: string;
}

// Placed piece on sheet with full info
export interface PlacedNestingPiece {
  pieceId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
  descricao: string;
  furos: PromobHole[];
  bordaSup: boolean;
  bordaInf: boolean;
  bordaEsq: boolean;
  bordaDir: boolean;
  cliente: string;
  moduloDesc: string;
  espessura: number;
}

export interface NestingSheet {
  id: number;
  sheetWidth: number;
  sheetHeight: number;
  espessura: number;
  material: string;
  pieces: PlacedNestingPiece[];
  efficiency: number;
  codCorte: number;
}

// G-code generation config
export interface GCodeConfig {
  zSeguro: number;         // 50
  zRapido: number;         // 16
  maxZMenos: number;       // -0.5 for drilling, -0.1 for cutting
  rpmBroca3mm: number;     // 8000
  rpmBroca15mm: number;    // 8000
  rpmFresa6mm: number;     // 24000
  avancoBroca: number;     // 3000
  avancoCorteRapido: number; // 8000
  avancoEntrada: number;   // 4000
  toolBroca3mm: number;    // T2
  toolBroca15mm: number;   // T4
  toolFresa6mm: number;    // T1
  fresaDiametro: number;   // 6.0
  raioContorno: number;    // 3.0 (R3.000 nos arcos)
  passePrimeiroProfundidade: number; // 1.0 (Z1.000 para peças pequenas)
  passeSegundoProfundidade: number;  // -0.1 (Z-0.100 passe final)
  larguraPequena: number;  // 150 - largura para considerar peça pequena
  areaPequena: number;     // 90000 - área para considerar peça pequena
  mInicio: string;         // M752
  mFim: string;            // M750
  usarDoisPasses: boolean; // true para peças pequenas
  entradaRampa: "helicoidal" | "diagonal";
}

export const DEFAULT_GCODE_CONFIG: GCodeConfig = {
  zSeguro: 50,
  zRapido: 16,
  maxZMenos: -0.5,
  rpmBroca3mm: 8000,
  rpmBroca15mm: 8000,
  rpmFresa6mm: 24000,
  avancoBroca: 3000,
  avancoCorteRapido: 8000,
  avancoEntrada: 4000,
  toolBroca3mm: 2,
  toolBroca15mm: 4,
  toolFresa6mm: 1,
  fresaDiametro: 6.0,
  raioContorno: 3.0,
  passePrimeiroProfundidade: 1.0,
  passeSegundoProfundidade: -0.1,
  larguraPequena: 150,
  areaPequena: 90000,
  mInicio: "M752",
  mFim: "M750",
  usarDoisPasses: true,
  entradaRampa: "helicoidal",
};
