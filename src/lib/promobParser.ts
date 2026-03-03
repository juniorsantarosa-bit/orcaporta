import { PromobPiece, PromobHole, PromobContourPoint, NestingPiece } from "@/types/promob";
import { CuttingPiece } from "@/types/cutting";

/**
 * Parse Promob CSV (semicolon-separated) exported from PromobCut
 * The CSV has multiple rows per piece (one per contour vertex + edge bands)
 * The CNC column contains JSON with Holes, Grooves, etc.
 */
export function parsePromobCSV(csvText: string): PromobPiece[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].replace(/^\uFEFF/, "").split(";");
  
  const colIdx = (name: string) => header.indexOf(name);
  
  // Group rows by ID_UNICO - multiple rows per piece (contour points + edges)
  const pieceMap = new Map<number, { rows: string[][]; }>();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const idUnico = parseInt(cols[colIdx("ID_UNICO")]) || 0;
    if (!idUnico) continue;
    
    if (!pieceMap.has(idUnico)) {
      pieceMap.set(idUnico, { rows: [] });
    }
    pieceMap.get(idUnico)!.rows.push(cols);
  }

  const pieces: PromobPiece[] = [];

  for (const [idUnico, { rows }] of pieceMap) {
    const firstRow = rows[0];
    
    // Parse CNC JSON from the last column
    const cncRaw = firstRow[colIdx("CNC")] || "";
    let furos: PromobHole[] = [];
    let fresas: any[] = [];
    let alinhamento: "NORMAL" | "INVERSO" = "NORMAL";
    
    if (cncRaw.trim()) {
      try {
        const cncData = JSON.parse(cncRaw);
        if (cncData.Holes) {
          furos = cncData.Holes.map((h: any) => ({
            FACE: h.FaceNormal?.C === 1.0 ? "SUP" : "INF",
            X: h.X,
            Y: h.Y,
            DIAM: h.Diameter,
            Z: h.Depth,
          }));
        }
        if (cncData.Grooves) {
          fresas = cncData.Grooves;
        }
      } catch {}
    }

    // Build contour from rows that have COLUMN_POINT_X/Y
    const contorno: PromobContourPoint[] = [];
    const seenPoints = new Set<string>();
    
    for (const row of rows) {
      const px = parseFloat(row[colIdx("COLUMN_POINT_X_ITEM")]);
      const py = parseFloat(row[colIdx("COLUMN_POINT_Y_ITEM")]);
      if (!isNaN(px) && !isNaN(py)) {
        const key = `${px},${py}`;
        if (!seenPoints.has(key)) {
          seenPoints.add(key);
          contorno.push({
            X: px,
            Y: py,
            ANG: row[colIdx("COLUMN_POINTS_ANGLE")] || "NAO",
          });
        }
      }
    }

    // Parse edge bands from rows that have COLUMN_BORDER_FINISHING
    let bordaSup = false, bordaInf = false, bordaEsq = false, bordaDir = false;
    for (const row of rows) {
      const borderDesc = row[colIdx("COLUMN_BORDER_DESCRIPTION")] || "";
      if (borderDesc.trim()) {
        // Determine edge position from contour vertex position
        const px = parseFloat(row[colIdx("COLUMN_POINT_X_ITEM")]);
        const py = parseFloat(row[colIdx("COLUMN_POINT_Y_ITEM")]);
        const comp = parseFloat(firstRow[colIdx("COMPRIMENTO")]) || 0;
        const prof = parseFloat(firstRow[colIdx("PROFUNDIDADE")]) || 0;
        
        // Edge detection by vertex position
        if (py === prof && px > 0) bordaSup = true;
        if (py === 0 && px === 0) bordaInf = true;
        if (px === 0 && py > 0) bordaEsq = true;
        if (px === comp && py === 0) bordaDir = true;
      }
    }

    const al = firstRow[colIdx("ALINHAMENTO")] || "NORMAL";

    pieces.push({
      CLIENTE: firstRow[colIdx("CLIENTE")] || "",
      COD_CLIENTE: firstRow[colIdx("COD_CLIENTE")] || null,
      AMBIENTE: firstRow[colIdx("AMBIENTE")] || "",
      ID_UNICO: idUnico,
      QUANTIDADE: parseInt(firstRow[colIdx("QUANTIDADE")]) || 1,
      DESCRICAO: firstRow[colIdx("DESCRICAO")] || "",
      COMPRIMENTO: parseFloat(firstRow[colIdx("COMPRIMENTO")]) || 0,
      PROFUNDIDADE: parseFloat(firstRow[colIdx("PROFUNDIDADE")]) || 0,
      CHAPA: firstRow[colIdx("CHAPA")] || "",
      COR_1C: firstRow[colIdx("COR_1C")] || null,
      COR_2C: firstRow[colIdx("COR_2C")] || null,
      COR_1P: firstRow[colIdx("COR_1P")] || null,
      COR_2P: firstRow[colIdx("COR_2P")] || null,
      ROTEIRO: firstRow[colIdx("ROTEIRO")] || "",
      CATEGORIA: firstRow[colIdx("CATEGORIA")] || "",
      SETOR: firstRow[colIdx("SETOR")] || "",
      ESTRUTURA: parseInt(firstRow[colIdx("ESTRUTURA")]) || 0,
      MODULO_DESC: firstRow[colIdx("MODULO_DESC")] || "",
      COD_CORTE: parseInt(firstRow[colIdx("COD_CORTE")]) || 0,
      COMP_CHAPA: parseFloat(firstRow[colIdx("COMP_CHAPA")]) || 2750,
      PROF_CHAPA: parseFloat(firstRow[colIdx("PROF_CHAPA")]) || 1840,
      ESP_CHAPA: parseFloat(firstRow[colIdx("ESP_CHAPA")]) || 15,
      VEIO: parseInt(firstRow[colIdx("VEIO")]) || 0,
      CNC_A: firstRow[colIdx("CNC_A")] || "",
      CNC_B: firstRow[colIdx("CNC_B")] || "",
      CNC_FUROS_TOTAL: firstRow[colIdx("CNC_FUROS_TOTAL")] || "NAO",
      OBS: firstRow[colIdx("OBS")] || null,
      ALINHAMENTO: al === "INVERSO" ? "INVERSO" : "NORMAL",
      FRESAS: fresas,
      FUROS: furos,
      CONTORNO: contorno,
      HAS_FRESAS_SUP: false,
      HAS_FRESAS_INF: false,
      HAS_FUROS_SUP: furos.some(f => f.FACE === "SUP"),
      HAS_FUROS_INF: furos.some(f => f.FACE === "INF"),
      HAS_FUROS_TOPOS: false,
    });
  }

  return pieces;
}

