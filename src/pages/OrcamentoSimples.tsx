import { useState, useCallback, useMemo, useEffect } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { SimpleToolbar } from "@/components/cnc/SimpleToolbar";
import { SimpleSheetView } from "@/components/cnc/SimpleSheetView";
import { SimplePartsTable } from "@/components/cnc/SimplePartsTable";
import { ImportarImagemIADialog } from "@/components/cnc/dialogs/ImportarImagemIADialog";
import { OrcamentoSimplesDialog } from "@/components/cnc/dialogs/OrcamentoSimplesDialog";
import { ClientesDialog } from "@/components/cnc/dialogs/ClientesDialog";
import { OrcamentosListDialog } from "@/components/cnc/dialogs/OrcamentosListDialog";
import { RelatoriosDialog } from "@/components/cnc/dialogs/RelatoriosDialog";
import { EmpresaConfigDialog } from "@/components/cnc/dialogs/EmpresaConfigDialog";
import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";
import { Client, SavedQuote } from "@/types/commercial";
import { getClient } from "@/lib/commercialStore";
import { optimizeSerra } from "@/lib/serraOptimizer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const SELECTED_CLIENT_KEY = "maxcut.orcamento.selectedClientId";

/**
 * Versão simplificada — apenas para geração de orçamentos.
 * Modo serra fixo. Layout split: lista de peças à esquerda, plano de corte 2D à direita.
 */
