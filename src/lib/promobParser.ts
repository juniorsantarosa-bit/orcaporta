import { PromobPiece, PromobHole, PromobContourPoint, NestingPiece, Usinagem } from "@/types/promob";
import { CuttingPiece } from "@/types/cutting";

/**
 * Parse CNC JSON blob from Promob Cut CSV.
 * Handles both compact and pretty-printed JSON.
 * Structure: { Holes: [...], Grooves: [...], AligmentFaceNormal: {...} }
 */
function parseCNCJson(raw: string, espessura: number): { furos: PromobHole[]; fresas: any[]; usinagens: Usinagem[]; alinhamento: "NORMAL" | "INVERSO" } {
  let furos: PromobHole[] = [];
  let fresas: any[] = [];
  let usinagens: Usinagem[] = [];
  let alinhamento: "NORMAL" | "INVERSO" = "NORMAL";

  const trimmed = raw.trim();
  if (!trimmed || trimmed === "NAO" || trimmed === "") return { furos, fresas, usinagens, alinhamento };

  try {
    const cncData = JSON.parse(trimmed);

    if (Array.isArray(cncData.Holes)) {
      for (const h of cncData.Holes) {
        const face = h.FaceNormal?.C === -1.0 ? "INF" : "SUP";
        const diam = h.Diameter ?? h.Diametro ?? 0;
        const depth = h.Depth ?? h.Z ?? 0;
        const isPassante = depth >= espessura;

        // Large diameter holes (> 40mm) are circular cutouts, not drill holes
        if (diam > 40) {
          usinagens.push({
            tipo: "recorte_circular",
            x: h.X ?? 0,
            y: h.Y ?? 0,
            largura: diam, // diameter
            profundidade: depth,
            comprimento: Math.PI * diam, // perimeter for metering
            face: face as "SUP" | "INF",
            passante: isPassante,
          });
        } else {
          furos.push({
            FACE: face as "SUP" | "INF",
            X: h.X ?? 0,
            Y: h.Y ?? 0,
            DIAM: diam,
            Z: depth,
          });
        }
      }
    }

    if (Array.isArray(cncData.Grooves)) {
      fresas = cncData.Grooves;
      for (const g of cncData.Grooves) {
        const face = g.FaceNormal?.C === -1.0 ? "INF" : "SUP";
        const depth = g.Depth ?? 0;
        const width = g.Width ?? 0;
        const length = g.Length ?? 0;
        const isPassante = depth >= espessura;

        // Classify groove type
        let tipo: Usinagem["tipo"] = "canal";
        if (isPassante && width > 50) {
          tipo = "recorte_retangular";
        } else if (isPassante) {
          tipo = "contorno";
        } else if (depth < espessura * 0.5) {
          tipo = "canal"; // shallow = LED channel
        } else {
          tipo = "rebaixo";
        }

        usinagens.push({
          tipo,
          x: g.X ?? 0,
          y: g.Y ?? 0,
          largura: width,
          profundidade: depth,
          comprimento: length,
          face: face as "SUP" | "INF",
          passante: isPassante,
        });
      }
    }

    if (cncData.AligmentFaceNormal?.B === -1.0) {
      alinhamento = "INVERSO";
    }
  } catch {
    try {
      const holesMatch = trimmed.match(/"Holes"\s*:\s*\[([\s\S]*?)\]\s*,\s*"Grooves"/);
      if (holesMatch) {
        const holesJson = JSON.parse(`[${holesMatch[1]}]`);
        furos = holesJson.map((h: any) => ({
          FACE: (h.FaceNormal?.C === -1.0 ? "INF" : "SUP") as "SUP" | "INF",
          X: h.X ?? 0,
          Y: h.Y ?? 0,
          DIAM: h.Diameter ?? 0,
          Z: h.Depth ?? 0,
        }));
      }
    } catch { /* unable to parse */ }
  }

  return { furos, fresas, usinagens, alinhamento };
}

/**
 * Parse Promob CSV (semicolon-separated) exported from PromobCut.
 * The CSV has multiple rows per piece (one per contour vertex + edge bands).
 * The CNC column (last column) contains JSON with Holes, Grooves, etc.
 * 
 * Also handles CSVs WITHOUT the CNC column (older/different exports).
 */
/** Parse number handling both dot and comma as decimal separator */
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(",", ".")) || 0;
}

