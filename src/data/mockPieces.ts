import { CuttingPiece, SheetLayout } from "@/types/cutting";
import { PlacedNestingPiece, NestingSheet, PromobHole } from "@/types/promob";

// Holes data based on real Promob JSON (Julia project)
const holesLATESQ: PromobHole[] = [
  { FACE: "SUP", X: 526.6, Y: 514.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 526.6, Y: 55.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 916.6, Y: 514.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 916.6, Y: 55.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 7.7, Y: 280.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 7.7, Y: 530.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 7.7, Y: 30.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 65.4, Y: 571.7, DIAM: 3.0, Z: 15.5 },
];

const holesDIVINT: PromobHole[] = [
  { FACE: "SUP", X: 511.2, Y: 50.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 511.2, Y: 509.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 901.2, Y: 50.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 901.2, Y: 509.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "INF", X: 717.5, Y: 292.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "INF", X: 717.5, Y: 50.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "INF", X: 717.5, Y: 534.0, DIAM: 3.0, Z: 15.5 },
];

const holesBASESUP: PromobHole[] = [
  { FACE: "SUP", X: 983.0, Y: 280.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 983.0, Y: 530.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 150.0, Y: 571.7, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 734.6, Y: 571.7, DIAM: 3.0, Z: 15.5 },
];

const holesLATDIR: PromobHole[] = [
  { FACE: "SUP", X: 77.7, Y: 280.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 77.7, Y: 530.0, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 2450.0, Y: 7.7, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 2480.0, Y: 7.7, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 2450.0, Y: 556.3, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 2480.0, Y: 556.3, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 925.4, Y: 571.7, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 1785.4, Y: 571.7, DIAM: 3.0, Z: 15.5 },
  { FACE: "SUP", X: 526.6, Y: 514.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 526.6, Y: 55.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 1696.6, Y: 514.0, DIAM: 5.0, Z: 12.0 },
  { FACE: "SUP", X: 1696.6, Y: 55.0, DIAM: 5.0, Z: 12.0 },
];

const holesDobradica: PromobHole[] = [
  { FACE: "SUP", X: 100.0, Y: 290.0, DIAM: 15.0, Z: 12.0 },
  { FACE: "SUP", X: 660.0, Y: 290.0, DIAM: 15.0, Z: 12.0 },
];

const noHoles: PromobHole[] = [];

export const mockPieces: CuttingPiece[] = [
  { id: 1, projeto: "1_PROJETO", cliente: "Julia", descricao: "!DIV_INT", largura: 2399, altura: 564, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 2, projeto: "1_PROJETO", cliente: "Julia", descricao: "!BASE_SUP", largura: 1469, altura: 580, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 3, projeto: "1_PROJETO", cliente: "Julia", descricao: "!LAT_ESQ", largura: 2500, altura: 580, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: true, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 4, projeto: "1_PROJETO", cliente: "Julia", descricao: "!LAT_DIR", largura: 2500, altura: 580, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: true, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 5, projeto: "1_PROJETO", cliente: "Julia", descricao: "!PRAT_INF", largura: 1469, altura: 564, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: true, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 6, projeto: "1_PROJETO", cliente: "Julia", descricao: "!BASE_INF", largura: 1469, altura: 580, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: true, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 7, projeto: "1_PROJETO", cliente: "Julia", descricao: "!PRAT_01", largura: 717.5, altura: 564, espessura: 15, material: "Branco TX 15mm", quantidade: 2, bordaInf: true, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 8, projeto: "1_PROJETO", cliente: "Julia", descricao: "!PORTA_ESQ", largura: 760, altura: 497, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: true, bordaSup: true, bordaEsq: true, bordaDir: true, veio: false, observacao: "" },
  { id: 9, projeto: "1_PROJETO", cliente: "Julia", descricao: "!PORTA_DIR", largura: 760, altura: 497, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: true, bordaSup: true, bordaEsq: true, bordaDir: true, veio: false, observacao: "" },
  { id: 10, projeto: "1_PROJETO", cliente: "Julia", descricao: "!FUNDO", largura: 1437, altura: 735, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 11, projeto: "1_PROJETO", cliente: "Julia", descricao: "!DIV_INT_2", largura: 717.5, altura: 564, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
  { id: 12, projeto: "1_PROJETO", cliente: "Julia", descricao: "!TAMP_SUP", largura: 1500, altura: 580, espessura: 15, material: "Branco TX 15mm", quantidade: 1, bordaInf: false, bordaSup: true, bordaEsq: false, bordaDir: false, veio: false, observacao: "" },
];

export const mockSheetLayouts: NestingSheet[] = [
  {
    id: 1,
    sheetWidth: 1840,
    sheetHeight: 2750,
    espessura: 15,
    material: "Branco TX 15mm",
    codCorte: 7002,
    efficiency: 87.3,
    pieces: [
      { pieceId: 1, x: 5, y: 5, width: 564, height: 2399, rotated: true, label: "0", descricao: "!DIV_INT", furos: holesDIVINT, bordaSup: false, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 3, x: 573, y: 5, width: 580, height: 2500, rotated: true, label: "1", descricao: "!LAT_ESQ", furos: holesLATESQ, bordaSup: true, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 4, x: 1157, y: 5, width: 580, height: 2500, rotated: true, label: "2", descricao: "!LAT_DIR", furos: holesLATDIR, bordaSup: true, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 10, x: 5, y: 2509, width: 735, height: 235, rotated: false, label: "3", descricao: "!FUNDO", furos: noHoles, bordaSup: false, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
    ],
  },
  {
    id: 2,
    sheetWidth: 1840,
    sheetHeight: 2750,
    espessura: 15,
    material: "Branco TX 15mm",
    codCorte: 7002,
    efficiency: 72.1,
    pieces: [
      { pieceId: 2, x: 5, y: 5, width: 1469, height: 580, rotated: false, label: "4", descricao: "!BASE_SUP", furos: holesBASESUP, bordaSup: false, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 5, x: 1478, y: 5, width: 1269, height: 564, rotated: true, label: "5", descricao: "!PRAT_INF", furos: noHoles, bordaSup: false, bordaInf: true, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 6, x: 5, y: 589, width: 1469, height: 580, rotated: false, label: "6", descricao: "!BASE_INF", furos: noHoles, bordaSup: false, bordaInf: true, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 7, x: 1478, y: 589, width: 717.5, height: 564, rotated: false, label: "7", descricao: "!PRAT_01", furos: noHoles, bordaSup: false, bordaInf: true, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 8, x: 5, y: 1173, width: 760, height: 497, rotated: false, label: "8", descricao: "!PORTA_ESQ", furos: holesDobradica, bordaSup: true, bordaInf: true, bordaEsq: true, bordaDir: true, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 9, x: 769, y: 1173, width: 760, height: 497, rotated: false, label: "9", descricao: "!PORTA_DIR", furos: holesDobradica, bordaSup: true, bordaInf: true, bordaEsq: true, bordaDir: true, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 11, x: 1533, y: 1173, width: 717.5, height: 564, rotated: false, label: "10", descricao: "!DIV_INT_2", furos: holesDIVINT.slice(0, 4), bordaSup: false, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
      { pieceId: 12, x: 2254, y: 589, width: 490, height: 580, rotated: true, label: "11", descricao: "!TAMP_SUP", furos: noHoles, bordaSup: false, bordaInf: false, bordaEsq: false, bordaDir: false, cliente: "Julia", ambiente: "Quarto", moduloDesc: "ARM_01", usinagens: [], espessura: 15 },
    ],
  },
];
