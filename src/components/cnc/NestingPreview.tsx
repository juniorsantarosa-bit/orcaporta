import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
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
  onSelectPiece?: (id: number) => void;
  onLayoutUpdate?: (sheetIdx: number, pieces: PlacedNestingPiece[]) => void;
  onReoptimize?: () => void;
  companyLogo?: string;
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

export function NestingPreview({ layouts, selectedPieceId, onSelectPiece, onLayoutUpdate, onReoptimize, companyLogo }: NestingPreviewProps) {
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

  const printContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const currentLayout = layouts[selectedSheetIdx];
    
    if (viewMode === "labels") {
      const zpl = generateAllLabelsZPL(currentLayout.pieces, currentLayout.id, currentLayout.material);
      printZPL(zpl);
      toast.success(currentLayout.pieces.length + " etiquetas ZPL geradas para Zebra GT800");
    } else {
      const printWindow = window.open("", "_blank", "width=800,height=1100");
      if (!printWindow) {
        toast.error("Popup bloqueado. Permita popups para imprimir.");
        return;
      }

      const COLORS = ["#A8DADC","#F4A261","#C9B1FF","#8FBC8F","#F28B82","#FFD166","#7EC8E3","#B5D99C","#E0A8D0","#FFB385","#80CBC4","#B0A0E8"];
      const doc = printWindow.document;

      const today = new Date().toLocaleDateString("pt-BR");
      const clientes = [...new Set(currentLayout.pieces.map(p => p.cliente).filter(Boolean))].join(", ") || "—";
      const ambientes = [...new Set(currentLayout.pieces.map(p => p.ambiente).filter(Boolean))].join(", ") || "—";

      const css = [
        "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800&display=swap');",
        "* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }",
        "body { font-family:'Inter',sans-serif; background:#fff; color:#000; }",
        "@page { margin:5mm; size:A4 portrait; }",
        ".page { width:100%; height:100vh; display:flex; flex-direction:column; page-break-after:always; padding:8px; }",
        ".header { height:10%; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #ddd; padding:4px 8px; }",
        ".logo { display:flex; align-items:center; gap:8px; }",
        ".logo img { max-height:36px; max-width:120px; object-fit:contain; }",
        ".logo-text { font-size:14px; font-weight:800; }",
        ".green { color:#059669; }",
        ".meta { display:flex; flex-wrap:wrap; gap:12px; font-size:9px; color:#444; }",
        ".meta-item { display:flex; gap:3px; }",
        ".lbl { color:#888; }",
        ".bld { font-weight:600; }",
        ".diagram { flex:1; display:flex; align-items:center; justify-content:center; padding:4px; min-height:0; }",
        ".diagram svg { width:100%; height:100%; }",
        ".ptable { height:20%; border-top:1px solid #ccc; padding:4px 8px; overflow:hidden; }",
        "table { width:100%; border-collapse:collapse; font-size:9px; }",
        "thead tr { background:#f0f0f0; }",
        "th,td { padding:1px 4px; text-align:left; }",
        "th { font-weight:600; color:#555; font-size:8px; }",
        "td { border-top:1px solid #eee; }",
        ".r { text-align:right; }",
        ".c { text-align:center; }",
        ".m { font-family:'JetBrains Mono',monospace; }",
        ".t { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
        ".ft { display:flex; justify-content:space-between; font-size:8px; color:#888; margin-top:2px; }",
      ].join("\n");

      doc.open();
      doc.write("<!DOCTYPE html><html><head><meta charset='utf-8'><title>Plano de Corte</title><style>" + css + "</style></head><body>");

      const sheet = currentLayout;
      const totalArea = sheet.sheetWidth * sheet.sheetHeight;
      const usedArea = sheet.pieces.reduce((a, p) => a + p.width * p.height, 0);
      const wasteArea = totalArea - usedArea;
      const effColor = sheet.efficiency > 80 ? "#059669" : sheet.efficiency > 60 ? "#D97706" : "#DC2626";

      // Build pieces rows
      let rows = "";
      sheet.pieces.forEach((p, idx) => {
        const fitas = [p.bordaSup && "S", p.bordaInf && "I", p.bordaEsq && "E", p.bordaDir && "D"].filter(Boolean).join("") || "—";
        rows += "<tr>" +
          '<td style="font-weight:700;color:' + COLORS[idx % COLORS.length] + '">' + p.label + "</td>" +
          '<td class="t">' + (p.descricao || "") + "</td>" +
          '<td class="r m">' + p.width + "</td>" +
          '<td class="r m">' + p.height + "</td>" +
          '<td class="c" style="font-size:8px">' + fitas + "</td>" +
          '<td class="c m">' + (p.furos?.length || 0) + "</td>" +
          '<td class="t" style="color:#777">' + (p.cliente || "") + "</td>" +
          "</tr>";
      });

      // Build SVG pieces
      let svgPieces = "";
      sheet.pieces.forEach((piece, idx) => {
        const c = COLORS[idx % COLORS.length];
        svgPieces += '<rect x="' + piece.x + '" y="' + piece.y + '" width="' + piece.width + '" height="' + piece.height + '" fill="' + c + '" stroke="#444" stroke-width="1" rx="1"/>';
        if (piece.bordaSup) svgPieces += '<line x1="' + piece.x + '" y1="' + piece.y + '" x2="' + (piece.x + piece.width) + '" y2="' + piece.y + '" stroke="#D97706" stroke-width="3"/>';
        if (piece.bordaInf) svgPieces += '<line x1="' + piece.x + '" y1="' + (piece.y + piece.height) + '" x2="' + (piece.x + piece.width) + '" y2="' + (piece.y + piece.height) + '" stroke="#D97706" stroke-width="3"/>';
        if (piece.bordaEsq) svgPieces += '<line x1="' + piece.x + '" y1="' + piece.y + '" x2="' + piece.x + '" y2="' + (piece.y + piece.height) + '" stroke="#D97706" stroke-width="3"/>';
        if (piece.bordaDir) svgPieces += '<line x1="' + (piece.x + piece.width) + '" y1="' + piece.y + '" x2="' + (piece.x + piece.width) + '" y2="' + (piece.y + piece.height) + '" stroke="#D97706" stroke-width="3"/>';
        // Render holes/furos
        if (piece.furos && piece.furos.length > 0) {
          piece.furos.forEach((hole: PromobHole) => {
            const cx = piece.x + hole.X;
            const cy = piece.y + hole.Y;
            const r = Math.max(hole.DIAM / 2, 2);
            const holeColor = hole.DIAM >= 15 ? "#D97706" : hole.DIAM >= 5 ? "#3B82F6" : "#EF4444";
            svgPieces += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + holeColor + '" opacity="0.7"/>';
          });
        }
        if (piece.width > 50 && piece.height > 25) {
          const fs = Math.min(piece.width / 5, piece.height / 4, 28);
          const fs2 = Math.min(piece.width / 8, piece.height / 5, 11);
          svgPieces += '<text x="' + (piece.x + piece.width / 2) + '" y="' + (piece.y + piece.height / 2 - 6) + '" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '" font-weight="700" fill="#1a1a1a" font-family="Inter">' + piece.label + "</text>";
          svgPieces += '<text x="' + (piece.x + piece.width / 2) + '" y="' + (piece.y + piece.height / 2 + 10) + '" text-anchor="middle" dominant-baseline="central" font-size="' + fs2 + '" fill="#555" font-family="JetBrains Mono, monospace">' + piece.width + "×" + piece.height + "</text>";
        }
      });

      const vb = "-20 -20 " + (sheet.sheetWidth + 40) + " " + (sheet.sheetHeight + 40);

      const logoHtml = companyLogo
        ? '<div class="logo"><img src="' + companyLogo + '" alt="Logo"/></div>'
        : '<div class="logo"><span class="logo-text">⚡ MAX<span class="green">CUT</span></span></div>';

      doc.write(
        '<div class="page">' +
        '<div class="header">' +
        logoHtml +
        '<div class="meta">' +
        '<div class="meta-item"><span class="lbl">Cliente: </span><span class="bld">' + clientes + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Data: </span><span class="bld">' + today + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Material: </span><span class="bld">' + sheet.material + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Chapa Nº: </span><span class="bld m">' + sheet.id + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Peças: </span><span class="bld m">' + sheet.pieces.length + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Ambiente: </span><span class="bld">' + ambientes + "</span></div>" +
        '<div class="meta-item"><span class="lbl">Aproveit.: </span><span class="bld" style="color:' + effColor + '">' + sheet.efficiency.toFixed(1) + "%</span></div>" +
        "</div></div>" +
        '<div class="diagram">' +
        '<svg viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="w' + sheet.id + '" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0 6L6 0" stroke="#999" stroke-width="0.3" opacity="0.15"/></pattern></defs>' +
        '<rect x="0" y="0" width="' + sheet.sheetWidth + '" height="' + sheet.sheetHeight + '" fill="#f5f5f0" stroke="#333" stroke-width="2" rx="2"/>' +
        '<rect x="0" y="0" width="' + sheet.sheetWidth + '" height="' + sheet.sheetHeight + '" fill="url(#w' + sheet.id + ')" rx="2"/>' +
        svgPieces +
        '<text x="' + (sheet.sheetWidth / 2) + '" y="-8" text-anchor="middle" font-size="11" fill="#555" font-family="JetBrains Mono, monospace">' + sheet.sheetWidth + "</text>" +
        '<text x="-8" y="' + (sheet.sheetHeight / 2) + '" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#555" font-family="JetBrains Mono, monospace" transform="rotate(-90, -8, ' + (sheet.sheetHeight / 2) + ')">' + sheet.sheetHeight + "</text>" +
        "</svg></div>" +
        '<div class="ptable">' +
        "<table><thead><tr><th>#</th><th>Descrição</th><th class='r'>C</th><th class='r'>L</th><th class='c'>Fitas</th><th class='c'>Furos</th><th>Cliente</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table>" +
        '<div class="ft"><span>' + sheet.pieces.length + " peças</span>" +
        "<span>Útil: " + (usedArea / 1e6).toFixed(3) + "m² · Sobra: " + (wasteArea / 1e6).toFixed(3) + "m²</span></div>" +
        "</div></div>"
      );

      doc.write("</body></html>");
      doc.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 400);
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
                  onReoptimize={onReoptimize}
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
