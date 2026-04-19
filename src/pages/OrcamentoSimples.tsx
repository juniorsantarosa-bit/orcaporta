import { useState, useCallback } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { SimpleToolbar } from "@/components/cnc/SimpleToolbar";
import { SimpleSheetView } from "@/components/cnc/SimpleSheetView";
import { SimplePartsTable } from "@/components/cnc/SimplePartsTable";
import { ImportarPecasDialog } from "@/components/cnc/dialogs/ImportarPecasDialog";
import { OrcamentoSimplesDialog } from "@/components/cnc/dialogs/OrcamentoSimplesDialog";
import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";
import { optimizeSerra } from "@/lib/serraOptimizer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

/**
 * Versão simplificada — apenas para geração de orçamentos.
 * Modo serra fixo. Layout split: lista de peças à esquerda, plano de corte 2D à direita.
 */
export default function OrcamentoSimples() {
  const [pieces, setPieces] = useState<CuttingPiece[]>([]);
  const [layouts, setLayouts] = useState<NestingSheet[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOrcamento, setShowOrcamento] = useState(false);

  const handleImport = useCallback((newPieces: CuttingPiece[]) => {
    // Append imports so we can mix Promob + multiple Aspire files in the same budget.
    setPieces(prev => {
      const merged = [...prev, ...newPieces];
      setSelectedPieceId(prev.length === 0 && newPieces.length > 0 ? newPieces[0].id : selectedPieceId);
      return merged;
    });
    setLayouts([]);
  }, [selectedPieceId]);

  const handleUpdatePiece = useCallback((id: number, patch: Partial<CuttingPiece>) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const handleNew = useCallback(() => {
    if (pieces.length === 0 && layouts.length === 0) return;
    if (!confirm("Iniciar um novo projeto? As peças e o plano atual serão descartados.")) return;
    setPieces([]);
    setLayouts([]);
    setSelectedPieceId(null);
    toast.info("Novo projeto iniciado.");
  }, [pieces.length, layouts.length]);

  const handleOptimize = useCallback(() => {
    if (pieces.length === 0) {
      toast.error("Importe peças antes de otimizar.");
      return;
    }
    // Aspire pieces are NOT nested into a saw sheet — they are billed by the
    // real machined perimeter (each one is its own "panel" on the router).
    const sawPieces = pieces.filter(p => p.source !== "aspire");
    const aspireCount = pieces.length - sawPieces.length;

    setIsOptimizing(true);
    toast.loading("Otimizando (modo Serra)...", { id: "opt" });

    setTimeout(() => {
      const sheets = sawPieces.length > 0
        ? optimizeSerra(sawPieces, {
            sheetWidth: 1840,
            sheetHeight: 2750,
            espessura: sawPieces[0]?.espessura ?? 15,
            material: sawPieces[0]?.material ?? "MDF",
            gap: 4,
            refiloX: 8,
            refiloY: 8,
            allowRotation: true,
          })
        : [];
      setLayouts(sheets);
      setIsOptimizing(false);
      const avgEff = sheets.length > 0
        ? sheets.reduce((a, s) => a + s.efficiency, 0) / sheets.length
        : 0;
      toast.success(
        `Otimizado! ${sheets.length} chapas · ${avgEff.toFixed(1)}% aprov.${aspireCount ? ` · ${aspireCount} peça(s) Aspire` : ""}`,
        { id: "opt" }
      );
    }, 100);
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
        <span className="text-[10px] text-muted-foreground">
          {pieces.length} peças · {layouts.length} chapas
        </span>
      </div>

      <SimpleToolbar
        onNew={handleNew}
        onImport={() => setShowImport(true)}
        onOptimize={handleOptimize}
        onOrcamento={() => setShowOrcamento(true)}
        isOptimizing={isOptimizing}
        hasPieces={pieces.length > 0}
        hasLayouts={layouts.length > 0 || pieces.some(p => p.source === "aspire")}
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={30} minSize={20}>
            <SimplePartsTable
              pieces={pieces}
              selectedId={selectedPieceId}
              onSelect={setSelectedPieceId}
              onUpdate={handleUpdatePiece}
              layouts={layouts}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <SimpleSheetView
              layouts={layouts}
              selectedPieceId={selectedPieceId}
              onSelectPiece={setSelectedPieceId}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ImportarPecasDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />

      <OrcamentoSimplesDialog
        open={showOrcamento}
        onOpenChange={setShowOrcamento}
        layouts={layouts}
        pieces={pieces}
      />
    </div>
  );
}
