import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NestingSheet } from "@/types/promob";
import { CuttingPiece } from "@/types/cutting";
import { Calculator, Printer, RotateCcw } from "lucide-react";
import { countSerraCuts } from "@/lib/serraOptimizer";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
  pieces: CuttingPiece[];
}

interface Prices {
  corte: number;     // R$ per saw cut (chapas inteiras na esquadrejadeira)
  cortePeca: number; // R$ per saw cut on Aspire piece sides
  fita: number;      // R$ per metre of edge banding
  furo: number;      // R$ per hole
  fresaMetro: number; // R$ per metre of router travel (Aspire — lado curvo)
  serraMetro: number; // R$ per metre of saw cut (Aspire — lados retos)
}

const DEFAULT_PRICES: Prices = { corte: 3.0, cortePeca: 2.0, fita: 4.5, furo: 0.10, fresaMetro: 8.0, serraMetro: 5.0 };
const PRICES_KEY = "maxcut.orcamento.prices.v3";

function loadPrices(): Prices {
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) return DEFAULT_PRICES;
    const v = JSON.parse(raw);
    return {
      corte: Number(v.corte) || DEFAULT_PRICES.corte,
      cortePeca: Number(v.cortePeca) || DEFAULT_PRICES.cortePeca,
      fita: Number(v.fita) || DEFAULT_PRICES.fita,
      furo: Number(v.furo) || DEFAULT_PRICES.furo,
      fresaMetro: Number(v.fresaMetro) || DEFAULT_PRICES.fresaMetro,
      serraMetro: Number(v.serraMetro) || DEFAULT_PRICES.serraMetro,
    };
  } catch {
    return DEFAULT_PRICES;
  }
}

interface SheetBudget {
  sheetId: number;
  material: string;
  espessura: number;
  numPecas: number;
  numCortes: number;
  fitaMetros: number;
  numFuros: number;
  valorCortes: number;
  valorFita: number;
  valorFuros: number;
  valorTotal: number;
}

interface AspireBudget {
  pieceId: number;
  descricao: string;
  material: string;
  espessura: number;
  quantidade: number;
  width: number;
  height: number;
  perimeterMm: number;
  sides: { index: number; lengthMm: number; kind: "reto" | "curvo"; banded: boolean; cutType: "fresa" | "serra" }[];
  fresaMmUnit: number;
  serraMmUnit: number;
  /** Nº de lados com cutType "serra" (1 corte por lado). Fresa nunca conta como corte. */
  numCortesSerraUnit: number;
  fitaMetrosUnit: number;
  valorFresaUnit: number;
  valorSerraUnit: number;
  /** Valor calculado por corte (R$ corte × numCortesSerraUnit). */
  valorCortesUnit: number;
  valorFitaUnit: number;
  valorTotalUnit: number;
  valorTotalAll: number;
  /** Modo da peça: contour = lados/banding · frisos = N passes individuais */
  mode: "contour" | "frisos";
  /** Quando mode=frisos: número de frisos detectados */
  frisoCount?: number;
  /** Quando mode=frisos: comprimento efetivo (mm) de cada friso (vão útil) */
  frisoLengthMm?: number;
  /** Quando mode=frisos: tipo de corte aplicado (fresa | serra) */
  frisoCutType?: "fresa" | "serra";
}

