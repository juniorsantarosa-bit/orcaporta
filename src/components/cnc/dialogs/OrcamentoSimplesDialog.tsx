import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NestingSheet } from "@/types/promob";
import { CuttingPiece } from "@/types/cutting";
import { Client, ClientPriceTable, PieceMetaMap, QuoteStatus } from "@/types/commercial";
import { Calculator, Printer, RotateCcw, Save, UserCircle2 } from "lucide-react";
import { countSerraCuts } from "@/lib/serraOptimizer";
import { toast } from "sonner";
import { DEFAULT_PRICE_TABLE, getQuote, saveQuote } from "@/lib/commercialStore";
import { loadCompany, CompanyInfo } from "@/lib/companyStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
  pieces: CuttingPiece[];
  /** Cliente selecionado (define preços e dados do PDF) */
  client?: Client | null;
  /** Quando setado, "Salvar" atualiza esse orçamento em vez de criar novo */
  editingQuoteId?: string | null;
  /** Callback quando um orçamento é salvo (cria ou atualiza) */
  onSavedQuote?: (id: string) => void;
  /** Permite editar peças (OS, data recebimento, etc) direto daqui */
  onUpdatePiece?: (id: number, patch: Partial<CuttingPiece>) => void;
}

const PRICES_KEY = "maxcut.orcamento.prices.v3";

function loadPrices(): ClientPriceTable {
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) return DEFAULT_PRICE_TABLE;
    const v = JSON.parse(raw);
    return {
      corte: Number(v.corte) || DEFAULT_PRICE_TABLE.corte,
      cortePeca: Number(v.cortePeca) || DEFAULT_PRICE_TABLE.cortePeca,
      fita: Number(v.fita) || DEFAULT_PRICE_TABLE.fita,
      fitaManual: Number(v.fitaManual) || DEFAULT_PRICE_TABLE.fitaManual,
      furo: Number(v.furo) || DEFAULT_PRICE_TABLE.furo,
      fresaMetro: Number(v.fresaMetro) || DEFAULT_PRICE_TABLE.fresaMetro,
      serraMetro: Number(v.serraMetro) || DEFAULT_PRICE_TABLE.serraMetro,
      chapaM2: Number(v.chapaM2) || 0,
      precoM2: Number(v.precoM2) || DEFAULT_PRICE_TABLE.precoM2,
      precoFitaMetro: Number(v.precoFitaMetro) || DEFAULT_PRICE_TABLE.precoFitaMetro,
      precoFuroDobradica: Number(v.precoFuroDobradica) || DEFAULT_PRICE_TABLE.precoFuroDobradica,
    };
  } catch {
    return DEFAULT_PRICE_TABLE;
  }
}

interface SheetBudget {
  sheetId: number;
  material: string;
  espessura: number;
  numPecas: number;
  numCortes: number;
  fitaMetros: number;
  fitaManualMetros: number;
  numFuros: number;
  valorCortes: number;
  valorFita: number;
  valorFitaManual: number;
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
  sides: { index: number; lengthMm: number; kind: "reto" | "curvo"; banded: boolean; bandedManual: boolean; cutType: "fresa" | "serra" }[];
  fresaMmUnit: number;
  serraMmUnit: number;
  numCortesSerraUnit: number;
  fitaMetrosUnit: number;
  fitaManualMetrosUnit: number;
  valorFresaUnit: number;
  valorSerraUnit: number;
  valorCortesUnit: number;
  valorFitaUnit: number;
  valorFitaManualUnit: number;
  valorTotalUnit: number;
  valorTotalAll: number;
  mode: "contour" | "frisos";
  frisoCount?: number;
  frisoLengthMm?: number;
  frisoCutType?: "fresa" | "serra";
  /** Para o modo frisos: dimensões legíveis do vão (largura × altura em mm) */
  vaoLargura?: number;
  vaoAltura?: number;
  /** true se cada "friso" é na verdade um nicho fechado (4 lados) */
  isNicho?: boolean;
}