export default function OrcamentoSimples() {
  const [pieces, setPieces] = useState<CuttingPiece[]>([]);
  const [layouts, setLayouts] = useState<NestingSheet[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [selectedSideIndex, setSelectedSideIndex] = useState<number | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOrcamento, setShowOrcamento] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [showOrcamentosSalvos, setShowOrcamentosSalvos] = useState(false);
  const [showRelatorios, setShowRelatorios] = useState(false);
  const [showEmpresa, setShowEmpresa] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  /** Quando carregamos um orçamento salvo, mantemos o id para "Atualizar" em vez de criar novo */
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Restaura cliente selecionado entre sessões
  useEffect(() => {
    const id = localStorage.getItem(SELECTED_CLIENT_KEY);
    if (id) {
      const c = getClient(id);
      if (c) setSelectedClient(c);
    }
  }, []);

  /** Build one full 1840×2750 sheet per Aspire piece unit. (mesma lógica) */
  const buildAspireSheets = useCallback((aspirePieces: CuttingPiece[], startId = 1, startLabel = 1): NestingSheet[] => {
    const out: NestingSheet[] = [];
    const SHEET_W = 1840;
    const SHEET_H = 2750;
    const REFILO = 8;
    let id = startId, label = startLabel;
    for (const p of aspirePieces) {
      const qty = Math.max(1, Math.round(p.quantidade || 1));
      let placedX = REFILO;
      let placedY = REFILO;
      const o = p.aspireOrigin;
      if (o) {
        if (o.maxX <= 0) placedX = SHEET_W - Math.abs(o.maxX) - p.largura;
        else if (o.minX >= 0) placedX = o.minX;
        else placedX = -o.minX;
        if (o.maxY <= 0) placedY = SHEET_H - Math.abs(o.maxY) - p.altura;
        else if (o.minY >= 0) placedY = o.minY;
        else placedY = -o.minY;
        placedX = Math.max(REFILO, Math.min(placedX, SHEET_W - p.largura - REFILO));
        placedY = Math.max(REFILO, Math.min(placedY, SHEET_H - p.altura - REFILO));
      }

      for (let q = 0; q < qty; q++) {
        out.push({
          id: id++,
          codCorte: 8000 + id,
          sheetWidth: SHEET_W,
          sheetHeight: SHEET_H,
          espessura: p.espessura,
          material: p.material,
          efficiency: ((p.largura * p.altura) / (SHEET_W * SHEET_H)) * 100,
          pieces: [{
            pieceId: p.id,
            x: placedX, y: placedY,
            width: p.largura, height: p.altura,
            rotated: false,
            label: String(label++),
            descricao: p.descricao,
            furos: p.furos || [],
            usinagens: p.usinagens || [],
            bordaSup: p.bordaSup, bordaInf: p.bordaInf,
            bordaEsq: p.bordaEsq, bordaDir: p.bordaDir,
            cliente: p.cliente,
            ambiente: p.observacao || "",
            moduloDesc: p.projeto,
            espessura: p.espessura,
            noContour: p.noContour,
            isAspire: true,
            aspireContour: p.aspireContour,
          }],
        });
      }
    }
    return out;
  }, []);


  const handleImport = useCallback((newPieces: CuttingPiece[]) => {
    setPieces(prev => {
      const merged = [...prev, ...newPieces];
      setSelectedPieceId(prev.length === 0 && newPieces.length > 0 ? newPieces[0].id : selectedPieceId);
      return merged;
    });
    const aspireOnly = newPieces.filter(p => p.source === "aspire");
    if (aspireOnly.length > 0) {
      setLayouts(prev => {
        const sawLayouts = prev.filter(s => !s.pieces.some(pp => (pp as any).isAspire));
        const startId = (sawLayouts[sawLayouts.length - 1]?.id ?? 0) + 1;
        return [...sawLayouts, ...buildAspireSheets(aspireOnly, startId, 1)];
      });
    } else {
      setLayouts([]);
    }
  }, [selectedPieceId, buildAspireSheets]);

  const handleUpdatePiece = useCallback((id: number, patch: Partial<CuttingPiece>) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const handleDeletePiece = useCallback((id: number) => {
    setPieces(prev => prev.filter(p => p.id !== id));
    setLayouts(prev => prev
      .map(s => ({ ...s, pieces: s.pieces.filter(pp => pp.pieceId !== id) }))
      .filter(s => s.pieces.length > 0)
    );
    setSelectedPieceId(prev => prev === id ? null : prev);
    toast.info("Peça removida.");
  }, []);

  const handleNew = useCallback(() => {
    if (pieces.length === 0 && layouts.length === 0 && !editingQuoteId) return;
    if (!confirm("Iniciar um novo projeto? As peças e o plano atual serão descartados.")) return;
    setPieces([]);
    setLayouts([]);
    setSelectedPieceId(null);
    setEditingQuoteId(null);
    toast.info("Novo projeto iniciado.");
  }, [pieces.length, layouts.length, editingQuoteId]);

  const handleOptimize = useCallback(() => {
    if (pieces.length === 0) {
      toast.error("Importe peças antes de otimizar.");
      return;
    }
    const sawPieces = pieces.filter(p => p.source !== "aspire");
    const aspirePieces = pieces.filter(p => p.source === "aspire");

    setIsOptimizing(true);
    toast.loading("Otimizando (modo Serra)...", { id: "opt" });

    setTimeout(() => {
      const sawSheets = sawPieces.length > 0
        ? optimizeSerra(sawPieces, {
            sheetWidth: 1840, sheetHeight: 2750,
            espessura: sawPieces[0]?.espessura ?? 15,
            material: sawPieces[0]?.material ?? "MDF",
            gap: 4, refiloX: 8, refiloY: 8, allowRotation: true,
          })
        : [];

      const aspireStartId = (sawSheets[sawSheets.length - 1]?.id ?? 0) + 1;
      const aspireStartLabel = sawSheets.reduce((m, s) => m + s.pieces.length, 0) + 1;
      const aspireSheets = buildAspireSheets(aspirePieces, aspireStartId, aspireStartLabel);

      const sheets = [...sawSheets, ...aspireSheets];
      setLayouts(sheets);
      setIsOptimizing(false);
      const avgEff = sawSheets.length > 0
        ? sawSheets.reduce((a, s) => a + s.efficiency, 0) / sawSheets.length
        : 0;
      toast.success(
        `Otimizado! ${sawSheets.length} chapa(s) serra · ${avgEff.toFixed(1)}% aprov.${aspirePieces.length ? ` · ${aspireSheets.length} peça(s) usinadas` : ""}`,
        { id: "opt" }
      );
    }, 100);
  }, [pieces, buildAspireSheets]);

  const handleSelectClient = (c: Client | null) => {
    setSelectedClient(c);
    if (c) {
      localStorage.setItem(SELECTED_CLIENT_KEY, c.id);
    } else {
      localStorage.removeItem(SELECTED_CLIENT_KEY);
    }
  };

  const handleLoadQuote = (q: SavedQuote) => {
    setPieces(q.pieces);
    setLayouts(q.layouts);
    setEditingQuoteId(q.id);
    if (q.clientId) {
      const c = getClient(q.clientId);
      if (c) handleSelectClient(c);
    }
    toast.success(`Orçamento #${q.numero} carregado`);
  };

  const bandedSideIndexes = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const p of pieces) {
      if (p.source !== "aspire" || !p.aspireSides) continue;
      const set = new Set<number>();
      for (const s of p.aspireSides) if (s.banded) set.add(s.index);
      if (set.size > 0) map.set(p.id, set);
    }
    return map;
  }, [pieces]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Brand bar */}
      <div className="flex items-center bg-card border-b border-border h-10 px-4">
        <Zap className="h-4 w-4 text-primary mr-2" />
        <span className="text-sm font-extrabold tracking-tight">
          MAX<span className="text-primary">CUT</span>
          <span className="ml-2 text-[10px] font-medium text-muted-foreground uppercase">
            Orçamento Express
          </span>
        </span>
        <div className="flex-1" />
        {editingQuoteId && (
          <span className="text-[10px] text-amber-500 font-medium mr-3">
            ✎ Editando orçamento salvo
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {pieces.length} peças · {layouts.length} chapas
        </span>
      </div>

      <SimpleToolbar
        onNew={handleNew}
        onImport={() => setShowImport(true)}
        onOptimize={handleOptimize}
        onOrcamento={() => setShowOrcamento(true)}
        onClientes={() => setShowClientes(true)}
        onOrcamentosSalvos={() => setShowOrcamentosSalvos(true)}
        onRelatorios={() => setShowRelatorios(true)}
        onEmpresa={() => setShowEmpresa(true)}
        isOptimizing={isOptimizing}
        hasPieces={pieces.length > 0}
        hasLayouts={layouts.length > 0 || pieces.some(p => p.source === "aspire")}
        selectedClientName={selectedClient?.nome ?? null}
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={36} minSize={25}>
            <SimplePartsTable
              pieces={pieces}
              selectedId={selectedPieceId}
              onSelect={setSelectedPieceId}
              onUpdate={handleUpdatePiece}
              onDelete={handleDeletePiece}
              layouts={layouts}
              selectedSideIndex={selectedSideIndex}
              onSelectSide={(pid, sideIdx) => {
                setSelectedPieceId(pid);
                setSelectedSideIndex(sideIdx);
              }}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={64} minSize={40}>
            <SimpleSheetView
              layouts={layouts}
              selectedPieceId={selectedPieceId}
              onSelectPiece={(id) => {
                setSelectedPieceId(id);
                setSelectedSideIndex(null);
              }}
              selectedSideIndex={selectedSideIndex}
              bandedSideIndexes={bandedSideIndexes}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ImportarImagemIADialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />

      <OrcamentoSimplesDialog
        open={showOrcamento}
        onOpenChange={setShowOrcamento}
        layouts={layouts}
        pieces={pieces}
        client={selectedClient}
        editingQuoteId={editingQuoteId}
        onSavedQuote={(id) => setEditingQuoteId(id)}
        onUpdatePiece={handleUpdatePiece}
      />

      <ClientesDialog
        open={showClientes}
        onOpenChange={setShowClientes}
        selectedClientId={selectedClient?.id ?? null}
        onSelect={handleSelectClient}
      />

      <OrcamentosListDialog
        open={showOrcamentosSalvos}
        onOpenChange={setShowOrcamentosSalvos}
        onLoad={handleLoadQuote}
      />

      <RelatoriosDialog
        open={showRelatorios}
        onOpenChange={setShowRelatorios}
      />

      <EmpresaConfigDialog
        open={showEmpresa}
        onOpenChange={setShowEmpresa}
      />
    </div>
  );
}
