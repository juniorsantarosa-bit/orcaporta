import { useState, useCallback } from "react";
import { TabBar } from "@/components/cnc/TabBar";
import { Toolbar } from "@/components/cnc/Toolbar";
import { PartsTable } from "@/components/cnc/PartsTable";
import { NestingPreview } from "@/components/cnc/NestingPreview";
import { mockPieces, mockSheetLayouts } from "@/data/mockPieces";
import { CuttingConfig, CuttingPiece, NestingConfig, GeneralConfig, MachineConfig, BitmapConfig, SobraMaterial } from "@/types/cutting";
import { NestingSheet, PlacedNestingPiece } from "@/types/promob";
import { EditarPecasDialog } from "@/components/cnc/dialogs/EditarPecasDialog";
import { ConfiguracaoCorteDialog } from "@/components/cnc/dialogs/ConfiguracaoCorteDialog";
import { ConfiguracoesGeraisDialog } from "@/components/cnc/dialogs/ConfiguracoesGeraisDialog";
import { BibliotecaMateriaisDialog } from "@/components/cnc/dialogs/BibliotecaMateriaisDialog";
import { ConfigMaquinasDialog } from "@/components/cnc/dialogs/ConfigMaquinasDialog";
import { ConfigBitmapDialog } from "@/components/cnc/dialogs/ConfigBitmapDialog";
import { LayersDialog } from "@/components/cnc/dialogs/LayersDialog";
import { ImportarPecasDialog } from "@/components/cnc/dialogs/ImportarPecasDialog";
import { ImportarDXFDialog } from "@/components/cnc/dialogs/ImportarDXFDialog";
import { SobrasDialog } from "@/components/cnc/dialogs/SobrasDialog";
import { OrcamentoDialog } from "@/components/cnc/dialogs/OrcamentoDialog";
import { OptimizationResultDialog } from "@/components/cnc/dialogs/OptimizationResultDialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { optimizeNesting, calculateNestingStats, NestingOptions } from "@/lib/nestingOptimizer";

