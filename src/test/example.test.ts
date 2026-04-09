import { describe, it, expect } from "vitest";
import { optimizeNesting } from "@/lib/nestingOptimizer";
import type { CuttingPiece } from "@/types/cutting";

describe("nesting orientation", () => {
  it("prioritizes vertical distribution when direction is vertical", () => {
    const pieces: CuttingPiece[] = [
      {
        id: 1,
        projeto: "Teste",
        cliente: "Cliente",
        descricao: "Lateral A",
        largura: 800,
        altura: 600,
        espessura: 15,
        material: "Branco TX",
        quantidade: 1,
        bordaInf: false,
        bordaSup: false,
        bordaEsq: false,
        bordaDir: false,
        veio: false,
        observacao: "",
        furos: [],
        usinagens: [],
      },
      {
        id: 2,
        projeto: "Teste",
        cliente: "Cliente",
        descricao: "Lateral B",
        largura: 800,
        altura: 600,
        espessura: 15,
        material: "Branco TX",
        quantidade: 1,
        bordaInf: false,
        bordaSup: false,
        bordaEsq: false,
        bordaDir: false,
        veio: false,
        observacao: "",
        furos: [],
        usinagens: [],
      },
      {
        id: 3,
        projeto: "Teste",
        cliente: "Cliente",
        descricao: "Tampo",
        largura: 800,
        altura: 600,
        espessura: 15,
        material: "Branco TX",
        quantidade: 1,
        bordaInf: false,
        bordaSup: false,
        bordaEsq: false,
        bordaDir: false,
        veio: false,
        observacao: "",
        furos: [],
        usinagens: [],
      },
    ];

    const [sheet] = optimizeNesting(pieces, {
      sheetWidth: 1840,
      sheetHeight: 2750,
      gap: 6,
      refiloX: 8,
      refiloY: 8,
      allowRotation: false,
      direction: "vertical",
    });

    const maxX = Math.max(...sheet.pieces.map((piece) => piece.x + piece.width));
    const maxY = Math.max(...sheet.pieces.map((piece) => piece.y + piece.height));

    expect(maxX).toBeLessThan(900);
    expect(maxY).toBeGreaterThan(1800);
  });
});
