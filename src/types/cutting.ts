export interface CuttingPiece {
  id: number;
  projeto: string;
  cliente: string;
  descricao: string;
  largura: number;
  altura: number;
  material: string;
  quantidade: number;
  bordaInf: boolean;
  bordaSup: boolean;
  bordaEsq: boolean;
  bordaDir: boolean;
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