/**
 * Parse Promob JSON (already processed format from optimizer)
 */
export function parsePromobJSON(jsonText: string): PromobPiece[] {
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) return [];
  return data as PromobPiece[];
}

/**
 * Convert PromobPiece[] to CuttingPiece[] for the parts table
 */
export function promobToCuttingPieces(promobPieces: PromobPiece[]): CuttingPiece[] {
  return promobPieces.map((p, idx) => ({
    id: p.ID_UNICO || idx + 1,
    projeto: p.AMBIENTE,
    cliente: p.CLIENTE,
    descricao: p.DESCRICAO,
    largura: p.COMPRIMENTO,
    altura: p.PROFUNDIDADE,
    espessura: p.ESP_CHAPA,
    material: p.CHAPA,
    quantidade: p.QUANTIDADE,
    bordaInf: false, // TODO: parse from CSV edges
    bordaSup: false,
    bordaEsq: false,
    bordaDir: false,
    veio: p.VEIO === 1,
    observacao: p.OBS || "",
  }));
}

/**
 * Convert PromobPiece[] to NestingPiece[] for full nesting with holes
 */
export function promobToNestingPieces(promobPieces: PromobPiece[]): NestingPiece[] {
  return promobPieces.map((p, idx) => ({
    id: p.ID_UNICO || idx + 1,
    descricao: p.DESCRICAO,
    comprimento: p.COMPRIMENTO,
    profundidade: p.PROFUNDIDADE,
    espessura: p.ESP_CHAPA,
    material: p.CHAPA,
    quantidade: p.QUANTIDADE,
    veio: p.VEIO === 1,
    alinhamento: p.ALINHAMENTO,
    cliente: p.CLIENTE,
    ambiente: p.AMBIENTE,
    moduloDesc: p.MODULO_DESC,
    codCorte: p.COD_CORTE,
    estrutura: p.ESTRUTURA,
    bordaSup: false,
    bordaInf: false,
    bordaEsq: false,
    bordaDir: false,
    furos: p.FUROS,
    fresas: p.FRESAS,
    contorno: p.CONTORNO,
    cncA: p.CNC_A,
    cncB: p.CNC_B,
    observacao: p.OBS || "",
  }));
}
