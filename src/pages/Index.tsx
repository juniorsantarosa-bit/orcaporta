import { useState } from "react";
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toast } from "sonner";

export default function Index() {
  const [activeTab, setActiveTab] = useState("otimizacao");
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(1);
  const [pieces, setPieces] = useState<CuttingPiece[]>(mockPieces);
  const [layouts, setLayouts] = useState<NestingSheet[]>(mockSheetLayouts);
  const [sobras, setSobras] = useState<SobraMaterial[]>([]);

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
    fresaDiametroMenor: 18, ignorarMateriais: [],
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
  });

  const openDialog = (key: keyof typeof dialogs) => setDialogs((prev) => ({ ...prev, [key]: true }));
  const closeDialog = (key: keyof typeof dialogs) => setDialogs((prev) => ({ ...prev, [key]: false }));

  const handleConfigChange = (key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleOptimize = () => {
    toast.info("Otimizando corte...");
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
    // Generate printable report by switching to report view and triggering print
    toast.success("Preparando relatório para impressão...");
    setTimeout(() => window.print(), 500);
  };

  const handleToolbarAction = (action: string) => {
    switch (action) {
      case "editarPecas": openDialog("editarPecas"); break;
      case "importarPecas": openDialog("importarPecas"); break;
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
      />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={30} minSize={20}>
            <PartsTable pieces={pieces} selectedId={selectedPieceId} onSelect={setSelectedPieceId} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <NestingPreview layouts={layouts} selectedPieceId={selectedPieceId} onLayoutUpdate={handleLayoutUpdate} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <EditarPecasDialog open={dialogs.editarPecas} onOpenChange={(v) => v ? openDialog("editarPecas") : closeDialog("editarPecas")} pieces={pieces} onSave={setPieces} />
      <ConfiguracaoCorteDialog open={dialogs.configuracaoCorte} onOpenChange={(v) => v ? openDialog("configuracaoCorte") : closeDialog("configuracaoCorte")} config={nestingConfig} onSave={setNestingConfig} />
      <ConfiguracoesGeraisDialog open={dialogs.configGerais} onOpenChange={(v) => v ? openDialog("configGerais") : closeDialog("configGerais")} config={generalConfig} onSave={setGeneralConfig} />
      <BibliotecaMateriaisDialog open={dialogs.materiais} onOpenChange={(v) => v ? openDialog("materiais") : closeDialog("materiais")} />
      <ConfigMaquinasDialog open={dialogs.configMaquinas || dialogs.estrategias} onOpenChange={(v) => { closeDialog("configMaquinas"); closeDialog("estrategias"); if (v) openDialog("configMaquinas"); }} config={machineConfig} onSave={setMachineConfig} />
      <ConfigBitmapDialog open={dialogs.configBitmap} onOpenChange={(v) => v ? openDialog("configBitmap") : closeDialog("configBitmap")} config={bitmapConfig} onSave={setBitmapConfig} />
      <LayersDialog open={dialogs.layers} onOpenChange={(v) => v ? openDialog("layers") : closeDialog("layers")} />
      <ImportarPecasDialog open={dialogs.importarPecas} onOpenChange={(v) => v ? openDialog("importarPecas") : closeDialog("importarPecas")} onImport={setPieces} />
      <ImportarDXFDialog open={dialogs.importarDXF || dialogs.importarChapa} onOpenChange={(v) => { closeDialog("importarDXF"); closeDialog("importarChapa"); if (v) openDialog("importarDXF"); }} onImport={() => {}} />
      <SobrasDialog open={dialogs.sobras} onOpenChange={(v) => v ? openDialog("sobras") : closeDialog("sobras")} sobras={sobras} onSave={setSobras} />
    </div>
  );
}