export function parsePromobCSV(csvText: string): PromobPiece[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].replace(/^\uFEFF/, "").split(";").map(h => h.trim());

  // Column name aliases: maps canonical names to possible CSV header variants
  const COLUMN_ALIASES: Record<string, string[]> = {
    "ID_UNICO": ["ID_UNICO", "COLUMN_ITEM_CODE"],
    "CLIENTE": ["CLIENTE", "CLIENTE - DADOS DO CLIENTE"],
    "AMBIENTE": ["AMBIENTE"],
    "COMPRIMENTO": ["COMPRIMENTO", "ALTURA (X)"],
    "PROFUNDIDADE": ["PROFUNDIDADE", "PROF (Y)"],
    "QUANTIDADE": ["QUANTIDADE", "QUANTIDADE ITEM"],
    "DESCRICAO": ["DESCRICAO", "PEÇA DESCRIÇÃO"],
    "CHAPA": ["CHAPA", "DESCRIÇÃO DO MATERIAL"],
    "ESP_CHAPA": ["ESP_CHAPA", "ESPESSURA DO MATERIAL"],
    "COMP_CHAPA": ["COMP_CHAPA", "DIM_X_MATERIAL"],
    "PROF_CHAPA": ["PROF_CHAPA", "DIM_Y_MATERIAL"],
    "VEIO": ["VEIO"],
    "CNC": ["CNC", "OPERAÇÕES"],
    "ALINHAMENTO": ["ALINHAMENTO"],
    "CNC_FUROS_TOTAL": ["CNC_FUROS_TOTAL"],
    "COLUMN_POINT_X_ITEM": ["COLUMN_POINT_X_ITEM"],
    "COLUMN_POINT_Y_ITEM": ["COLUMN_POINT_Y_ITEM"],
    "COLUMN_POINTS_ANGLE": ["COLUMN_POINTS_ANGLE"],
    "COLUMN_BORDER_DESCRIPTION": ["COLUMN_BORDER_DESCRIPTION"],
    "COLUMN_BORDER_FINISHING": ["COLUMN_BORDER_FINISHING"],
    "COD_CLIENTE": ["COD_CLIENTE", "CÓDIGO DO PROJETO"],
    "ROTEIRO": ["ROTEIRO", "REFERÊNCIA"],
    "CATEGORIA": ["CATEGORIA"],
    "SETOR": ["SETOR"],
    "ESTRUTURA": ["ESTRUTURA", "ID MÓDULO"],
    "MODULO_DESC": ["MODULO_DESC", "REFERÊNCIA"],
    "COD_CORTE": ["COD_CORTE", "CÓDIGO MATERIAL"],
    "COR_1C": ["COR_1C"],
    "COR_2C": ["COR_2C"],
    "COR_1P": ["COR_1P"],
    "COR_2P": ["COR_2P"],
    "OBS": ["OBS"],
    "COLUMN_ITEM_DEPTH": ["COLUMN_ITEM_DEPTH"],
    "NOME_MATERIAL": ["NOME DO MATERIAL", "NOME_MATERIAL"],
    "REFERENCIA_MATERIAL": ["REFERÊNCIA DO MATERIAL", "REFERENCIA_MATERIAL"],
  };

  const colIdx = (name: string): number => {
    // Direct match first
    const directIdx = header.indexOf(name);
    if (directIdx >= 0) return directIdx;
    // Try aliases
    const aliases = COLUMN_ALIASES[name];
    if (aliases) {
      for (const alias of aliases) {
        const idx = header.indexOf(alias);
        if (idx >= 0) return idx;
      }
    }
    return -1;
  };

  const hasCNC = colIdx("CNC") >= 0;
  const hasAlinhamento = colIdx("ALINHAMENTO") >= 0;

  // Group rows by ID_UNICO - multiple rows per piece (contour points + edges)
  const pieceMap = new Map<number, { rows: string[][]; }>();

  for (let i = 1; i < lines.length; i++) {
    // For lines with CNC JSON, the JSON may contain semicolons in string values
    // but standard Promob JSON uses commas, so simple split works
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

    // Parse dimensions first to validate
    const comp = parseNum(firstRow[colIdx("COMPRIMENTO")]);
    const prof = parseNum(firstRow[colIdx("PROFUNDIDADE")]);

    // SKIP invalid pieces: must have both dimensions > 0
    if (comp <= 0 || prof <= 0) {
      console.log(`[PromobParser] Peça ID ${idUnico} ignorada: dimensões inválidas (${comp}x${prof})`);
      continue;
    }
    // Parse espessura early (needed for CNC classification)
    const espIdx = colIdx("ESP_CHAPA");
    const depthIdx = colIdx("COLUMN_ITEM_DEPTH");
    const espChapa = espIdx >= 0 ? parseNum(firstRow[espIdx]) : (depthIdx >= 0 ? parseNum(firstRow[depthIdx]) : 15);

    // Parse CNC JSON - try the CNC column first, then try joining remaining columns
    let furos: PromobHole[] = [];
    let fresas: any[] = [];
    let usinagens: Usinagem[] = [];
    let alinhamento: "NORMAL" | "INVERSO" = "NORMAL";

    if (hasCNC) {
      const cncIdx = colIdx("CNC");
      const cncRaw = firstRow.slice(cncIdx).join(";");
      const parsed = parseCNCJson(cncRaw, espChapa);
      furos = parsed.furos;
      fresas = parsed.fresas;
      usinagens = parsed.usinagens;
      alinhamento = parsed.alinhamento;
    }

    // Also check CNC_FUROS_TOTAL field for older formats
    if (furos.length === 0 && usinagens.length === 0) {
      const cncFurosTotal = firstRow[colIdx("CNC_FUROS_TOTAL")] || "";
      if (cncFurosTotal.trim().startsWith("{")) {
        const parsed = parseCNCJson(cncFurosTotal, espChapa);
        furos = parsed.furos;
        usinagens = parsed.usinagens;
      }
    }

    // Override alinhamento from dedicated column if present
    if (hasAlinhamento) {
      const al = (firstRow[colIdx("ALINHAMENTO")] || "").trim().toUpperCase();
      if (al === "INVERSO") alinhamento = "INVERSO";
    }

    // Build ordered contour with border info for edge detection
    const contorno: PromobContourPoint[] = [];
    const seenPoints = new Set<string>();

    interface ContourRow { x: number; y: number; hasBorder: boolean; borderDesc: string; }
    const contourRows: ContourRow[] = [];

    for (const row of rows) {
      const px = parseFloat(row[colIdx("COLUMN_POINT_X_ITEM")]);
      const py = parseFloat(row[colIdx("COLUMN_POINT_Y_ITEM")]);
      if (!isNaN(px) && !isNaN(py)) {
        const key = `${px},${py}`;
        const borderDesc = (row[colIdx("COLUMN_BORDER_DESCRIPTION")] || "").trim();
        if (!seenPoints.has(key)) {
          seenPoints.add(key);
          contorno.push({ X: px, Y: py, ANG: row[colIdx("COLUMN_POINTS_ANGLE")] || "NAO" });
          contourRows.push({ x: px, y: py, hasBorder: borderDesc.length > 0, borderDesc });
        } else if (borderDesc.length > 0) {
          const existing = contourRows.find(c => c.x === px && c.y === py);
          if (existing) {
            existing.hasBorder = true;
            existing.borderDesc = borderDesc;
          }
        }
      }
    }

    // Determine edge bands from contour segments
    let bordaSup = false, bordaInf = false, bordaEsq = false, bordaDir = false;
    const tol = 2.0;

    // espChapa already parsed above

    // Check from border rows
    for (const row of rows) {
      const borderDesc = (row[colIdx("COLUMN_BORDER_DESCRIPTION")] || "").trim();
      if (!borderDesc) continue;

      const borderFinishing = (row[colIdx("COLUMN_BORDER_FINISHING")] || "").trim();
      const px = parseFloat(row[colIdx("COLUMN_POINT_X_ITEM")]);
      const py = parseFloat(row[colIdx("COLUMN_POINT_Y_ITEM")]);

      if (!isNaN(px) && !isNaN(py)) {
        // Detect which edge by the contour point position
        if (Math.abs(py - prof) < tol) bordaSup = true;
        else if (Math.abs(py) < tol) bordaInf = true;
        if (Math.abs(px) < tol) bordaEsq = true;
        else if (Math.abs(px - comp) < tol) bordaDir = true;
      }
    }

    // Also check contour segments method
    for (let ci = 0; ci < contourRows.length; ci++) {
      if (!contourRows[ci].hasBorder) continue;
      const curr = contourRows[ci];
      const next = contourRows[(ci + 1) % contourRows.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;

      if (Math.abs(midY - prof) < tol && Math.abs(curr.y - next.y) < tol) bordaSup = true;
      else if (Math.abs(midY) < tol && Math.abs(curr.y - next.y) < tol) bordaInf = true;
      else if (Math.abs(midX) < tol && Math.abs(curr.x - next.x) < tol) bordaEsq = true;
      else if (Math.abs(midX - comp) < tol && Math.abs(curr.x - next.x) < tol) bordaDir = true;
    }

    // Try to get a better material name: NOME_MATERIAL, CHAPA, or REFERENCIA_MATERIAL
    const materialName = (firstRow[colIdx("NOME_MATERIAL")] || firstRow[colIdx("CHAPA")] || firstRow[colIdx("REFERENCIA_MATERIAL")] || "").trim();

    // SKIP pieces without material name (likely phantom/invalid entries)
    if (!materialName) {
      console.log(`[PromobParser] Peça ID ${idUnico} "${firstRow[colIdx("DESCRICAO")] || "?"}" ignorada: sem material definido`);
      continue;
    }

    const qty = parseInt(firstRow[colIdx("QUANTIDADE")]) || 1;

    pieces.push({
      CLIENTE: firstRow[colIdx("CLIENTE")] || "",
      COD_CLIENTE: firstRow[colIdx("COD_CLIENTE")] || null,
      AMBIENTE: firstRow[colIdx("AMBIENTE")] || "",
      ID_UNICO: idUnico,
      QUANTIDADE: qty,
      DESCRICAO: firstRow[colIdx("DESCRICAO")] || "",
      COMPRIMENTO: comp,
      PROFUNDIDADE: prof,
      CHAPA: materialName,
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
      COMP_CHAPA: parseNum(firstRow[colIdx("COMP_CHAPA")]) || 2750,
      PROF_CHAPA: parseNum(firstRow[colIdx("PROF_CHAPA")]) || 1840,
      ESP_CHAPA: espChapa || 15,
      VEIO: parseInt(firstRow[colIdx("VEIO")]) || 0,
      CNC_A: firstRow[colIdx("CNC_A")] || "",
      CNC_B: firstRow[colIdx("CNC_B")] || "",
      CNC_FUROS_TOTAL: firstRow[colIdx("CNC_FUROS_TOTAL")] || (furos.length > 0 ? "SIM" : "NAO"),
      OBS: firstRow[colIdx("OBS")] || null,
      ALINHAMENTO: alinhamento,
      FRESAS: fresas,
      FUROS: furos,
      USINAGENS: usinagens,
      CONTORNO: contorno,
      HAS_FRESAS_SUP: fresas.length > 0,
      HAS_FRESAS_INF: false,
      HAS_FUROS_SUP: furos.some(f => f.FACE === "SUP"),
      HAS_FUROS_INF: furos.some(f => f.FACE === "INF"),
      HAS_FUROS_TOPOS: false,
      bordaSup,
      bordaInf,
      bordaEsq,
      bordaDir,
    });
  }

  console.log(`[PromobParser] CSV parsed: ${pieces.length} peças, ${pieces.reduce((a, p) => a + p.FUROS.length, 0)} furos, ${pieces.reduce((a, p) => a + p.USINAGENS.length, 0)} usinagens total`);
  return pieces;
}

