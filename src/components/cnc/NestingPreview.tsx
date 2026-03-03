import { NestingSheet, PlacedNestingPiece } from "@/types/promob";
import { useState, useRef, useCallback } from "react";
import { Nesting3DView, Nesting3DViewHandle } from "./Nesting3DView";
import {
  RotateCw, Home, Search, ZoomIn, ZoomOut, Move, Maximize,
  Eye, Box, Layers, Printer, Tag, Hand
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LabelPreview } from "./LabelPreview";
import { CuttingPlanReport } from "./CuttingPlanReport";
import { SheetView2D, SheetView2DHandle } from "./SheetView2D";
import { generateAllLabelsZPL, printZPL } from "@/lib/zplGenerator";
import { toast } from "sonner";

interface NestingPreviewProps {
  layouts: NestingSheet[];
  selectedPieceId: number | null;
  onLayoutUpdate?: (sheetIdx: number, pieces: PlacedNestingPiece[]) => void;
}

type ViewMode = "2d" | "3d" | "report" | "labels";

function ViewToolButton({ icon: Icon, label, onClick, active, accent }: { icon: React.ElementType; label: string; onClick?: () => void; active?: boolean; accent?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${
            accent ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : active ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

export function NestingPreview({ layouts, selectedPieceId, onLayoutUpdate }: NestingPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [dragMode, setDragMode] = useState(false);

  const view3DRef = useRef<Nesting3DViewHandle>(null);
  const view2DRef = useRef<SheetView2DHandle>(null);

  const handleZoomIn = useCallback(() => {
    if (viewMode === "3d") view3DRef.current?.zoomIn();
    else if (viewMode === "2d") view2DRef.current?.zoomIn();
  }, [viewMode]);

  const handleZoomOut = useCallback(() => {
    if (viewMode === "3d") view3DRef.current?.zoomOut();
    else if (viewMode === "2d") view2DRef.current?.zoomOut();
  }, [viewMode]);

  const handleZoomFit = useCallback(() => {
    if (viewMode === "3d") view3DRef.current?.zoomFit();
    else if (viewMode === "2d") view2DRef.current?.zoomFit();
  }, [viewMode]);

  const handleReset = useCallback(() => {
    if (viewMode === "3d") view3DRef.current?.resetView();
    else if (viewMode === "2d") view2DRef.current?.zoomFit();
  }, [viewMode]);

  const handleWireframeToggle = useCallback(() => {
    const newVal = !wireframe;
    setWireframe(newVal);
    view3DRef.current?.setWireframe(newVal);
  }, [wireframe]);

  const handleDragToggle = useCallback(() => {
    if (viewMode !== "2d") {
      setViewMode("2d");
    }
    const result = view2DRef.current?.toggleDragMode();
    setDragMode(result ?? !dragMode);
    if (result) {
      toast.info("Modo arrastar ativado — mova as peças e solte para reagrupar");
    } else {
      toast.success("Peças reagrupadas! Aproveitamento recalculado.");
    }
  }, [viewMode, dragMode]);

  const handlePrint = useCallback(() => {
    const currentLayout = layouts[selectedSheetIdx];
    
    if (viewMode === "labels") {
      // Zebra GT800 ZPL printing
      const zpl = generateAllLabelsZPL(currentLayout.pieces, currentLayout.id, currentLayout.material);
      printZPL(zpl);
      toast.success(`${currentLayout.pieces.length} etiquetas ZPL geradas para Zebra GT800`);
    } else {
      // Standard print dialog for cutting plan / other views
      window.print();
    }
  }, [viewMode, layouts, selectedSheetIdx]);

  const handlePiecesReorder = useCallback((pieces: PlacedNestingPiece[]) => {
    onLayoutUpdate?.(selectedSheetIdx, pieces);
  }, [selectedSheetIdx, onLayoutUpdate]);

  const viewButtons: { mode: ViewMode; label: string }[] = [
    { mode: "2d", label: "2D" },
    { mode: "3d", label: "3D" },
    { mode: "report", label: "Plano" },
    { mode: "labels", label: "Etiquetas" },
  ];

  return (
    <div className="flex h-full bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Visualização de Corte</span>
            <div className="flex bg-muted rounded-md p-0.5">
              {viewButtons.map(vb => (
                <button
                  key={vb.mode}
                  onClick={() => { setViewMode(vb.mode); if (vb.mode !== "2d") setDragMode(false); }}
                  className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-all ${
                    viewMode === vb.mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {vb.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{layouts.length} chapas</span>
            <span>
              Eficiência:{" "}
              <span className="font-semibold text-foreground">
                {(layouts.reduce((a, l) => a + l.efficiency, 0) / layouts.length).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>

        {/* Sheet tabs */}
        <div className="flex items-center gap-1 px-4 py-1 border-b border-border bg-card/50">
          {layouts.map((layout, idx) => (
            <button
              key={layout.id}
              onClick={() => setSelectedSheetIdx(idx)}
              className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${
                selectedSheetIdx === idx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Chapa {layout.id} — {layout.efficiency.toFixed(0)}%
            </button>
          ))}
        </div>

        {/* View */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center print:p-0">
          {layouts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Importe peças e clique em Otimizar para gerar o plano de corte.</p>
          ) : layouts[selectedSheetIdx] ? (
            <>
              {viewMode === "2d" && (
                <SheetView2D
                  ref={view2DRef}
                  layout={layouts[selectedSheetIdx]}
                  selectedPieceId={selectedPieceId}
                  dragMode={dragMode}
                  onPiecesReorder={handlePiecesReorder}
                />
              )}
              {viewMode === "3d" && (
                <Nesting3DView ref={view3DRef} layout={layouts[selectedSheetIdx]} selectedPieceId={selectedPieceId} />
              )}
              {viewMode === "report" && (
                <CuttingPlanReport layout={layouts[selectedSheetIdx]} />
              )}
            </>
          ) : null}
          {viewMode === "labels" && (
            <LabelPreview layout={layouts[selectedSheetIdx]} />
          )}
        </div>
      </div>

      {/* Right toolbar */}
      <div className="w-9 border-l border-border bg-card flex flex-col items-center py-2 gap-0.5 print:hidden">
        <ViewToolButton icon={Home} label="Resetar Vista" onClick={handleReset} />
        <ViewToolButton icon={Hand} label="Arrastar peças" onClick={handleDragToggle} active={dragMode} accent={dragMode} />
        <ViewToolButton icon={Move} label="Mover" onClick={() => setViewMode("2d")} active={viewMode === "2d" && !dragMode} />
        <ViewToolButton icon={RotateCw} label="Orbit 3D" onClick={() => setViewMode("3d")} active={viewMode === "3d"} />
        <Separator className="my-1 w-5" />
        <ViewToolButton icon={ZoomIn} label="Zoom +" onClick={handleZoomIn} />
        <ViewToolButton icon={ZoomOut} label="Zoom -" onClick={handleZoomOut} />
        <ViewToolButton icon={Maximize} label="Zoom Fit" onClick={handleZoomFit} />
        <ViewToolButton icon={Search} label="Lupa" onClick={handleZoomFit} />
        <Separator className="my-1 w-5" />
        <ViewToolButton icon={Eye} label="Wireframe" onClick={handleWireframeToggle} active={wireframe && viewMode === "3d"} />
        <ViewToolButton icon={Box} label="Sólido" onClick={() => { setWireframe(false); view3DRef.current?.setWireframe(false); }} active={!wireframe} />
        <ViewToolButton icon={Layers} label="Plano de Corte" onClick={() => setViewMode("report")} active={viewMode === "report"} />
        <Separator className="my-1 w-5" />
        <ViewToolButton
          icon={Printer}
          label={viewMode === "labels" ? "Imprimir Zebra GT800" : "Imprimir Plano"}
          onClick={handlePrint}
        />
        <ViewToolButton icon={Tag} label="Etiquetas" onClick={() => setViewMode("labels")} active={viewMode === "labels"} />
      </div>
    </div>
  );
}