export default function Index() {
  const [activeTab, setActiveTab] = useState("otimizacao");
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(1);
  const [pieces, setPieces] = useState<CuttingPiece[]>(mockPieces);
  const [layouts, setLayouts] = useState<NestingSheet[]>(mockSheetLayouts);
  const [sobras, setSobras] = useState<SobraMaterial[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [projectName, setProjectName] = useState("Projeto sem título");
  const [pendingAction, setPendingAction] = useState<"import" | "new" | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    sheets: NestingSheet[];
    stats: ReturnType<typeof calculateNestingStats>;
    elapsed: number;
  } | null>(null);

  const [config, setConfig] = useState<CuttingConfig>({
    serraSerpentina: 4, margemChapa: 0, espacamentoEntreCortes: 4,
    permitirRotacao: true, usarDisponiveis: false, cadastrarNovas: true, removerUsadas: false,
  });

  const [nestingConfig, setNestingConfig] = useState<NestingConfig>({
    espessuraCorte: 6, considerarRetangulares: false, pontoInicial: "frente-direita",
    refiloX: 8, refiloY: 8, direcaoNesting: "vertical", otimizacao: 80,
  });

  const [generalConfig, setGeneralConfig] = useState<GeneralConfig>({
    chapaX: 1840, chapaY: 2750, sobraX: 500, sobraY: 500,
    distanciaX: 2000, distanciaY: 3000, usarDisponiveis: false,
    cadastrarNovas: true, removerUsadas: false, exibirDinabox: false,
    exibirSeletorSobras: false, fresaDiametroMaior: 42, fresaAngulo: 45,
    fresaDiametroMenor: 18, ignorarMateriais: [], companyLogo: "",
  });

  const [machineConfig, setMachineConfig] = useState<MachineConfig>({
    nome: "CNC", descricao: "", posProcessador: "Mach_Turbo_ATC16",
    tipoOtimizacao: "Nesting", pastaExportacao: "",
    salvarEtiqueta: true, salvarLista: true, etiquetaModelo: "Modelo 3",
    zSeguro: 50, zRapido: 1, maxZMenos: -1, deslocamentoX: 0, deslocamentoY: 0,
    usarLargura: true, larguraPequena: 150, usarArea: true, areaPequena: 90,
    pontoZeramento: "Frente-Dir", rotacaoPeloMaterial: false,
    offsetChanfros: true, prioridadeFaceSuperior: false,
    ignorarLayers: ["Usinagem_Linha_18.5_VBit90"],
  });

  const [bitmapConfig, setBitmapConfig] = useState<BitmapConfig>({
    prevLargura: 400, prevAltura: 800, materialVeio: false,
    fitaSuperior: false, fitaInferior: false, fitaEsquerda: false, fitaDireita: false,
    largura: 800, altura: 583, margem: 10, espessuraLinha: 4,
    tamanhoTexto: 60, tamanhoLegenda: 50, rotacao: 0,
    exibirFaceAlinhamento: false, exibirLegendaFace: false,
  });

  const [dialogs, setDialogs] = useState({
    editarPecas: false, importarPecas: false, importarDXF: false,
    importarChapa: false, materiais: false, configuracaoCorte: false,
    configGerais: false, layers: false, estrategias: false,
    configMaquinas: false, configBitmap: false, sobras: false,
    optimizationResult: false, orcamento: false,
  });

  const openDialog = (key: keyof typeof dialogs) => setDialogs((prev) => ({ ...prev, [key]: true }));
  const closeDialog = (key: keyof typeof dialogs) => setDialogs((prev) => ({ ...prev, [key]: false }));

  const handleConfigChange = (key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // --- Save / New / Import logic ---
  const saveProject = useCallback(() => {
    const project = {
      name: projectName,
      pieces,
      layouts,
      config,
      nestingConfig,
      generalConfig,
      machineConfig,
      sobras,
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}.corte.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projeto salvo com sucesso!");
  }, [projectName, pieces, layouts, config, nestingConfig, generalConfig, machineConfig, sobras]);

  const resetProject = useCallback(() => {
    setPieces([]);
    setLayouts([]);
    setOptimizationResult(null);
    setSelectedPieceId(null);
    setProjectName("Projeto sem título");
    toast.info("Novo projeto iniciado.");
  }, []);

  const hasPieces = pieces.length > 0;

  const confirmAndProceed = useCallback((action: "import" | "new") => {
    if (hasPieces) {
      setPendingAction(action);
      setShowSavePrompt(true);
    } else {
      if (action === "import") openDialog("importarPecas");
      else resetProject();
    }
  }, [hasPieces, resetProject]);

  const handleSavePromptResponse = useCallback((save: boolean) => {
    setShowSavePrompt(false);
    if (save) saveProject();

    // After save (or skip), proceed with action
    if (pendingAction === "import") {
      setPieces([]);
      setLayouts([]);
      setOptimizationResult(null);
      setSelectedPieceId(null);
      openDialog("importarPecas");
    } else if (pendingAction === "new") {
      resetProject();
    }
    setPendingAction(null);
  }, [pendingAction, saveProject, resetProject]);

  const handleImportPieces = useCallback((newPieces: CuttingPiece[]) => {
    setPieces(newPieces);
    setLayouts([]);
    setOptimizationResult(null);
    setSelectedPieceId(newPieces.length > 0 ? newPieces[0].id : null);
  }, []);

  // --- Optimize ---
  const handleOptimize = () => {
    if (pieces.length === 0) {
      toast.error("Adicione peças antes de otimizar.");
      return;
    }

    setIsOptimizing(true);
    toast.loading("Otimizando nesting...", { id: "optimize" });

    setTimeout(() => {
      const start = performance.now();
      const opts: Partial<NestingOptions> = {
        sheetWidth: generalConfig.chapaY,
        sheetHeight: generalConfig.chapaX,
        gap: nestingConfig.espessuraCorte,
        refiloX: nestingConfig.refiloX,
        refiloY: nestingConfig.refiloY,
        allowRotation: config.permitirRotacao,
        direction: nestingConfig.direcaoNesting,
        optimizationLevel: nestingConfig.otimizacao,
      };

      if (pieces.length > 0) {
        opts.material = pieces[0].material;
        opts.espessura = pieces[0].espessura;
      }

      const sheets = optimizeNesting(pieces, opts);
      const elapsed = performance.now() - start;
      const stats = calculateNestingStats(sheets);

      setLayouts(sheets);
      setIsOptimizing(false);
      setOptimizationResult({ sheets, stats, elapsed });
      openDialog("optimizationResult");

      toast.success(
        `Otimizado! ${stats.totalSheets} chapas, ${stats.avgEfficiency.toFixed(1)}% aproveitamento`,
        { id: "optimize" }
      );
    }, 100);
  };

  const handleLayoutUpdate = (sheetIdx: number, newPieces: PlacedNestingPiece[]) => {
    setLayouts(prev => {
      const updated = [...prev];
      const totalArea = updated[sheetIdx].sheetWidth * updated[sheetIdx].sheetHeight;
      const usedArea = newPieces.reduce((a, p) => a + p.width * p.height, 0);
      updated[sheetIdx] = {
        ...updated[sheetIdx],
        pieces: newPieces,
        efficiency: (usedArea / totalArea) * 100,
      };
      return updated;
    });
    toast.success("Plano de corte atualizado!");
  };

  const handleExportReport = () => {
    toast.success("Preparando relatório para impressão...");
    setTimeout(() => window.print(), 500);
  };

  const handleToolbarAction = (action: string) => {
    switch (action) {
      case "novoProjeto": confirmAndProceed("new"); break;
      case "salvarProjeto": saveProject(); break;
      case "editarPecas": openDialog("editarPecas"); break;
      case "importarPecas": confirmAndProceed("import"); break;
      case "importarDXF": openDialog("importarDXF"); break;
      case "importarChapa": openDialog("importarDXF"); break;
      case "materiais": openDialog("materiais"); break;
      case "configuracaoCorte": openDialog("configuracaoCorte"); break;
      case "configGerais": openDialog("configGerais"); break;
      case "layers": openDialog("layers"); break;
      case "estrategias": openDialog("configMaquinas"); break;
      case "configBitmap": openDialog("configBitmap"); break;
      case "sobras": openDialog("sobras"); break;
      case "gerarTudo": {
        import("@/lib/gcode/index").then(({ generateGCode, generateGCodeFilename }) => {
          const ppType = machineConfig.posProcessador.includes("Aspire") ? "aspire" as const
            : machineConfig.posProcessador.includes("Mach3D") ? "mach_cnc" as const
            : "smartcut" as const;
          layouts.forEach((sheet, idx) => {
            const gcode = generateGCode(sheet, { postProcessor: ppType });
            const filename = generateGCodeFilename(idx, sheet.material, ppType);
            const blob = new Blob([gcode], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
          });
          toast.success(`${layouts.length} arquivos G-code gerados (${ppType})!`);
        });
        break;
      }
      case "exportarRelatorio": handleExportReport(); break;
      case "orcamento": openDialog("orcamento"); break;
      default: break;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <Toolbar
        config={config}
        onConfigChange={handleConfigChange}
        onOptimize={handleOptimize}
        onAction={handleToolbarAction}
        isOptimizing={isOptimizing}
      />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={30} minSize={20}>
            <PartsTable pieces={pieces} selectedId={selectedPieceId} onSelect={setSelectedPieceId} onPiecesChange={setPieces} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <NestingPreview layouts={layouts} selectedPieceId={selectedPieceId} onLayoutUpdate={handleLayoutUpdate} onReoptimize={handleOptimize} companyLogo={generalConfig.companyLogo} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Save prompt before import/new */}
      <AlertDialog open={showSavePrompt} onOpenChange={setShowSavePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar projeto atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem peças no projeto atual. Deseja salvar antes de continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowSavePrompt(false); setPendingAction(null); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction className="bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => handleSavePromptResponse(false)}>
              Não salvar
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleSavePromptResponse(true)}>
              Salvar e continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditarPecasDialog open={dialogs.editarPecas} onOpenChange={(v) => v ? openDialog("editarPecas") : closeDialog("editarPecas")} pieces={pieces} onSave={setPieces} />
      <ConfiguracaoCorteDialog open={dialogs.configuracaoCorte} onOpenChange={(v) => v ? openDialog("configuracaoCorte") : closeDialog("configuracaoCorte")} config={nestingConfig} onSave={setNestingConfig} />
      <ConfiguracoesGeraisDialog open={dialogs.configGerais} onOpenChange={(v) => v ? openDialog("configGerais") : closeDialog("configGerais")} config={generalConfig} onSave={setGeneralConfig} />
      <BibliotecaMateriaisDialog open={dialogs.materiais} onOpenChange={(v) => v ? openDialog("materiais") : closeDialog("materiais")} />
      <ConfigMaquinasDialog open={dialogs.configMaquinas || dialogs.estrategias} onOpenChange={(v) => { closeDialog("configMaquinas"); closeDialog("estrategias"); if (v) openDialog("configMaquinas"); }} config={machineConfig} onSave={setMachineConfig} />
      <ConfigBitmapDialog open={dialogs.configBitmap} onOpenChange={(v) => v ? openDialog("configBitmap") : closeDialog("configBitmap")} config={bitmapConfig} onSave={setBitmapConfig} />
      <LayersDialog open={dialogs.layers} onOpenChange={(v) => v ? openDialog("layers") : closeDialog("layers")} />
      <ImportarPecasDialog open={dialogs.importarPecas} onOpenChange={(v) => v ? openDialog("importarPecas") : closeDialog("importarPecas")} onImport={handleImportPieces} />
      <ImportarDXFDialog open={dialogs.importarDXF || dialogs.importarChapa} onOpenChange={(v) => { closeDialog("importarDXF"); closeDialog("importarChapa"); if (v) openDialog("importarDXF"); }} onImport={() => {}} />
      <SobrasDialog open={dialogs.sobras} onOpenChange={(v) => v ? openDialog("sobras") : closeDialog("sobras")} sobras={sobras} onSave={setSobras} />
      <OrcamentoDialog open={dialogs.orcamento} onOpenChange={(v) => v ? openDialog("orcamento") : closeDialog("orcamento")} layouts={layouts} companyLogo={generalConfig.companyLogo} />
      {optimizationResult && (
        <OptimizationResultDialog
          open={dialogs.optimizationResult}
          onOpenChange={(v) => v ? openDialog("optimizationResult") : closeDialog("optimizationResult")}
          result={optimizationResult}
        />
      )}
    </div>
  );
}
