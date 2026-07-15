import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel,
  PageOrientation,
} from "docx";
import { saveAs } from "file-saver";
import type { CompanyInfo } from "./companyStore";
import type { Client, ClientPriceTable } from "@/types/commercial";
import type { CuttingPiece } from "@/types/cutting";

interface ImageBudgetLine {
  descricao: string;
  largura: number;
  altura: number;
  espessura: number;
  quantidade: number;
  areaM2Unit: number;
  areaM2Total: number;
  fitaMUnit: number;
  fitaMTotal: number;
  furosUnit: number;
  furosTotal: number;
  totalAll: number;
  tipoProduto?: string;
}

interface ExportParams {
  company: CompanyInfo;
  client?: Client | null;
  prices: ClientPriceTable;
  observacoes: string;
  imageBudgets: ImageBudgetLine[];
  imageTotals: { qtd: number; area: number; fita: number; furos: number; total: number };
  totals: {
    subtotalBruto: number;
    descontoPct: number;
    valorDesconto: number;
    valorTotalSemImposto: number;
    impostoPct: number;
    valorImposto: number;
    valorTotal: number;
  };
  imagensReferencia: string[];
  quoteNumber?: number;
}

const BORDER = { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function tcell(text: string, opts: { bold?: boolean; align?: "left"|"right"|"center"; shade?: string; width?: number } = {}): TableCell {
  return new TableCell({
    borders: BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align === "right" ? AlignmentType.RIGHT : opts.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, size: 18 })],
    })],
  });
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: "png"|"jpg" } | null {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const type = m[1].toLowerCase().startsWith("p") ? "png" : "jpg";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type };
}

/**
 * Gera e baixa um .docx com o orçamento, replicando o layout do PDF:
 * cabeçalho da empresa, dados do cliente, tabela de peças, totais,
 * observações e imagens de referência.
 */
