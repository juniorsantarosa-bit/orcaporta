import {
  FileUp, FilePlus, FileCode, Layers, Box, Settings, Scissors,
  BarChart3, Grid3X3, FileDown, FileText, Cog, Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolbarProps {
  config: {
    usarDisponiveis: boolean;
    cadastrarNovas: boolean;
    removerUsadas: boolean;
  };
  onConfigChange: (key: string, value: boolean) => void;
  onOptimize: () => void;
  onAction?: (action: string) => void;
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-2.5 text-foreground/80 hover:text-primary hover:bg-accent rounded-sm"
          onClick={onClick}
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar({ config, onConfigChange, onOptimize, onAction }: ToolbarProps) {
  const act = (action: string) => onAction?.(action);

  return (
    <div className="flex items-end gap-1 px-3 py-2 bg-toolbar border-b border-toolbar-border">
      {/* Editar/Importar */}
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <ToolbarButton icon={FilePlus} label="Editar Peças" onClick={() => act("editarPecas")} />
          <ToolbarButton icon={FileUp} label="Importar Peças" onClick={() => act("importarPecas")} />
          <ToolbarButton icon={FileCode} label="Importar DXF" onClick={() => act("importarDXF")} />
          <ToolbarButton icon={FileCode} label="Importar Chapa" onClick={() => act("importarChapa")} />
          <ToolbarButton icon={Box} label="Materiais" onClick={() => act("materiais")} />
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5">Editar/Importar</span>
      </div>

      <Separator orientation="vertical" className="h-12 mx-1" />

      {/* Otimização */}
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <ToolbarButton icon={Scissors} label="Otimizar" onClick={onOptimize} />
          <ToolbarButton icon={Settings} label="Configurações" onClick={() => act("configuracaoCorte")} />
          <div className="flex flex-col gap-1 px-2 py-1">
            <label className="flex items-center gap-1.5 text-[10px] text-foreground/80 cursor-pointer">
              <Checkbox checked={config.usarDisponiveis} onCheckedChange={(v) => onConfigChange("usarDisponiveis", !!v)} className="h-3 w-3" />
              Usar Disponíveis
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-foreground/80 cursor-pointer">
              <Checkbox checked={config.cadastrarNovas} onCheckedChange={(v) => onConfigChange("cadastrarNovas", !!v)} className="h-3 w-3" />
              Cadastrar Novas
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-foreground/80 cursor-pointer">
              <Checkbox checked={config.removerUsadas} onCheckedChange={(v) => onConfigChange("removerUsadas", !!v)} className="h-3 w-3" />
              Remover Usadas
            </label>
          </div>
          <ToolbarButton icon={Layers} label="Sobras" onClick={() => act("sobras")} />
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5">Otimização</span>
      </div>

      <Separator orientation="vertical" className="h-12 mx-1" />

      {/* Máquinas */}
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <ToolbarButton icon={BarChart3} label="Estratégias" onClick={() => act("estrategias")} />
          <ToolbarButton icon={Grid3X3} label="Layers" onClick={() => act("layers")} />
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5">Máquinas</span>
      </div>

      <Separator orientation="vertical" className="h-12 mx-1" />

      {/* Exportar */}
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <ToolbarButton icon={FileDown} label="Gerar Tudo" onClick={() => act("gerarTudo")} />
          <ToolbarButton icon={FileText} label="Exportar Relatório" onClick={() => act("exportarRelatorio")} />
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5">Exportar</span>
      </div>

      <Separator orientation="vertical" className="h-12 mx-1" />

      {/* Geral */}
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <ToolbarButton icon={Cog} label="Configurações" onClick={() => act("configGerais")} />
          <ToolbarButton icon={Image} label="Config. Bitmap" onClick={() => act("configBitmap")} />
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5">Geral</span>
      </div>
    </div>
  );
}
