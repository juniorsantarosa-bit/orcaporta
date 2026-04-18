import { useState, useCallback } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { SimpleToolbar } from "@/components/cnc/SimpleToolbar";
import { SimpleSheetView } from "@/components/cnc/SimpleSheetView";
import { ImportarPecasDialog } from "@/components/cnc/dialogs/ImportarPecasDialog";
import { OrcamentoSimplesDialog } from "@/components/cnc/dialogs/OrcamentoSimplesDialog";
import { CuttingPiece } from "@/types/cutting";
import { NestingSheet } from "@/types/promob";
import { optimizeSerra } from "@/lib/serraOptimizer";

/**
 * Versão simplificada — apenas para geração de orçamentos.
 * Modo serra fixo. Sem edição, configurações, sobras, simulador ou gerador.
 * Fluxo: Importar peças → Otimizar → Visualizar 2D → Gerar orçamento.
 */
export default function OrcamentoSimples() {
  const [pieces, setPieces] = useState<CuttingPiece[]>([]);
  const [layouts, setLayouts] = useState<NestingSheet[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOrcamento, setShowOrcamento] = useState(false);

  const handleImport = useCallback((newPieces: CuttingPiece[]) => {
    setPieces(newPieces);
    setLayouts([]);
    toast.success(`${newPieces.length} peças importadas.`);
  }, []);

  const handleOptimize = useCallback(() => {
    if (pieces.length === 0) {
      toast.error("Importe peças antes de otimizar.");
      return;
    }
    setIsOptimizing(true);
    toast.loading("Otimizando (modo Serra)...", { id: "opt" });

    setTimeout(() => {
      const sheets = optimizeSerra(pieces, {
        sheetWidth: 1840,
        sheetHeight: 2750,
        gap: 4,
        refiloX: 8,
        refiloY: 8,
        allowRotation: true,
      });
      setLayouts(sheets);
      setIsOptimizing(false);
      const avgEff = sheets.length > 0
        ? sheets.reduce((a, s) => a + s.efficiency, 0) / sheets.length
        : 0;
      toast.success(
        `Otimizado! ${sheets.length} chapas · ${avgEff.toFixed(1)}% aproveitamento`,
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
        onImport={() => setShowImport(true)}
        onOptimize={handleOptimize}
        onOrcamento={() => setShowOrcamento(true)}
        isOptimizing={isOptimizing}
        hasPieces={pieces.length > 0}
        hasLayouts={layouts.length > 0}
      />

      <SimpleSheetView layouts={layouts} />

      <ImportarPecasDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />

      <OrcamentoSimplesDialog
        open={showOrcamento}
        onOpenChange={setShowOrcamento}
        layouts={layouts}
      />
    </div>
  );
}
