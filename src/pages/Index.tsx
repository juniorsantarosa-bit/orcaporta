import { useState } from "react";
import { TabBar } from "@/components/cnc/TabBar";
import { Toolbar } from "@/components/cnc/Toolbar";
import { PartsTable } from "@/components/cnc/PartsTable";
import { NestingPreview } from "@/components/cnc/NestingPreview";
import { mockPieces, mockSheetLayouts } from "@/data/mockPieces";
import { CuttingConfig } from "@/types/cutting";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function Index() {
  const [activeTab, setActiveTab] = useState("otimizacao");
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(1);
  const [config, setConfig] = useState<CuttingConfig>({
    serraSerpentina: 4,
    margemChapa: 0,
    espacamentoEntreCortes: 4,
    permitirRotacao: true,
    usarDisponiveis: false,
    cadastrarNovas: true,
    removerUsadas: false,
  });

  const handleConfigChange = (key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleOptimize = () => {
    console.log("Otimizando...", config);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <Toolbar
        config={config}
        onConfigChange={handleConfigChange}
        onOptimize={handleOptimize}
      />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={25}>
            <PartsTable
              pieces={mockPieces}
              selectedId={selectedPieceId}
              onSelect={setSelectedPieceId}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={40}>
            <NestingPreview
              layouts={mockSheetLayouts}
              selectedPieceId={selectedPieceId}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
