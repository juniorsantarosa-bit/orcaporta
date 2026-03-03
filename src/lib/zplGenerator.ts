import { PlacedNestingPiece } from "@/types/promob";

/**
 * Generate ZPL II commands for Zebra GT800 thermal printer
 * Label size: 100mm x 60mm (4" x 2.4") at 203 DPI
 */
export function generateZPL(piece: PlacedNestingPiece, sheetId: number, material: string): string {
  const edges = [
    piece.bordaSup && "S",
    piece.bordaInf && "I",
    piece.bordaEsq && "E",
    piece.bordaDir && "D",
  ].filter(Boolean).join("+") || "—";

  const holesCount = piece.furos?.length || 0;
  const dims = `${piece.width} x ${piece.height} x ${piece.espessura}`;

  // ZPL at 203 DPI: 1mm ≈ 8 dots
  const zpl = [
    "^XA",                          // Start format
    "^CI28",                        // UTF-8 encoding
    "^PW812",                       // Print width ~100mm
    "^LL480",                       // Label length ~60mm
    "^LH0,0",                       // Label home
    
    // Border box
    "^FO10,10^GB792,460,2^FS",
    
    // Piece label (large, top-left)
    `^FO30,25^A0N,50,50^FD${piece.label}^FS`,
    
    // Description
    `^FO120,30^A0N,35,30^FD${piece.descricao}^FS`,
    
    // Separator line
    "^FO20,75^GB772,1,1^FS",
    
    // Dimensions
    "^FO30,90^A0N,22,20^FDDimen:^FS",
    `^FO130,85^A0N,30,28^FD${dims}^FS`,
    
    // Material
    "^FO30,130^A0N,22,20^FDChapa:^FS",
    `^FO130,125^A0N,28,26^FD${material}^FS`,
    
    // Sheet ID
    `^FO550,90^A0N,22,20^FDCh: ${sheetId}^FS`,
    
    // Separator
    "^FO20,165^GB772,1,1^FS",
    
    // Piece miniature (simplified rectangle)
    generatePieceMiniatureZPL(piece, 30, 180),
    
    // Edge bands info
    `^FO350,185^A0N,24,22^FDFitas: ${edges}^FS`,
    
    // Holes count
    holesCount > 0 ? `^FO350,220^A0N,24,22^FDFuros: ${holesCount}^FS` : "",
    
    // Separator
    "^FO20,320^GB772,1,1^FS",
    
    // Client
    `^FO30,335^A0N,22,20^FDCliente:^FS`,
    `^FO150,330^A0N,28,26^FD${piece.cliente}^FS`,
    
    // Module
    `^FO450,335^A0N,22,20^FDMod:^FS`,
    `^FO520,330^A0N,28,26^FD${piece.moduloDesc}^FS`,
    
    // Piece ID
    `^FO30,375^A0N,20,18^FDID: ${piece.pieceId}^FS`,
    
    // Barcode with piece ID
    `^FO350,360^BCN,60,Y,N,N^FD${piece.pieceId}-${sheetId}-${piece.label}^FS`,
    
    "^XZ",                          // End format
  ].filter(Boolean).join("\n");

  return zpl;
}

function generatePieceMiniatureZPL(piece: PlacedNestingPiece, ox: number, oy: number): string {
  // Scale piece to fit in ~280x120 dot area
  const maxW = 280, maxH = 120;
  const scale = Math.min(maxW / piece.width, maxH / piece.height);
  const w = Math.round(piece.width * scale);
  const h = Math.round(piece.height * scale);
  
  const cmds: string[] = [];
  
  // Piece outline
  cmds.push(`^FO${ox},${oy}^GB${w},${h},2^FS`);
  
  // Edge band indicators (thicker lines)
  if (piece.bordaSup) cmds.push(`^FO${ox},${oy}^GB${w},4,4^FS`);
  if (piece.bordaInf) cmds.push(`^FO${ox},${oy + h - 4}^GB${w},4,4^FS`);
  if (piece.bordaEsq) cmds.push(`^FO${ox},${oy}^GB4,${h},4^FS`);
  if (piece.bordaDir) cmds.push(`^FO${ox + w - 4},${oy}^GB4,${h},4^FS`);
  
  // Drill holes (small circles approximated as boxes)
  piece.furos?.slice(0, 8).forEach(hole => {
    const hx = Math.round(ox + hole.X * scale);
    const hy = Math.round(oy + hole.Y * scale);
    const r = Math.max(Math.round(hole.DIAM * scale / 2), 3);
    cmds.push(`^FO${hx - r},${hy - r}^GE${r * 2},${r * 2},2^FS`);
  });
  
  return cmds.join("\n");
}

/**
 * Generate all labels for a sheet and trigger print via raw ZPL
 */
export function generateAllLabelsZPL(pieces: PlacedNestingPiece[], sheetId: number, material: string): string {
  return pieces.map(p => generateZPL(p, sheetId, material)).join("\n");
}

/**
 * Send ZPL to printer - opens a new window with the raw ZPL for printing
 * In production, this would use the Browser Print API or direct socket connection
 */
export function printZPL(zpl: string): void {
  // Create a printable window with the ZPL content
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return;
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Etiquetas Zebra GT800 - ZPL</title>
      <style>
        body { font-family: monospace; font-size: 11px; margin: 20px; background: #f5f5f5; }
        .header { font-family: sans-serif; margin-bottom: 16px; }
        .header h2 { margin: 0 0 4px 0; font-size: 16px; }
        .header p { margin: 0; color: #666; font-size: 12px; }
        .instructions { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-family: sans-serif; font-size: 12px; }
        .instructions ol { margin: 8px 0 0 0; padding-left: 20px; }
        .instructions li { margin-bottom: 4px; }
        pre { background: white; border: 1px solid #ddd; border-radius: 6px; padding: 12px; white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; }
        .actions { margin-top: 12px; display: flex; gap: 8px; }
        button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
        .btn-copy { background: #1976d2; color: white; }
        .btn-download { background: #388e3c; color: white; }
        .btn-copy:hover { background: #1565c0; }
        .btn-download:hover { background: #2e7d32; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🏷️ Etiquetas ZPL — Zebra GT800</h2>
        <p>${zpl.split('^XA').length - 1} etiquetas geradas</p>
      </div>
      <div class="instructions">
        <strong>Como imprimir:</strong>
        <ol>
          <li>Copie o código ZPL abaixo</li>
          <li>Abra o <strong>Zebra Setup Utilities</strong> ou envie via <strong>porta serial/USB</strong></li>
          <li>Cole o código e envie para a impressora</li>
          <li>Ou salve como arquivo <code>.zpl</code> e envie via rede</li>
        </ol>
      </div>
      <pre id="zpl">${zpl}</pre>
      <div class="actions">
        <button class="btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('zpl').textContent).then(()=>this.textContent='✓ Copiado!')">📋 Copiar ZPL</button>
        <button class="btn-download" onclick="downloadZPL()">💾 Salvar .zpl</button>
      </div>
      <script>
        function downloadZPL() {
          const blob = new Blob([document.getElementById('zpl').textContent], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'etiquetas_zebra.zpl';
          a.click();
          URL.revokeObjectURL(a.href);
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