export async function exportOrcamentoDocx(params: ExportParams): Promise<void> {
  const { company, client, prices, observacoes, imageBudgets, imageTotals, totals, imagensReferencia, quoteNumber } = params;
  const today = new Date().toLocaleDateString("pt-BR");

  // ---- Header logo ----
  const headerChildren: (Paragraph)[] = [];
  const logoImg = company.logoDataUrl ? dataUrlToBytes(company.logoDataUrl) : null;
  if (logoImg) {
    headerChildren.push(new Paragraph({
      children: [new ImageRun({
        type: logoImg.type,
        data: logoImg.bytes,
        transformation: { width: 140, height: 60 },
        altText: { title: "Logo", description: "Logo da empresa", name: "logo" },
      })],
    }));
  }
  headerChildren.push(new Paragraph({
    children: [new TextRun({ text: company.nome || "Empresa", bold: true, size: 28 })],
  }));
  const companyLine = [company.cnpj, company.telefone, company.email, company.endereco].filter(Boolean).join(" · ");
  if (companyLine) {
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: companyLine, size: 18, color: "555555" })] }));
  }
  headerChildren.push(new Paragraph({ children: [new TextRun({ text: `Data: ${today}${quoteNumber ? ` · Nº ${quoteNumber}` : ""}`, size: 18, color: "888888" })] }));

  // ---- Client block ----
  const clientChildren: Paragraph[] = [];
  if (client) {
    clientChildren.push(new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: client.nome, bold: true, size: 24 })],
    }));
    const info = [
      client.cnpjCpf ? `CNPJ/CPF: ${client.cnpjCpf}` : "",
      client.responsavel ? `Resp.: ${client.responsavel}` : "",
      client.telefone ? `Tel: ${client.telefone}` : "",
      client.email ? `E-mail: ${client.email}` : "",
    ].filter(Boolean).join(" · ");
    if (info) clientChildren.push(new Paragraph({ children: [new TextRun({ text: info, size: 18 })] }));
    if (client.endereco) clientChildren.push(new Paragraph({ children: [new TextRun({ text: `Endereço: ${client.endereco}`, size: 18 })] }));
  }

  // ---- Title ----
  const title = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "ORÇAMENTO", bold: true, size: 36 })],
  });

  // ---- Pieces table ----
  const contentWidth = 9360;
  const cols = [3200, 1100, 900, 1100, 900, 900, 1260]; // Descrição, Tipo, Qt, Área, Fita, Dobr, Subtotal
  const header = new TableRow({
    tableHeader: true,
    children: [
      tcell("Peça", { bold: true, shade: "F0F0F0", width: cols[0] }),
      tcell("Tipo", { bold: true, shade: "F0F0F0", width: cols[1] }),
      tcell("Qt", { bold: true, align: "center", shade: "F0F0F0", width: cols[2] }),
      tcell("Área/un", { bold: true, align: "right", shade: "F0F0F0", width: cols[3] }),
      tcell("Fita m/un", { bold: true, align: "right", shade: "F0F0F0", width: cols[4] }),
      tcell("Dobr.", { bold: true, align: "center", shade: "F0F0F0", width: cols[5] }),
      tcell("Subtotal", { bold: true, align: "right", shade: "F0F0F0", width: cols[6] }),
    ],
  });
  const rows: TableRow[] = [header];
  for (const b of imageBudgets) {
    rows.push(new TableRow({ children: [
      new TableCell({
        borders: BORDERS, width: { size: cols[0], type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({ children: [new TextRun({ text: b.descricao, bold: true, size: 18 })] }),
          new Paragraph({ children: [new TextRun({ text: `${b.largura}×${b.altura}×${b.espessura} mm`, size: 14, color: "666666" })] }),
        ],
      }),
      tcell(b.tipoProduto ?? "—", { width: cols[1] }),
      tcell(String(b.quantidade), { align: "center", width: cols[2] }),
      tcell(`${b.areaM2Unit.toFixed(3)} m²`, { align: "right", width: cols[3] }),
      tcell(`${b.fitaMUnit.toFixed(2)} m`, { align: "right", width: cols[4] }),
      tcell(String(b.furosUnit), { align: "center", width: cols[5] }),
      tcell(`R$ ${b.totalAll.toFixed(2)}`, { align: "right", bold: true, width: cols[6] }),
    ]}));
  }
  // total row
  rows.push(new TableRow({ children: [
    tcell("TOTAIS", { bold: true, align: "right", shade: "F0F0F0", width: cols[0] }),
    tcell("", { shade: "F0F0F0", width: cols[1] }),
    tcell(String(imageTotals.qtd), { align: "center", bold: true, shade: "F0F0F0", width: cols[2] }),
    tcell(`${imageTotals.area.toFixed(3)} m²`, { align: "right", bold: true, shade: "F0F0F0", width: cols[3] }),
    tcell(`${imageTotals.fita.toFixed(2)} m`, { align: "right", bold: true, shade: "F0F0F0", width: cols[4] }),
    tcell(String(imageTotals.furos), { align: "center", bold: true, shade: "F0F0F0", width: cols[5] }),
    tcell(`R$ ${imageTotals.total.toFixed(2)}`, { align: "right", bold: true, shade: "F0F0F0", width: cols[6] }),
  ]}));

  const piecesTable = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: cols,
    rows,
  });

  // ---- Totals block ----
  const totalsChildren: Paragraph[] = [
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `Subtotal: R$ ${totals.subtotalBruto.toFixed(2)}`, size: 20 })] }),
  ];
  if (totals.descontoPct > 0) {
    totalsChildren.push(new Paragraph({ children: [new TextRun({ text: `Desconto (${totals.descontoPct.toFixed(1)}%): − R$ ${totals.valorDesconto.toFixed(2)}`, size: 20, color: "059669" })] }));
  }
  if (totals.impostoPct > 0) {
    totalsChildren.push(new Paragraph({ children: [new TextRun({ text: `Imposto (${totals.impostoPct.toFixed(1)}%): + R$ ${totals.valorImposto.toFixed(2)}`, size: 20, color: "B45309" })] }));
  }
  totalsChildren.push(new Paragraph({
    spacing: { before: 120 },
    children: [new TextRun({ text: `TOTAL: R$ ${totals.valorTotal.toFixed(2)}`, bold: true, size: 32, color: "0369A1" })],
  }));

  // ---- Observações ----
  const obsChildren: Paragraph[] = [];
  if (observacoes.trim()) {
    obsChildren.push(new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: "Observações", bold: true, size: 22 })],
    }));
    for (const line of observacoes.split("\n")) {
      obsChildren.push(new Paragraph({ children: [new TextRun({ text: line, size: 18 })] }));
    }
  }

  // ---- Imagens de referência ----
  const imgsChildren: Paragraph[] = [];
  if (imagensReferencia.length > 0) {
    imgsChildren.push(new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: "Imagens de referência", bold: true, size: 22 })],
    }));
    for (const src of imagensReferencia.slice(0, 12)) {
      const im = dataUrlToBytes(src);
      if (!im) continue;
      try {
        imgsChildren.push(new Paragraph({
          spacing: { before: 120 },
          children: [new ImageRun({
            type: im.type,
            data: im.bytes,
            transformation: { width: 420, height: 300 },
            altText: { title: "Referência", description: "Imagem de referência", name: "ref" },
          })],
        }));
      } catch { /* skip */ }
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children: [
        ...headerChildren,
        ...clientChildren,
        title,
        piecesTable,
        ...totalsChildren,
        ...obsChildren,
        ...imgsChildren,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `orcamento${quoteNumber ? `-${quoteNumber}` : ""}-${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
}