/**
 * Parse Promob JSON (supports both legacy array format and new Smart Cabinets format)
 */
export function parsePromobJSON(jsonText: string): PromobPiece[] {
  const data = JSON.parse(jsonText);

  // Legacy format: direct array of PromobPiece
  if (Array.isArray(data)) return data as PromobPiece[];

  // New Smart Cabinets format: { TRABALHO, CHAPAS, PECAS }
  if (data.PECAS && Array.isArray(data.PECAS)) {
    return parseSmartFormat(data);
  }

  return [];
}

/**
 * Parse the new Smart Cabinets JSON format
 * Structure: { TRABALHO: [...], CHAPAS: [...], PECAS: [...] }
 */
function parseSmartFormat(data: any): PromobPiece[] {
  const trabalho = data.TRABALHO?.[0] || {};
  const chapasMap = new Map<string, any>();

  if (Array.isArray(data.CHAPAS)) {
    for (const ch of data.CHAPAS) {
      chapasMap.set(String(ch.Codigo), ch);
    }
  }

  return data.PECAS.map((p: any) => {
    const chapa = chapasMap.get(String(p.Chapa)) || {};
    const etiqueta = p.ETIQUETA?.[0] || {};

    // Convert holes from new format (Face/Diametro) to legacy (FACE/DIAM)
    const furos: PromobHole[] = (p.FUROS || []).map((f: any) => ({
      FACE: (f.Face || f.FACE || "SUP").toUpperCase() === "SUP" ? "SUP" as const : "INF" as const,
      X: f.X || 0,
      Y: f.Y || 0,
      DIAM: f.Diametro || f.DIAM || 0,
      Z: f.Z || 0,
    }));

    // Convert contour points
    const contorno: PromobContourPoint[] = (p.CONTORNO || []).map((c: any) => ({
      X: c.X || 0,
      Y: c.Y || 0,
      ANG: c.Reta ? "NAO" : (c.ANG || "NAO"),
    }));

    // Edge bands from Fita_ fields
    const bordaSup = !!(p.Fita_Frontal && p.Fita_Frontal.trim());
    const bordaInf = !!(p.Fita_Traseira && p.Fita_Traseira.trim());
    const bordaEsq = !!(p.Fita_Esquerda && p.Fita_Esquerda.trim());
    const bordaDir = !!(p.Fita_Direita && p.Fita_Direita.trim());

    const al = (etiqueta.Alinhamento || "NORMAL").toUpperCase();

    return {
      CLIENTE: etiqueta.Cliente || trabalho.Cliente || "",
      COD_CLIENTE: null,
      AMBIENTE: etiqueta.Ambiente || trabalho.Ambiente || "",
      ID_UNICO: parseInt(p.ID) || 0,
      QUANTIDADE: p.Quantidade || 1,
      DESCRICAO: p.Nome || "",
      COMPRIMENTO: p.Corte_X || 0,
      PROFUNDIDADE: p.Corte_Y || 0,
      CHAPA: etiqueta.Chapa || chapa.Acabamento || "",
      COR_1C: null,
      COR_2C: null,
      COR_1P: null,
      COR_2P: null,
      ROTEIRO: etiqueta.Roteiro || "",
      CATEGORIA: etiqueta.Categoria || "",
      SETOR: etiqueta.Setor || "",
      ESTRUTURA: parseInt(etiqueta.Estrutura) || 0,
      MODULO_DESC: etiqueta.Estrutura || "",
      COD_CORTE: parseInt(p.Chapa) || 0,
      COMP_CHAPA: chapa.Comprimento || 2750,
      PROF_CHAPA: chapa.Profundidade || 1840,
      ESP_CHAPA: chapa.Espessura || 15,
      VEIO: chapa.Veio ? 1 : 0,
      CNC_A: etiqueta.CNC_A || "",
      CNC_B: etiqueta.CNC_B || "",
      CNC_FUROS_TOTAL: furos.length > 0 ? "SIM" : "NAO",
      OBS: etiqueta.Observacoes || null,
      ALINHAMENTO: al === "INVERSO" ? "INVERSO" as const : "NORMAL" as const,
      FRESAS: p.FRESAS || [],
      FUROS: furos,
      USINAGENS: [],
      CONTORNO: contorno,
      HAS_FRESAS_SUP: false,
      HAS_FRESAS_INF: false,
      HAS_FUROS_SUP: furos.some((f: PromobHole) => f.FACE === "SUP"),
      HAS_FUROS_INF: furos.some((f: PromobHole) => f.FACE === "INF"),
      HAS_FUROS_TOPOS: false,
      bordaSup,
      bordaInf,
      bordaEsq,
      bordaDir,
    } as PromobPiece;
  });
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
    bordaInf: p.bordaInf,
    bordaSup: p.bordaSup,
    bordaEsq: p.bordaEsq,
    bordaDir: p.bordaDir,
    veio: p.VEIO === 1,
    observacao: p.OBS || "",
    furos: p.FUROS,
    usinagens: p.USINAGENS,
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
    bordaSup: p.bordaSup,
    bordaInf: p.bordaInf,
    bordaEsq: p.bordaEsq,
    bordaDir: p.bordaDir,
    furos: p.FUROS,
    fresas: p.FRESAS,
    contorno: p.CONTORNO,
    cncA: p.CNC_A,
    cncB: p.CNC_B,
    observacao: p.OBS || "",
  }));
}