export function OrcamentoSimplesDialog({
  open, onOpenChange, layouts, pieces,
  client, editingQuoteId, onSavedQuote, onUpdatePiece,
}: Props) {
  const [prices, setPrices] = useState<ClientPriceTable>(() => loadPrices());
  const [observacoes, setObservacoes] = useState("");
  const [enderecoEntregaPadrao, setEnderecoEntregaPadrao] = useState("");
  const [status, setStatus] = useState<QuoteStatus>({ enviado: false, pago: false });
  const [pieceMeta, setPieceMeta] = useState<PieceMetaMap>({});
  const [descontoPct, setDescontoPct] = useState<number>(0);

  /** Marca quando há mudanças não salvas no orçamento atual. */
  const [dirty, setDirty] = useState(false);
  /** Marca o snapshot pós-salvamento, para que mudanças de cálculo não disparem alerta */
  const dirtyRef = { current: dirty };

  // Carrega preços corretos: do cliente se houver, senão dos defaults locais
  useEffect(() => {
    if (!open) return;
    if (client) {
      setPrices(client.precos);
    } else {
      setPrices(loadPrices());
    }
  }, [open, client]);

  // Quando editando um orçamento já salvo, traz observações/status/pieceMeta
  useEffect(() => {
    if (!open) return;
    if (editingQuoteId) {
      const q = getQuote(editingQuoteId);
      if (q) {
        setObservacoes(q.observacoes ?? "");
        setEnderecoEntregaPadrao(q.enderecoEntregaPadrao ?? "");
        setStatus(q.status);
        setPieceMeta(q.pieceMeta ?? {});
        setDescontoPct(q.descontoPct ?? 0);
        return;
      }
    }
    // Novo orçamento — reseta meta
    setObservacoes("");
    setEnderecoEntregaPadrao(client?.endereco ?? "");
    setStatus({ enviado: false, pago: false });
    setPieceMeta({});
    setDescontoPct(0);
  }, [open, editingQuoteId, client]);

  // Reseta o flag dirty ao abrir/fechar
  useEffect(() => {
    if (open) setDirty(false);
  }, [open, editingQuoteId]);

  // Considera "modificado" qualquer alteração nas peças, layouts ou observações
  // depois que o diálogo já abriu (ignora a montagem inicial).
  const mountedRef = useState({ v: false })[0];
  useEffect(() => {
    if (!open) { mountedRef.v = false; return; }
    if (!mountedRef.v) { mountedRef.v = true; return; }
    setDirty(true);
  }, [pieces, layouts, observacoes, enderecoEntregaPadrao, status, descontoPct, mountedRef, open]);

  // Bloqueia fechar a aba do navegador quando há orçamento não salvo
  useEffect(() => {
    if (!open || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, dirty]);

  const persistPrices = (p: ClientPriceTable) => {
    setPrices(p);
    setDirty(true);
    if (!client) {
      try { localStorage.setItem(PRICES_KEY, JSON.stringify(p)); } catch {}
    }
  };

  const updatePrice = (key: keyof ClientPriceTable, val: string) => {
    const num = parseFloat(val.replace(",", "."));
    persistPrices({ ...prices, [key]: isNaN(num) ? 0 : num });
  };

  const aspirePieces = useMemo(() => pieces.filter(p => p.source === "aspire"), [pieces]);
  const sawPieces = useMemo(() => pieces.filter(p => p.source !== "aspire"), [pieces]);
  const sawPieceById = useMemo(() => new Map(sawPieces.map(p => [p.id, p])), [sawPieces]);

  /** Peças vindas da importação por imagem (sem layouts/aspire). */
  const imagePieces = useMemo(
    () => pieces.filter(p => p.source !== "aspire" && !layouts.some(s => s.pieces.some(pp => pp.pieceId === p.id))),
    [pieces, layouts],
  );

  /** Empresa para o cabeçalho do PDF. */
  const [company, setCompany] = useState<CompanyInfo>(() => loadCompany());
  useEffect(() => { if (open) setCompany(loadCompany()); }, [open]);

  /** Orçamento por peça (modo imagem): área × R$/m² + fita × R$/m + furos × R$/furo. */
  const imageBudgets = useMemo(() => {
    return imagePieces.map(p => {
      const qty = Math.max(1, p.quantidade || 1);
      const areaM2Unit = (p.largura * p.altura) / 1_000_000;
      const perimM = (2 * (p.largura + p.altura)) / 1000;
      const dupla = p.bordaDuplaProvencal !== false; // default true
      const fitaMUnit = p.fitaMetrosOverride !== undefined
        ? p.fitaMetrosOverride
        : perimM * (dupla ? 2 : 1);
      const furosUnit = p.furosDobradica ?? 0;

      const precoM2 = prices.precoM2 ?? DEFAULT_PRICE_TABLE.precoM2!;
      const precoFitaM = prices.precoFitaMetro ?? DEFAULT_PRICE_TABLE.precoFitaMetro!;
      const precoFuro = prices.precoFuroDobradica ?? DEFAULT_PRICE_TABLE.precoFuroDobradica!;

      const valArea = areaM2Unit * precoM2;
      const valFita = fitaMUnit * precoFitaM;
      const valFuros = furosUnit * precoFuro;
      const totalUnitCalc = valArea + valFita + valFuros;
      const hasOverride = typeof p.precoUnitarioOverride === "number";
      const totalUnit = hasOverride ? (p.precoUnitarioOverride as number) : totalUnitCalc;

      return {
        pieceId: p.id,
        descricao: p.descricao,
        largura: p.largura,
        altura: p.altura,
        espessura: p.espessura,
        quantidade: qty,
        areaM2Unit,
        areaM2Total: areaM2Unit * qty,
        fitaMUnit,
        fitaMTotal: fitaMUnit * qty,
        furosUnit,
        furosTotal: furosUnit * qty,
        dupla,
        valArea, valFita, valFuros,
        totalUnitCalc,
        totalUnit,
        hasOverride,
        totalAll: totalUnit * qty,
      };
    });
  }, [imagePieces, prices]);

  const imageTotals = useMemo(() => {
    const acc = { qtd: 0, area: 0, fita: 0, furos: 0, valArea: 0, valFita: 0, valFuros: 0, total: 0 };
    for (const b of imageBudgets) {
      acc.qtd += b.quantidade;
      acc.area += b.areaM2Total;
      acc.fita += b.fitaMTotal;
      acc.furos += b.furosTotal;
      acc.valArea += b.valArea * b.quantidade;
      acc.valFita += b.valFita * b.quantidade;
      acc.valFuros += b.valFuros * b.quantidade;
      acc.total += b.totalAll;
    }
    return acc;
  }, [imageBudgets]);

  const budgets = useMemo<SheetBudget[]>(() => {
    return layouts.map(sheet => {
      const numCortes = countSerraCuts(sheet);
      let fitaMm = 0;
      let fitaManualMm = 0;
      let numFuros = 0;
      sheet.pieces.forEach(p => {
        if (p.bordaSup) fitaMm += p.width;
        if (p.bordaInf) fitaMm += p.width;
        if (p.bordaEsq) fitaMm += p.height;
        if (p.bordaDir) fitaMm += p.height;
        const src = p.pieceId !== undefined ? sawPieceById.get(p.pieceId) : undefined;
        if (src?.bordaManualSup) fitaManualMm += p.width;
        if (src?.bordaManualInf) fitaManualMm += p.width;
        if (src?.bordaManualEsq) fitaManualMm += p.height;
        if (src?.bordaManualDir) fitaManualMm += p.height;
        const furosThis = src?.numFurosOrcamento ?? (p.furos?.length ?? 0);
        numFuros += furosThis;
      });
      const fitaMetros = fitaMm / 1000;
      const fitaManualMetros = fitaManualMm / 1000;
      const valorCortes = numCortes * prices.corte;
      const valorFita = fitaMetros * prices.fita;
      const valorFitaManual = fitaManualMetros * prices.fitaManual;
      const valorFuros = numFuros * prices.furo;
      return {
        sheetId: sheet.id, material: sheet.material, espessura: sheet.espessura,
        numPecas: sheet.pieces.length, numCortes,
        fitaMetros, fitaManualMetros, numFuros,
        valorCortes, valorFita, valorFitaManual, valorFuros,
        valorTotal: valorCortes + valorFita + valorFitaManual + valorFuros,
      };
    });
  }, [layouts, prices, sawPieceById]);

  const aspireBudgets = useMemo<AspireBudget[]>(() => {
    return aspirePieces.map(p => {
      const sides = p.aspireSides ?? [];
      const isFrisos = p.aspireMode === "frisos";
      const fitaMmUnit = sides.reduce((a, s) => a + (s.banded ? s.lengthMm : 0), 0);
      const fitaMetrosUnit = fitaMmUnit / 1000;
      const fitaManualMmUnit = sides.reduce((a, s) => a + (s.bandedManual ? s.lengthMm : 0), 0);
      const fitaManualMetrosUnit = fitaManualMmUnit / 1000;

      // Heurística "nicho": friso fechado em 4 lados (largura ≈ altura ≥ ~50mm)
      // e a peça importada tem MAIS de uma usinagem dessas. Visualmente é um vão
      // retangular interno cercado.
      const larguraVao = p.aspireFrisoLarguraMm ?? 0;
      const alturaVao = p.aspireFrisoAlturaMm ?? 0;
      const isNicho = isFrisos && larguraVao >= 50 && alturaVao >= 50;

      let perimeterMm: number;
      if (isFrisos) {
        // Para nichos (vão retangular fechado) o cobrado por unidade
        // é o PERÍMETRO REAL do vão: 2×(L+A). Para frisos lineares
        // mantém a fórmula 2L+2A já calculada (ida + volta).
        const tool = p.aspireToolDiameter ?? 6;
        const billedPerFriso = isNicho
          ? 2 * (larguraVao + alturaVao)
          : (p.aspireFrisoBilledLengthMm ?? p.aspireFrisoLengthMm ?? 0);
        const count = p.aspireFrisoCount ?? sides.length;
        perimeterMm = billedPerFriso * count;
      } else {
        perimeterMm = p.aspirePerimeter ?? sides.reduce((a, s) => a + s.lengthMm, 0);
      }

      let fresaMm = 0, serraMm = 0, numCortesSerraUnit = 0;
      if (isFrisos) {
        const ft = p.aspireFrisoCutType ?? "fresa";
        const count = p.aspireFrisoCount ?? 0;
        if (ft === "fresa") fresaMm = perimeterMm;
        else { serraMm = perimeterMm; numCortesSerraUnit = count; }
      } else {
        sides.forEach(s => {
          const ct = s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra");
          if (ct === "fresa") fresaMm += s.lengthMm;
          else { serraMm += s.lengthMm; numCortesSerraUnit += 1; }
        });
      }

      const valorFresaUnit = (fresaMm / 1000) * prices.fresaMetro;
      const valorSerraUnit = (serraMm / 1000) * prices.serraMetro;
      const valorCortesUnit = numCortesSerraUnit * prices.cortePeca;
      const valorFitaUnit = fitaMetrosUnit * prices.fita;
      const valorFitaManualUnit = fitaManualMetrosUnit * prices.fitaManual;
      const valorTotalUnit = valorFresaUnit + valorSerraUnit + valorCortesUnit + valorFitaUnit + valorFitaManualUnit;

      return {
        pieceId: p.id, descricao: p.descricao, material: p.material,
        espessura: p.espessura, quantidade: p.quantidade,
        width: p.largura, height: p.altura, perimeterMm,
        sides: sides.map(s => ({
          index: s.index, lengthMm: s.lengthMm, kind: s.kind, banded: s.banded,
          bandedManual: !!s.bandedManual,
          cutType: (s.cutType ?? (s.kind === "curvo" ? "fresa" : "serra")) as "fresa" | "serra",
        })),
        fresaMmUnit: fresaMm, serraMmUnit: serraMm, numCortesSerraUnit,
        fitaMetrosUnit, fitaManualMetrosUnit,
        valorFresaUnit, valorSerraUnit, valorCortesUnit, valorFitaUnit, valorFitaManualUnit,
        valorTotalUnit, valorTotalAll: valorTotalUnit * p.quantidade,
        mode: isFrisos ? "frisos" : "contour",
        frisoCount: p.aspireFrisoCount,
        frisoLengthMm: isNicho
          ? 2 * (larguraVao + alturaVao)
          : (p.aspireFrisoBilledLengthMm ?? p.aspireFrisoLengthMm),
        frisoCutType: p.aspireFrisoCutType,
        vaoLargura: larguraVao || undefined,
        vaoAltura: alturaVao || undefined,
        isNicho,
      };
    });
  }, [aspirePieces, prices]);

  const totals = useMemo(() => {
    const sawValorCortes = budgets.reduce((a, b) => a + b.valorCortes, 0);
    const sawValorFita = budgets.reduce((a, b) => a + b.valorFita, 0);
    const sawValorFitaManual = budgets.reduce((a, b) => a + b.valorFitaManual, 0);
    const sawValorFuros = budgets.reduce((a, b) => a + b.valorFuros, 0);
    const sawCortes = budgets.reduce((a, b) => a + b.numCortes, 0);
    const sawFita = budgets.reduce((a, b) => a + b.fitaMetros, 0);
    const sawFitaManual = budgets.reduce((a, b) => a + b.fitaManualMetros, 0);
    const sawFuros = budgets.reduce((a, b) => a + b.numFuros, 0);

    const aspValorFresa = aspireBudgets.reduce((a, b) => a + b.valorFresaUnit * b.quantidade, 0);
    const aspValorSerra = aspireBudgets.reduce((a, b) => a + b.valorSerraUnit * b.quantidade, 0);
    const aspValorCortes = aspireBudgets.reduce((a, b) => a + b.valorCortesUnit * b.quantidade, 0);
    const aspValorFita = aspireBudgets.reduce((a, b) => a + b.valorFitaUnit * b.quantidade, 0);
    const aspValorFitaManual = aspireBudgets.reduce((a, b) => a + b.valorFitaManualUnit * b.quantidade, 0);

    const valorFuros = sawValorFuros;
    const subtotalBruto = sawValorCortes + sawValorFita + sawValorFitaManual + sawValorFuros
      + aspValorFresa + aspValorSerra + aspValorCortes + aspValorFita + aspValorFitaManual
      + imageTotals.total;
    const descontoPctClamp = Math.max(0, Math.min(100, descontoPct || 0));
    const valorDesconto = subtotalBruto * (descontoPctClamp / 100);
    const valorTotal = subtotalBruto - valorDesconto;
    const valorSemFuros = valorTotal - valorFuros * (1 - descontoPctClamp / 100);

    return {
      sawCortes, sawFita, sawFitaManual, sawFuros,
      sawValorCortes, sawValorFita, sawValorFitaManual, sawValorFuros,
      aspValorFresa, aspValorSerra, aspValorCortes, aspValorFita, aspValorFitaManual,
      subtotalBruto, valorDesconto, descontoPct: descontoPctClamp,
      valorTotal, valorSemFuros, valorFuros,
    };
  }, [budgets, aspireBudgets, imageTotals, descontoPct]);

  // -------- handlers --------

  const updatePieceMeta = (pieceId: number, patch: Partial<PieceMetaMap[number]>) => {
    setPieceMeta(prev => ({
      ...prev,
      [pieceId]: { ...(prev[pieceId] ?? { recebido: false }), ...patch },
    }));
    setDirty(true);
    // Mantém em sincronia o estado "comercial" da própria peça (simplifica relatórios)
    if (onUpdatePiece && (patch.recebido !== undefined || patch.os !== undefined
      || patch.dataRecebimento !== undefined || patch.enderecoEntrega !== undefined)) {
      onUpdatePiece(pieceId, {
        ...(patch.recebido !== undefined ? { materialRecebido: patch.recebido } : {}),
        ...(patch.os !== undefined ? { os: patch.os } : {}),
        ...(patch.dataRecebimento !== undefined ? { dataRecebimento: patch.dataRecebimento } : {}),
        ...(patch.enderecoEntrega !== undefined ? { enderecoEntrega: patch.enderecoEntrega } : {}),
      });
    }
  };

  const handleSaveQuote = () => {
    if (pieces.length === 0) { toast.error("Nada para salvar."); return; }
    const saved = saveQuote({
      id: editingQuoteId ?? undefined,
      clientId: client?.id,
      clienteNome: client?.nome,
      enderecoEntregaPadrao,
      precos: prices,
      pieces, layouts,
      status,
      pieceMeta,
      totalCalculado: totals.valorTotal,
      observacoes,
    });
    onSavedQuote?.(saved.id);
    setDirty(false);
    toast.success(`Orçamento #${saved.numero} salvo`);
    return saved;
  };

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
      .client-card { border:1px solid #ccc; border-radius:4px; padding:10px; margin-bottom:12px; background:#fafafa; }
      .client-card .row { display:flex; gap:18px; flex-wrap:wrap; font-size:10.5px; margin-bottom:3px; }
      .client-card b { color:#000; }
      .client-card .name { font-size:14px; font-weight:700; margin-bottom:4px; }
      .info { background:#f8f8f8; padding:8px; border-radius:4px; margin-bottom:12px; display:flex; gap:24px; flex-wrap:wrap; font-size:10.5px; }
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
      .obs { margin-top:8px; padding:8px; background:#fafafa; border:1px solid #ddd; border-radius:4px; font-size:10px; }
      .obs b { display:block; margin-bottom:3px; }
    `;

    // -------- Cliente block --------
    const clientBlock = client ? `
      <div class="client-card">
        <div class="name">${escapeHtml(client.nome)}${client.razaoSocial ? ` <span style="font-size:10px;color:#666;font-weight:400">— ${escapeHtml(client.razaoSocial)}</span>` : ""}</div>
        <div class="row">
          ${client.cnpjCpf ? `<div><b>CNPJ/CPF:</b> ${escapeHtml(client.cnpjCpf)}</div>` : ""}
          ${client.responsavel ? `<div><b>Responsável:</b> ${escapeHtml(client.responsavel)}</div>` : ""}
          ${client.telefone ? `<div><b>Tel:</b> ${escapeHtml(client.telefone)}</div>` : ""}
          ${client.email ? `<div><b>E-mail:</b> ${escapeHtml(client.email)}</div>` : ""}
        </div>
        ${client.endereco ? `<div class="row"><div><b>Endereço:</b> ${escapeHtml(client.endereco)}</div></div>` : ""}
        ${enderecoEntregaPadrao && enderecoEntregaPadrao !== client.endereco
          ? `<div class="row"><div><b>Entrega:</b> ${escapeHtml(enderecoEntregaPadrao)}</div></div>` : ""}
      </div>` : (enderecoEntregaPadrao
        ? `<div class="client-card"><div class="row"><div><b>Endereço de entrega:</b> ${escapeHtml(enderecoEntregaPadrao)}</div></div></div>`
        : "");

    // -------- Sheet rows (Serra) --------
    let sheetRows = "";
    budgets.forEach(b => {
      sheetRows += `<tr>
        <td><b>#${b.sheetId}</b></td>
        <td>${escapeHtml(b.material)}</td>
        <td class="c">${b.espessura}mm</td>
        <td class="c">${b.numPecas}</td>
        <td class="c">${b.numCortes}</td>
        <td class="r">${b.fitaMetros.toFixed(2)}m${b.fitaManualMetros > 0 ? `<br/><span style="font-size:9px;color:#b45309">+${b.fitaManualMetros.toFixed(2)}m manual</span>` : ""}</td>
        <td class="c">${b.numFuros}</td>
        <td class="r"><b>R$ ${b.valorTotal.toFixed(2)}</b></td>
      </tr>`;
    });

    // -------- Aspire rows (peças usinadas) --------
    let aspireRows = "";
    aspireBudgets.forEach(b => {
      const piece = aspirePieces.find(p => p.id === b.pieceId);
      const larguraVao = piece?.aspireFrisoLarguraMm;
      const alturaVao = piece?.aspireFrisoAlturaMm;
      const billedPerFriso = b.frisoLengthMm ?? 0;
      const meta = pieceMeta[b.pieceId];
      const osTag = meta?.os
        ? ` <span style="font-size:9px;color:#0a64a6">[OS: ${escapeHtml(meta.os)}]</span>`
        : (piece?.os ? ` <span style="font-size:9px;color:#0a64a6">[OS: ${escapeHtml(piece.os)}]</span>` : "");

      const sidesList = b.mode === "frisos"
        ? (b.isNicho
            ? `<b>${b.frisoCount}</b> ${b.frisoCount === 1 ? "nicho" : "nichos"} de <b>${b.vaoLargura?.toFixed(0)}×${b.vaoAltura?.toFixed(0)} mm</b>` +
              ` <span style="color:#666">— perímetro <b>${(b.frisoLengthMm ?? 0).toFixed(0)} mm</b> cada · total <b>${(((b.frisoLengthMm ?? 0) * (b.frisoCount ?? 0))/1000).toFixed(2)} m</b></span>`
            : `<b>${b.frisoCount ?? b.sides.length}</b> frisos de <b>${(b.frisoLengthMm ?? 0).toFixed(1)} mm</b> cada` +
              (larguraVao && alturaVao ? ` <span style="color:#666">(vão ${larguraVao.toFixed(0)}×${alturaVao.toFixed(0)} mm)</span>` : "")
          )
        : b.sides
            .map(s => `Lado ${s.index} (${s.kind} · <i>${s.cutType}</i>): <b>${s.lengthMm.toFixed(1)}mm</b>${s.banded ? " ✓ fita" : ""}${s.bandedManual ? " ✓ fita manual" : ""}`)
            .join(" · ");

      aspireRows += `<tr class="piece-header">
        <td><b>${escapeHtml(b.descricao)}</b>${osTag}<div class="side-list">${sidesList}</div></td>
        <td class="c">—</td>
        <td>${escapeHtml(b.material)}<br/><span style="font-size:9px;color:#666">${b.espessura}mm</span></td>
        <td class="c">${b.width}×${b.height}</td>
        <td class="c">${b.quantidade} un.</td>
        <td class="r">—</td>
        <td class="r piece-total"><b>R$ ${b.valorTotalAll.toFixed(2)}</b></td>
      </tr>`;

      const fresaM = b.fresaMmUnit / 1000;
      const serraM = b.serraMmUnit / 1000;
      const frisoDetalhe = b.mode === "frisos"
        ? `${b.frisoCount ?? 0} frisos × ${billedPerFriso.toFixed(1)} mm`
        : null;
      const subRow = (servico: string, detalhe: string, unitario: string, totalAll: number) =>
        `<tr class="service-row">
          <td class="service">↳ ${servico}</td>
          <td>${detalhe}</td>
          <td></td><td></td>
          <td class="c">×${b.quantidade}</td>
          <td class="r">${unitario}</td>
          <td class="r subtotal">R$ ${totalAll.toFixed(2)}</td>
        </tr>`;

      if (fresaM > 0) {
        aspireRows += subRow("Fresa (router)",
          frisoDetalhe ?? `${fresaM.toFixed(2)} m por peça`,
          `R$ ${prices.fresaMetro.toFixed(2)}/m`,
          b.valorFresaUnit * b.quantidade);
      }
      if (serraM > 0) {
        aspireRows += subRow("Serra (metro linear)",
          frisoDetalhe ?? `${serraM.toFixed(2)} m por peça`,
          `R$ ${prices.serraMetro.toFixed(2)}/m`,
          b.valorSerraUnit * b.quantidade);
      }
      if (b.numCortesSerraUnit > 0 && b.valorCortesUnit > 0) {
        aspireRows += subRow("Cortes (peça)",
          `${b.numCortesSerraUnit} corte(s) por peça`,
          `R$ ${prices.cortePeca.toFixed(2)}/corte`,
          b.valorCortesUnit * b.quantidade);
      }
      if (b.fitaMetrosUnit > 0) {
        aspireRows += subRow("Fita de borda",
          `${b.fitaMetrosUnit.toFixed(2)} m por peça`,
          `R$ ${prices.fita.toFixed(2)}/m`,
          b.valorFitaUnit * b.quantidade);
      }
      if (b.fitaManualMetrosUnit > 0) {
        aspireRows += subRow("Fita manual (recortes internos / curvos)",
          `${b.fitaManualMetrosUnit.toFixed(2)} m por peça`,
          `R$ ${prices.fitaManual.toFixed(2)}/m`,
          b.valorFitaManualUnit * b.quantidade);
      }
    });

    // -------- Image-mode rows --------
    let imageRows = "";
    imageBudgets.forEach(b => {
      imageRows += `<tr>
        <td><b>${escapeHtml(b.descricao)}</b><div style="font-size:9px;color:#666">${b.largura}×${b.altura}×${b.espessura} mm${b.dupla ? " · <i>fita dupla (provençal)</i>" : ""}</div></td>
        <td class="c">${b.quantidade}</td>
        <td class="r">${b.areaM2Unit.toFixed(3)} m²<br/><span style="font-size:9px;color:#666">${b.areaM2Total.toFixed(3)} m² total</span></td>
        <td class="r">${b.fitaMUnit.toFixed(2)} m<br/><span style="font-size:9px;color:#666">${b.fitaMTotal.toFixed(2)} m total</span></td>
        <td class="c">${b.furosUnit}${b.furosUnit > 0 ? `<br/><span style="font-size:9px;color:#666">${b.furosTotal} total</span>` : ""}</td>
        <td class="r">R$ ${b.totalUnit.toFixed(2)}</td>
        <td class="r"><b>R$ ${b.totalAll.toFixed(2)}</b></td>
      </tr>`;
    });

    // -------- Header da empresa --------
    const headerCompany = `
      <div class="header">
        <div style="display:flex;align-items:center;gap:14px">
          ${company.logoDataUrl ? `<img src="${company.logoDataUrl}" alt="Logo" style="max-height:54px;max-width:160px;object-fit:contain" />` : `<div class="logo">⚡ ${escapeHtml(company.nome || "MAXCUT")}</div>`}
          <div style="font-size:10px;line-height:1.4;color:#444">
            ${company.logoDataUrl ? `<div style="font-weight:700;font-size:13px;color:#000">${escapeHtml(company.nome)}</div>` : ""}
            ${company.cnpj ? `<div>CNPJ/CPF: ${escapeHtml(company.cnpj)}</div>` : ""}
            ${company.telefone ? `<div>${escapeHtml(company.telefone)}${company.email ? ` · ${escapeHtml(company.email)}` : ""}</div>` : (company.email ? `<div>${escapeHtml(company.email)}</div>` : "")}
            ${company.endereco ? `<div>${escapeHtml(company.endereco)}</div>` : ""}
          </div>
        </div>
        <div style="font-size:10px;color:#888;text-align:right">${today}</div>
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>${css}</style></head><body>
      ${headerCompany}
      <div class="title">ORÇAMENTO</div>

      ${clientBlock}

      <div class="info">
        <div><b>Data:</b> ${today}</div>
        ${imageBudgets.length > 0 ? `<div><b>Itens:</b> ${imageBudgets.length}</div><div><b>Qtd total:</b> ${imageTotals.qtd}</div>` : ""}
        ${budgets.length > 0 ? `<div><b>Chapas:</b> ${budgets.length}</div>` : ""}
        ${aspireBudgets.length > 0 ? `<div><b>Peças usinadas:</b> ${aspireBudgets.length}</div>` : ""}
      </div>

      ${imageBudgets.length > 0 ? `
      <h2>Peças (m² · fita de borda · dobradiças)</h2>
      <table>
        <thead><tr>
          <th>Peça</th><th class="c">Qtd</th><th class="r">Área</th>
          <th class="r">Fita</th><th class="c">Dobradiças</th>
          <th class="r">Unitário</th><th class="r">Subtotal</th>
        </tr></thead>
        <tbody>${imageRows}
          <tr class="total-row">
            <td class="r">TOTAIS</td>
            <td class="c">${imageTotals.qtd}</td>
            <td class="r">${imageTotals.area.toFixed(3)} m²</td>
            <td class="r">${imageTotals.fita.toFixed(2)} m</td>
            <td class="c">${imageTotals.furos}</td>
            <td></td>
            <td class="r">R$ ${imageTotals.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>` : ""}

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
          <col style="width:26%" /><col style="width:22%" /><col style="width:14%" />
          <col style="width:11%" /><col style="width:9%" /><col style="width:9%" /><col style="width:9%" />
        </colgroup>
        <thead><tr>
          <th>Peça / Serviço</th><th>Detalhe</th><th>Material</th>
          <th class="c">W×H</th><th class="c">Quant.</th><th class="r">Unitário</th><th class="r">Subtotal</th>
        </tr></thead>
        <tbody>${aspireRows}
          <tr class="total-row">
            <td colspan="6" class="r">TOTAL PEÇAS USINADAS</td>
            <td class="r">R$ ${(totals.aspValorFresa + totals.aspValorSerra + totals.aspValorCortes + totals.aspValorFita).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>` : ""}

      <div class="pricing">
        <div class="pricing-title">VALORES UNITÁRIOS APLICADOS${client ? ` — ${escapeHtml(client.nome)}` : ""}</div>
        <div>
          ${imageBudgets.length > 0 ? `m² peça: R$ ${(prices.precoM2 ?? 0).toFixed(2)} · Fita: R$ ${(prices.precoFitaMetro ?? 0).toFixed(2)}/m · Furo dobradiça: R$ ${(prices.precoFuroDobradica ?? 0).toFixed(2)} cada` : ""}
          ${(budgets.length > 0 || aspireBudgets.length > 0) ? `<br/>Corte serra: R$ ${prices.corte.toFixed(2)} · Corte peça: R$ ${prices.cortePeca.toFixed(2)} · Fita: R$ ${prices.fita.toFixed(2)}/m · Fresa: R$ ${prices.fresaMetro.toFixed(2)}/m · Serra: R$ ${prices.serraMetro.toFixed(2)}/m` : ""}
        </div>
      </div>

      ${observacoes ? `<div class="obs"><b>Observações</b>${escapeHtml(observacoes).replace(/\n/g, "<br/>")}</div>` : ""}

      <div class="grand">
        <span style="font-size:13px;font-weight:600;color:#555">${budgets.length > 0 ? `Total sem furos: R$ ${totals.valorSemFuros.toFixed(2)}` : ""}</span>
        <span>Total: R$ ${totals.valorTotal.toFixed(2)}</span>
      </div>
      <div class="footer">${escapeHtml(company.rodape || "Orçamento válido por 30 dias")} — gerado em ${today}</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const isEmpty = layouts.length === 0 && aspirePieces.length === 0 && imageBudgets.length === 0;

  /** Pergunta antes de fechar / imprimir se há mudanças não salvas */
  const confirmSaveBeforeAction = (action: () => void, actionLabel: string) => {
    if (isEmpty || !dirty) { action(); return; }
    const r = window.confirm(
      `Há alterações não salvas neste orçamento.\n\n` +
      `OK = Salvar e ${actionLabel}\n` +
      `Cancelar = ${actionLabel} sem salvar`,
    );
    if (r) {
      const saved = handleSaveQuote();
      if (!saved) return;
    }
    action();
  };

  const handleClose = () => confirmSaveBeforeAction(() => onOpenChange(false), "fechar");
  const handlePrintWithCheck = () => confirmSaveBeforeAction(handlePrint, "imprimir");

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) { handleClose(); } else { onOpenChange(true); }
    }}>
      <DialogContent className="max-w-[1100px] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Orçamento de Corte
            {editingQuoteId && <span className="text-xs text-amber-500 font-normal">(editando salvo)</span>}
          </DialogTitle>
        </DialogHeader>

        {isEmpty ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Importe peças e otimize para gerar o orçamento.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
            <div className="space-y-3">
              {/* Cliente + endereço de entrega padrão */}
              <div className="rounded border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <UserCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Cliente & Entrega</span>
                </div>
                {client ? (
                  <div className="text-xs space-y-0.5">
                    <div><b>{client.nome}</b>{client.razaoSocial && <span className="text-muted-foreground"> — {client.razaoSocial}</span>}</div>
                    {(client.cnpjCpf || client.responsavel) && (
                      <div className="text-muted-foreground">
                        {client.cnpjCpf && <span>CNPJ/CPF: {client.cnpjCpf}</span>}
                        {client.responsavel && <span> · Resp.: {client.responsavel}</span>}
                      </div>
                    )}
                    {(client.telefone || client.email) && (
                      <div className="text-muted-foreground">
                        {client.telefone && <span>{client.telefone}</span>}
                        {client.email && <span> · {client.email}</span>}
                      </div>
                    )}
                    <div className="text-[10px] text-primary mt-1">✓ Valores negociados deste cliente serão usados</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Nenhum cliente selecionado — usando valores padrão. Use <b className="not-italic">Cliente</b> na barra para selecionar.
                  </div>
                )}
                <div className="mt-2">
                  <Label className="text-[10px] uppercase">Endereço de entrega padrão</Label>
                  <Input
                    value={enderecoEntregaPadrao}
                    onChange={(e) => setEnderecoEntregaPadrao(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Pode ser sobrescrito por peça"
                  />
                </div>
              </div>

              {/* Status do orçamento */}
              <div className="rounded border border-border p-3 bg-muted/30 grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={status.enviado}
                    onCheckedChange={(v) => setStatus(s => ({
                      ...s, enviado: !!v,
                      dataEnvio: v && !s.dataEnvio ? new Date().toISOString() : s.dataEnvio,
                    }))}
                  />
                  <span>Orçamento enviado</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={status.pago}
                    onCheckedChange={(v) => setStatus(s => ({
                      ...s, pago: !!v,
                      dataPagamento: v && !s.dataPagamento ? new Date().toISOString() : s.dataPagamento,
                    }))}
                  />
                  <span>Pago</span>
                </label>
                <div className="text-[10px] text-muted-foreground self-center">
                  Recebimento de material: por peça (na lista abaixo).
                </div>
              </div>

              {/* Preços */}
              <div className="rounded border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    Valores aplicados {client ? "(do cliente)" : "(padrão)"}
                  </span>
                  {!client && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                      onClick={() => persistPrices(DEFAULT_PRICE_TABLE)}>
                      <RotateCcw className="h-3 w-3" /> Restaurar padrão
                    </Button>
                  )}
                </div>
                {imageBudgets.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pb-2 border-b border-border/40">
                    {(["precoM2","precoFitaMetro","precoFuroDobradica"] as const).map(k => (
                      <div key={k}>
                        <Label className="text-[10px] uppercase text-muted-foreground">{priceLabel(k)}</Label>
                        <Input type="number" step="0.01" min={0}
                          value={prices[k] ?? 0}
                          onChange={(e) => updatePrice(k, e.target.value)}
                          disabled={!!client}
                          className="h-7 text-xs" />
                      </div>
                    ))}
                  </div>
                )}
                {(budgets.length > 0 || aspireBudgets.length > 0) && (
                  <div className="grid grid-cols-7 gap-2">
                    {(["corte","cortePeca","fita","fitaManual","furo","fresaMetro","serraMetro"] as const).map(k => (
                      <div key={k}>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {priceLabel(k)}
                        </Label>
                        <Input type="number" step="0.01" min={0}
                          value={prices[k] ?? 0}
                          onChange={(e) => updatePrice(k, e.target.value)}
                          disabled={!!client}
                          className="h-7 text-xs" />
                      </div>
                    ))}
                  </div>
                )}
                {client && (
                  <p className="text-[10px] text-muted-foreground">
                    Para alterar estes valores, edite o cadastro do cliente.
                  </p>
                )}
              </div>

              {/* OS / Recebimento por peça */}
              {pieces.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    OS, Recebimento e Entrega — por peça
                  </div>
                  <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr className="text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-1.5 text-left">Peça</th>
                          <th className="px-2 py-1.5 text-left w-28">OS</th>
                          <th className="px-2 py-1.5 text-left w-32">Data Receb.</th>
                          <th className="px-2 py-1.5 text-center w-16">Receb.</th>
                          <th className="px-2 py-1.5 text-left">Endereço entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pieces.map(p => {
                          const meta = pieceMeta[p.id] ?? {
                            recebido: p.materialRecebido ?? false,
                            os: p.os, dataRecebimento: p.dataRecebimento,
                            enderecoEntrega: p.enderecoEntrega,
                          };
                          return (
                            <tr key={p.id} className="border-t border-border">
                              <td className="px-2 py-1 truncate max-w-[200px]">
                                <div className="font-medium">{p.descricao}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {p.largura}×{p.altura}×{p.espessura} · ×{p.quantidade}
                                </div>
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  value={meta.os ?? ""}
                                  onChange={(e) => updatePieceMeta(p.id, { os: e.target.value })}
                                  className="h-7 text-[11px]"
                                  placeholder="OS-001"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  type="date"
                                  value={meta.dataRecebimento?.slice(0, 10) ?? ""}
                                  onChange={(e) => updatePieceMeta(p.id, {
                                    dataRecebimento: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                                  })}
                                  className="h-7 text-[11px]"
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <Checkbox
                                  checked={meta.recebido}
                                  onCheckedChange={(v) => updatePieceMeta(p.id, { recebido: !!v })}
                                />
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  value={meta.enderecoEntrega ?? ""}
                                  onChange={(e) => updatePieceMeta(p.id, { enderecoEntrega: e.target.value })}
                                  className="h-7 text-[11px]"
                                  placeholder={enderecoEntregaPadrao || "Mesmo do padrão"}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumo Imagem (m²/fita/dobradiças) */}
              {imageBudgets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Peças por Imagem — Área · Fita · Dobradiças
                  </div>
                  <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr className="text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-2 text-left">Peça</th>
                          <th className="px-2 py-2 text-center w-12">Qt</th>
                          <th className="px-2 py-2 text-right w-20">Área/un</th>
                          <th className="px-2 py-2 text-center w-24" title="Fita dupla = externa + interna (provençal)">Fita dupla</th>
                          <th className="px-2 py-2 text-right w-20">Fita m/un</th>
                          <th className="px-2 py-2 text-center w-16">Dobr.</th>
                          <th className="px-2 py-2 text-right w-20">Unitário</th>
                          <th className="px-2 py-2 text-right w-20">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imageBudgets.map(b => {
                          const p = pieces.find(pp => pp.id === b.pieceId)!;
                          return (
                            <tr key={b.pieceId} className="border-t border-border">
                              <td className="px-2 py-1.5">
                                <div className="font-medium truncate max-w-[260px]">{b.descricao}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{b.largura}×{b.altura}×{b.espessura} mm</div>
                              </td>
                              <td className="px-1 py-1.5 text-center">{b.quantidade}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{b.areaM2Unit.toFixed(3)}</td>
                              <td className="px-1 py-1.5 text-center">
                                <Checkbox
                                  checked={b.dupla}
                                  onCheckedChange={(v) => onUpdatePiece?.(b.pieceId, { bordaDuplaProvencal: !!v })}
                                />
                              </td>
                              <td className="px-1 py-1.5 text-right">
                                <Input
                                  type="number" step="0.01" min={0}
                                  value={b.fitaMUnit.toFixed(2)}
                                  onChange={(e) => onUpdatePiece?.(b.pieceId, { fitaMetrosOverride: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-[11px] text-right font-mono"
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <Input
                                  type="number" min={0}
                                  value={p.furosDobradica ?? 0}
                                  onChange={(e) => onUpdatePiece?.(b.pieceId, { furosDobradica: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-[11px] text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">R$ {b.totalUnit.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right font-semibold">R$ {b.totalAll.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-muted/50 border-t-2 border-border font-semibold">
                          <td className="px-2 py-1.5 text-right">TOTAIS</td>
                          <td className="px-2 py-1.5 text-center">{imageTotals.qtd}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{imageTotals.area.toFixed(3)} m²</td>
                          <td></td>
                          <td className="px-2 py-1.5 text-right font-mono">{imageTotals.fita.toFixed(2)} m</td>
                          <td className="px-2 py-1.5 text-center">{imageTotals.furos}</td>
                          <td></td>
                          <td className="px-2 py-1.5 text-right text-primary">R$ {imageTotals.total.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

              {/* Resumo Aspire (peças usinadas — sem furos) */}
              {aspireBudgets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Peças Usinadas (Router)
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
                          <th className="px-2 py-2 text-center">Cortes/un.</th>
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
                                    <div className="font-mono space-y-0.5">
                                      {b.isNicho ? (
                                        <>
                                          <div>
                                            <b className="text-foreground">{b.frisoCount}</b> {b.frisoCount === 1 ? "nicho" : "nichos"}
                                            {" "}de <b className="text-foreground">{b.vaoLargura?.toFixed(0)}×{b.vaoAltura?.toFixed(0)} mm</b>
                                          </div>
                                          <div className="text-muted-foreground/80">
                                            Perímetro de cada vão: <b className="text-foreground">{b.frisoLengthMm?.toFixed(0)} mm</b>
                                            {" · "}total usinado: <b className="text-foreground">{((b.frisoLengthMm ?? 0) * (b.frisoCount ?? 0) / 1000).toFixed(2)} m</b>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          {piece?.aspireFrisoCount} frisos de {(piece?.aspireFrisoBilledLengthMm ?? piece?.aspireFrisoLengthMm ?? 0).toFixed(1)}mm cada
                                          {piece?.aspireFrisoLarguraMm && piece?.aspireFrisoAlturaMm && (
                                            <span className="text-muted-foreground/70"> · vão {piece.aspireFrisoLarguraMm.toFixed(0)}×{piece.aspireFrisoAlturaMm.toFixed(0)}mm</span>
                                          )}
                                        </>
                                      )}
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
                                        {s.bandedManual && <span className="text-[9px] px-1 rounded bg-amber-500/30 text-amber-200">fita manual</span>}
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
                              <td className="px-2 py-1.5 text-right">
                                {(b.fitaMetrosUnit + b.fitaManualMetrosUnit) > 0
                                  ? <>
                                      {b.fitaMetrosUnit > 0 && <div>{b.fitaMetrosUnit.toFixed(2)}m</div>}
                                      {b.fitaManualMetrosUnit > 0 && <div className="text-amber-500">{b.fitaManualMetrosUnit.toFixed(2)}m m.</div>}
                                    </>
                                  : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold">R$ {b.valorTotalAll.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <Label className="text-[10px] uppercase">Observações (saem no PDF)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="text-xs min-h-[60px]"
                  placeholder="Ex: Prazo de entrega 5 dias úteis."
                />
              </div>

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
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {!isEmpty && (
            <>
              <Button variant="secondary" onClick={handleSaveQuote}>
                <Save className="h-4 w-4 mr-1" /> {editingQuoteId ? "Atualizar orçamento" : "Salvar orçamento"}
              </Button>
              <Button onClick={handlePrintWithCheck}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function priceLabel(k: keyof ClientPriceTable): string {
  switch (k) {
    case "corte": return "R$ corte (chapa)";
    case "cortePeca": return "R$ corte (peça)";
    case "fita": return "R$/m fita";
    case "fitaManual": return "R$/m fita manual";
    case "furo": return "R$ por furo";
    case "fresaMetro": return "R$/m fresa";
    case "serraMetro": return "R$/m serra";
    case "chapaM2": return "R$/m² chapa";
    case "precoM2": return "R$/m² peça";
    case "precoFitaMetro": return "R$/m fita borda";
    case "precoFuroDobradica": return "R$ furo dobradiça";
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