export function OrcamentoSimplesDialog({ open, onOpenChange, layouts, pieces }: Props) {
  const [prices, setPrices] = useState<Prices>(() => loadPrices());

  useEffect(() => {
    if (open) setPrices(loadPrices());
  }, [open]);

  const persistPrices = (p: Prices) => {
    setPrices(p);
    try { localStorage.setItem(PRICES_KEY, JSON.stringify(p)); } catch {}
  };

  const updatePrice = (key: keyof Prices, val: string) => {
    const num = parseFloat(val.replace(",", "."));
    persistPrices({ ...prices, [key]: isNaN(num) ? 0 : num });
  };

  const aspirePieces = useMemo(() => pieces.filter(p => p.source === "aspire"), [pieces]);
  const sawPieces = useMemo(() => pieces.filter(p => p.source !== "aspire"), [pieces]);
  const sawPieceById = useMemo(() => new Map(sawPieces.map(p => [p.id, p])), [sawPieces]);

  const budgets = useMemo<SheetBudget[]>(() => {
    return layouts.map(sheet => {
      const numCortes = countSerraCuts(sheet);

      let fitaMm = 0;
      let numFuros = 0;
      sheet.pieces.forEach(p => {
        // Saw pieces: tape from edges
        if (p.bordaSup) fitaMm += p.width;
        if (p.bordaInf) fitaMm += p.width;
        if (p.bordaEsq) fitaMm += p.height;
        if (p.bordaDir) fitaMm += p.height;
        // Per-piece holes count override (set by user in the parts table)
        const src = p.pieceId !== undefined ? sawPieceById.get(p.pieceId) : undefined;
        const furosThis = src?.numFurosOrcamento ?? (p.furos?.length ?? 0);
        numFuros += furosThis;
      });
      const fitaMetros = fitaMm / 1000;

      const valorCortes = numCortes * prices.corte;
      const valorFita = fitaMetros * prices.fita;
      const valorFuros = numFuros * prices.furo;

      return {
        sheetId: sheet.id,
        material: sheet.material,
        espessura: sheet.espessura,
        numPecas: sheet.pieces.length,
        numCortes,
        fitaMetros,
        numFuros,
        valorCortes,
        valorFita,
        valorFuros,
        valorTotal: valorCortes + valorFita + valorFuros,
      };
    });
  }, [layouts, prices, sawPieceById]);

  const aspireBudgets = useMemo<AspireBudget[]>(() => {
    return aspirePieces.map(p => {
      const sides = p.aspireSides ?? [];
      const isFrisos = p.aspireMode === "frisos";
      const fitaMmUnit = sides.reduce((a, s) => a + (s.banded ? s.lengthMm : 0), 0);
      const fitaMetrosUnit = fitaMmUnit / 1000;

      // Para FRISOS: comprimento cobrado por friso = aspireFrisoBilledLengthMm
      // (editável). Multiplica pela quantidade de frisos para obter o
      // perímetro total cobrado.
      // Para CONTORNO: usa aspirePerimeter como sempre.
      let perimeterMm: number;
      if (isFrisos) {
        const billedPerFriso = p.aspireFrisoBilledLengthMm
          ?? (p.aspireFrisoLengthMm ?? 0); // fallback retrocompat
        const count = p.aspireFrisoCount ?? sides.length;
        perimeterMm = billedPerFriso * count;
      } else {
        perimeterMm = p.aspirePerimeter ?? sides.reduce((a, s) => a + s.lengthMm, 0);
      }

      // Soma comprimentos por tipo de corte. Frisos = todos seguem aspireFrisoCutType.
      // numCortesSerraUnit = nº de lados/frisos serra (1 corte cada). Fresa nunca conta.
      let fresaMm = 0, serraMm = 0, numCortesSerraUnit = 0;
      if (isFrisos) {
        const ft = p.aspireFrisoCutType ?? "fresa";
        const count = p.aspireFrisoCount ?? 0;
        if (ft === "fresa") {
          fresaMm = perimeterMm;
        } else {
          serraMm = perimeterMm;
          numCortesSerraUnit = count;
        }
      } else {
        sides.forEach(s => {
          const ct = s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra");
          if (ct === "fresa") {
            fresaMm += s.lengthMm;
          } else {
            serraMm += s.lengthMm;
            numCortesSerraUnit += 1;
          }
        });
      }

      const valorFresaUnit = (fresaMm / 1000) * prices.fresaMetro;
      const valorSerraUnit = (serraMm / 1000) * prices.serraMetro;
      const valorCortesUnit = numCortesSerraUnit * prices.cortePeca;
      const valorFitaUnit = fitaMetrosUnit * prices.fita;
      const valorTotalUnit = valorFresaUnit + valorSerraUnit + valorCortesUnit + valorFitaUnit;

      return {
        pieceId: p.id,
        descricao: p.descricao,
        material: p.material,
        espessura: p.espessura,
        quantidade: p.quantidade,
        width: p.largura,
        height: p.altura,
        perimeterMm,
        sides: sides.map(s => ({
          index: s.index,
          lengthMm: s.lengthMm,
          kind: s.kind,
          banded: s.banded,
          cutType: (s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra")) as "fresa" | "serra",
        })),
        fresaMmUnit: fresaMm,
        serraMmUnit: serraMm,
        numCortesSerraUnit,
        fitaMetrosUnit,
        valorFresaUnit,
        valorSerraUnit,
        valorCortesUnit,
        valorFitaUnit,
        valorTotalUnit,
        valorTotalAll: valorTotalUnit * p.quantidade,
        mode: isFrisos ? "frisos" : "contour",
        frisoCount: p.aspireFrisoCount,
        frisoLengthMm: p.aspireFrisoBilledLengthMm ?? p.aspireFrisoLengthMm,
        frisoCutType: p.aspireFrisoCutType,
      };
    });
  }, [aspirePieces, prices]);

  const totals = useMemo(() => {
    const sawCortes = budgets.reduce((a, b) => a + b.numCortes, 0);
    const sawFita = budgets.reduce((a, b) => a + b.fitaMetros, 0);
    const sawFuros = budgets.reduce((a, b) => a + b.numFuros, 0);
    const sawValorCortes = budgets.reduce((a, b) => a + b.valorCortes, 0);
    const sawValorFita = budgets.reduce((a, b) => a + b.valorFita, 0);
    const sawValorFuros = budgets.reduce((a, b) => a + b.valorFuros, 0);

    const aspFresaM = aspireBudgets.reduce((a, b) => a + (b.fresaMmUnit / 1000) * b.quantidade, 0);
    const aspSerraM = aspireBudgets.reduce((a, b) => a + (b.serraMmUnit / 1000) * b.quantidade, 0);
    const aspCortes = aspireBudgets.reduce((a, b) => a + b.numCortesSerraUnit * b.quantidade, 0);
    const aspFita = aspireBudgets.reduce((a, b) => a + b.fitaMetrosUnit * b.quantidade, 0);
    const aspValorFresa = aspireBudgets.reduce((a, b) => a + b.valorFresaUnit * b.quantidade, 0);
    const aspValorSerra = aspireBudgets.reduce((a, b) => a + b.valorSerraUnit * b.quantidade, 0);
    const aspValorCortes = aspireBudgets.reduce((a, b) => a + b.valorCortesUnit * b.quantidade, 0);
    const aspValorFita = aspireBudgets.reduce((a, b) => a + b.valorFitaUnit * b.quantidade, 0);

    // Furos só existem no fluxo de Serra (chapas). Aspire não cobra furos.
    const valorFuros = sawValorFuros;
    const valorTotal = sawValorCortes + sawValorFita + sawValorFuros
      + aspValorFresa + aspValorSerra + aspValorCortes + aspValorFita;
    const valorSemFuros = valorTotal - valorFuros;

    return {
      sawCortes, sawFita, sawFuros, sawValorCortes, sawValorFita, sawValorFuros,
      aspFresaM, aspSerraM, aspCortes, aspFita,
      aspValorFresa, aspValorSerra, aspValorCortes, aspValorFita,
      valorTotal, valorSemFuros, valorFuros,
    };
  }, [budgets, aspireBudgets]);

  const handlePrint = () => {
    const today = new Date().toLocaleDateString("pt-BR");
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloqueado"); return; }

    const css = `
      @page { size:A4 portrait; margin:14mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Inter,system-ui,sans-serif; color:#000; background:#fff; padding:8px; font-size:11px; }
      .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:14px; }
      .logo { font-size:18px; font-weight:800; }
      .green { color:#059669; }
      .title { font-size:16px; font-weight:700; text-align:center; margin-bottom:14px; }
      .info { background:#f8f8f8; padding:8px; border-radius:4px; margin-bottom:12px; display:flex; gap:24px; }
      h2 { font-size:12px; margin:14px 0 6px; padding-bottom:3px; border-bottom:1px solid #999; text-transform:uppercase; letter-spacing:.5px; }
      table { width:100%; border-collapse:collapse; margin-bottom:10px; }
      th { background:#f0f0f0; padding:5px; text-align:left; font-size:10px; text-transform:uppercase; border-bottom:2px solid #ccc; }
      td { padding:4px 5px; border-bottom:1px solid #eee; }
      .r { text-align:right; }
      .c { text-align:center; }
      .total-row { background:#f0f0f0; font-weight:700; border-top:2px solid #333; }
      .pricing { margin-top:6px; padding:7px; border:1px solid #ccc; border-radius:4px; font-size:10px; background:#fafafa; }
      .pricing-title { font-weight:700; margin-bottom:3px; }
      .grand { display:flex; justify-content:space-between; align-items:center; font-size:18px; font-weight:800; margin-top:12px; padding:12px; border:2px solid #333; border-radius:4px; }
      .footer { margin-top:18px; font-size:9px; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:6px; }
      .side-list { font-size:9px; color:#555; margin-top:2px; line-height:1.4; }
      .side-list b { color:#000; }
      table.aspire { table-layout:fixed; }
      .piece-header td { background:#eef2f7; border-top:2px solid #555; border-bottom:1px solid #bbb; padding:7px 5px; vertical-align:top; }
      .piece-header td.piece-total { background:#dde6f0; }
      .service-row td { font-size:10px; color:#222; border-bottom:1px dashed #e0e0e0; padding:5px; }
      .service-row td.service { padding-left:18px; color:#444; font-style:italic; }
      .service-row td.subtotal { font-weight:600; }
    `;

    let sheetRows = "";
    budgets.forEach(b => {
      sheetRows += `<tr>
        <td><b>#${b.sheetId}</b></td>
        <td>${b.material}</td>
        <td class="c">${b.espessura}mm</td>
        <td class="c">${b.numPecas}</td>
        <td class="c">${b.numCortes}</td>
        <td class="r">${b.fitaMetros.toFixed(2)}m</td>
        <td class="c">${b.numFuros}</td>
        <td class="r"><b>R$ ${b.valorTotal.toFixed(2)}</b></td>
      </tr>`;
    });

    // Cada peça vira um GRUPO com cabeçalho + sub-linhas por serviço.
    // 7 colunas fixas: Peça/Serviço | Detalhe | Material | W×H | Quant. | Unitário | Subtotal
    let aspireRows = "";
    aspireBudgets.forEach(b => {
      // Descrição secundária:
      //  • frisos → "N frisos de Lt mm cada"
      //  • contour → lista os lados detectados
      const sidesList = b.mode === "frisos"
        ? `<b>${b.frisoCount ?? b.sides.length}</b> frisos de <b>${(b.frisoLengthMm ?? 0).toFixed(1)} mm</b> cada`
        : b.sides
            .map(s => `Lado ${s.index} (${s.kind} · <i>${s.cutType}</i>): <b>${s.lengthMm.toFixed(1)}mm</b>${s.banded ? " ✓ fita" : ""}`)
            .join(" · ");

      // Cabeçalho da peça
      aspireRows += `<tr class="piece-header">
        <td><b>${b.descricao}</b><div class="side-list">${sidesList}</div></td>
        <td class="c">—</td>
        <td>${b.material}<br/><span style="font-size:9px;color:#666">${b.espessura}mm</span></td>
        <td class="c">${b.width}×${b.height}</td>
        <td class="c">${b.quantidade} un.</td>
        <td class="r">—</td>
        <td class="r piece-total"><b>R$ ${b.valorTotalAll.toFixed(2)}</b></td>
      </tr>`;

      const fresaM = b.fresaMmUnit / 1000;
      const serraM = b.serraMmUnit / 1000;
      // Quando é friso, o "detalhe" do serviço descreve N×Lt em vez de "X m por peça".
      const frisoDetalhe = b.mode === "frisos"
        ? `${b.frisoCount ?? 0} frisos × ${(b.frisoLengthMm ?? 0).toFixed(1)} mm`
        : null;
      // Sub-linha de serviço — mesmas 7 colunas, alinhadas com o cabeçalho.
      const subRow = (servico: string, detalhe: string, unitario: string, totalAll: number) =>
        `<tr class="service-row">
          <td class="service">↳ ${servico}</td>
          <td>${detalhe}</td>
          <td></td>
          <td></td>
          <td class="c">×${b.quantidade}</td>
          <td class="r">${unitario}</td>
          <td class="r subtotal">R$ ${totalAll.toFixed(2)}</td>
        </tr>`;

      if (fresaM > 0) {
        aspireRows += subRow(
          "Fresa (router)",
          frisoDetalhe ?? `${fresaM.toFixed(2)} m por peça`,
          `R$ ${prices.fresaMetro.toFixed(2)}/m`,
          b.valorFresaUnit * b.quantidade,
        );
      }
      if (serraM > 0) {
        aspireRows += subRow(
          "Serra (metro linear)",
          frisoDetalhe ?? `${serraM.toFixed(2)} m por peça`,
          `R$ ${prices.serraMetro.toFixed(2)}/m`,
          b.valorSerraUnit * b.quantidade,
        );
      }
      if (b.numCortesSerraUnit > 0 && b.valorCortesUnit > 0) {
        aspireRows += subRow(
          "Cortes (peça)",
          `${b.numCortesSerraUnit} corte(s) por peça`,
          `R$ ${prices.cortePeca.toFixed(2)}/corte`,
          b.valorCortesUnit * b.quantidade,
        );
      }
      if (b.fitaMetrosUnit > 0) {
        aspireRows += subRow(
          "Fita de borda",
          `${b.fitaMetrosUnit.toFixed(2)} m por peça`,
          `R$ ${prices.fita.toFixed(2)}/m`,
          b.valorFitaUnit * b.quantidade,
        );
      }
    });

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>${css}</style></head><body>
      <div class="header">
        <div class="logo">⚡ MAX<span class="green">CUT</span></div>
        <div style="font-size:10px;color:#888">${today}</div>
      </div>
      <div class="title">ORÇAMENTO DE CORTE</div>
      <div class="info">
        <div><b>Data:</b> ${today}</div>
        <div><b>Chapas:</b> ${budgets.length}</div>
        <div><b>Peças usinadas:</b> ${aspireBudgets.length}</div>
      </div>

      ${budgets.length > 0 ? `
      <h2>Corte em Serra (Chapas)</h2>
      <table>
        <thead><tr>
          <th>Chapa</th><th>Material</th><th class="c">Esp.</th><th class="c">Peças</th>
          <th class="c">Cortes</th><th class="r">Fita</th><th class="c">Furos</th><th class="r">Valor</th>
        </tr></thead>
        <tbody>${sheetRows}
          <tr class="total-row">
            <td colspan="4" class="r">TOTAIS</td>
            <td class="c">${totals.sawCortes}</td>
            <td class="r">${totals.sawFita.toFixed(2)}m</td>
            <td class="c">${totals.sawFuros}</td>
            <td class="r">R$ ${(totals.sawValorCortes + totals.sawValorFita + totals.sawValorFuros).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>` : ""}

      ${aspireBudgets.length > 0 ? `
      <h2>Peças Usinadas — composição por serviço</h2>
      <table class="aspire">
        <colgroup>
          <col style="width:26%" />
          <col style="width:22%" />
          <col style="width:14%" />
          <col style="width:11%" />
          <col style="width:9%" />
          <col style="width:9%" />
          <col style="width:9%" />
        </colgroup>
        <thead><tr>
          <th>Peça / Serviço</th>
          <th>Detalhe</th>
          <th>Material</th>
          <th class="c">W×H</th>
          <th class="c">Quant.</th>
          <th class="r">Unitário</th>
          <th class="r">Subtotal</th>
        </tr></thead>
        <tbody>${aspireRows}
          <tr class="total-row">
            <td colspan="6" class="r">TOTAL PEÇAS USINADAS</td>
            <td class="r">R$ ${(totals.aspValorFresa + totals.aspValorSerra + totals.aspValorCortes + totals.aspValorFita).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>` : ""}

      <div class="pricing">
        <div class="pricing-title">VALORES UNITÁRIOS APLICADOS</div>
        <div>
          Corte de serra (chapa): R$ ${prices.corte.toFixed(2)} cada · 
          Corte por peça: R$ ${prices.cortePeca.toFixed(2)} cada · 
          Fita de borda: R$ ${prices.fita.toFixed(2)}/m · 
          Furo: R$ ${prices.furo.toFixed(2)} cada · 
          Fresa (router): R$ ${prices.fresaMetro.toFixed(2)}/m · 
          Serra (metro linear): R$ ${prices.serraMetro.toFixed(2)}/m
        </div>
      </div>

      <div class="grand">
        <span style="font-size:13px;font-weight:600;color:#555">Total sem furos: R$ ${totals.valorSemFuros.toFixed(2)}</span>
        <span>Total com furos: R$ ${totals.valorTotal.toFixed(2)}</span>
      </div>
      <div class="footer">Orçamento gerado em ${today} — Válido por 30 dias</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const isEmpty = layouts.length === 0 && aspirePieces.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Orçamento de Corte
          </DialogTitle>
        </DialogHeader>

        {isEmpty ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Importe peças e otimize (ou importe um arquivo Aspire) para gerar o orçamento.
          </div>
        ) : (
          <>
            <div className="rounded border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Valores aplicados (editáveis)</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => persistPrices(DEFAULT_PRICES)}
                >
                  <RotateCcw className="h-3 w-3" /> Restaurar padrão
                </Button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">R$ corte (chapa)</Label>
                  <Input type="number" step="0.01" min={0} value={prices.corte}
                    onChange={(e) => updatePrice("corte", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground" title="Cobrado por cada lado/friso de uma peça Aspire configurado como Serra">R$ corte (peça)</Label>
                  <Input type="number" step="0.01" min={0} value={prices.cortePeca}
                    onChange={(e) => updatePrice("cortePeca", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">R$/m fita</Label>
                  <Input type="number" step="0.01" min={0} value={prices.fita}
                    onChange={(e) => updatePrice("fita", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">R$ por furo</Label>
                  <Input type="number" step="0.01" min={0} value={prices.furo}
                    onChange={(e) => updatePrice("furo", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">R$/m fresa</Label>
                  <Input type="number" step="0.01" min={0} value={prices.fresaMetro}
                    onChange={(e) => updatePrice("fresaMetro", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">R$/m serra (Aspire)</Label>
                  <Input type="number" step="0.01" min={0} value={prices.serraMetro}
                    onChange={(e) => updatePrice("serraMetro", e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
            </div>

            {budgets.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Corte em Serra</div>
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="text-[10px] uppercase text-muted-foreground">
                        <th className="px-2 py-2 text-left">Chapa</th>
                        <th className="px-2 py-2 text-left">Material</th>
                        <th className="px-2 py-2 text-center">Esp.</th>
                        <th className="px-2 py-2 text-center">Peças</th>
                        <th className="px-2 py-2 text-center">Cortes</th>
                        <th className="px-2 py-2 text-right">Fita</th>
                        <th className="px-2 py-2 text-center">Furos</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map(b => (
                        <tr key={b.sheetId} className="border-t border-border">
                          <td className="px-2 py-1.5 font-mono">#{b.sheetId}</td>
                          <td className="px-2 py-1.5">{b.material}</td>
                          <td className="px-2 py-1.5 text-center">{b.espessura}mm</td>
                          <td className="px-2 py-1.5 text-center">{b.numPecas}</td>
                          <td className="px-2 py-1.5 text-center">{b.numCortes}</td>
                          <td className="px-2 py-1.5 text-right">{b.fitaMetros.toFixed(2)}m</td>
                          <td className="px-2 py-1.5 text-center">{b.numFuros}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">R$ {b.valorTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aspireBudgets.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Peças Usinadas (Aspire / Router)
                </div>
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="text-[10px] uppercase text-muted-foreground">
                        <th className="px-2 py-2 text-left">Peça</th>
                        <th className="px-2 py-2 text-center">W×H</th>
                        <th className="px-2 py-2 text-center">Qt</th>
                        <th className="px-2 py-2 text-right">Fresa/un.</th>
                        <th className="px-2 py-2 text-right">Serra/un.</th>
                        <th className="px-2 py-2 text-center" title="Lados/frisos com cutType=serra. Multiplica pelo R$ corte.">Cortes/un.</th>
                        <th className="px-2 py-2 text-right">Fita/un.</th>
                        <th className="px-2 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aspireBudgets.map(b => {
                        const piece = aspirePieces.find(p => p.id === b.pieceId);
                        const isFrisos = piece?.aspireMode === "frisos";
                        return (
                          <tr key={b.pieceId} className="border-t border-border align-top">
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{b.descricao}</div>
                              <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                                {isFrisos ? (
                                  <div className="font-mono">
                                    {piece?.aspireFrisoCount} frisos × {piece?.aspireFrisoLengthMm?.toFixed(1)}mm (passe único)
                                  </div>
                                ) : (
                                  b.sides.map(s => (
                                    <div key={s.index} className="flex items-center gap-1.5">
                                      <span className="font-mono">Lado {s.index}</span>
                                      <span className={s.kind === "curvo" ? "text-primary" : ""}>({s.kind})</span>
                                      <span className={`text-[9px] px-1 rounded uppercase font-semibold ${s.cutType === "fresa" ? "bg-primary/20 text-primary" : "bg-secondary/40 text-foreground"}`}>
                                        {s.cutType}
                                      </span>
                                      <span className="font-mono">{s.lengthMm.toFixed(1)}mm</span>
                                      {s.banded && <span className="text-[9px] px-1 rounded bg-accent text-accent-foreground">fita</span>}
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono text-[10px]">{b.width}×{b.height}</td>
                            <td className="px-2 py-1.5 text-center">{b.quantidade}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{(b.fresaMmUnit/1000).toFixed(2)}m</td>
                            <td className="px-2 py-1.5 text-right font-mono">{(b.serraMmUnit/1000).toFixed(2)}m</td>
                            <td className="px-2 py-1.5 text-center">{b.numCortesSerraUnit}</td>
                            <td className="px-2 py-1.5 text-right">{isFrisos ? "—" : `${b.fitaMetrosUnit.toFixed(2)}m`}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">R$ {b.valorTotalAll.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={budgets.length > 0 ? "grid grid-cols-2 gap-2" : ""}>
              {budgets.length > 0 && (
                <div className="rounded border border-border bg-muted/40 p-3 flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground">Total sem Furos</span>
                  <span className="text-lg font-bold">R$ {totals.valorSemFuros.toFixed(2)}</span>
                </div>
              )}
              <div className="rounded border-2 border-primary/40 bg-primary/5 p-3 flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">
                  {budgets.length > 0 ? "Total com Furos" : "Total"}
                </span>
                <span className="text-lg font-bold text-primary">R$ {totals.valorTotal.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!isEmpty && (
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
