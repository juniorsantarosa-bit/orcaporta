import {
  FileUp, FilePlus, FileCode, Layers, Box, Settings, Scissors,
  BarChart3, Grid3X3, FileDown, FileText, Cog, Image, ChevronDown,
  Loader2, Save, FolderPlus, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
  config: {
    usarDisponiveis: boolean;
    cadastrarNovas: boolean;
    removerUsadas: boolean;
  };
  onConfigChange: (key: string, value: boolean) => void;
  onOptimize: () => void;
  onAction?: (action: string) => void;
  isOptimizing?: boolean;
}

function ToolbarButton({ icon: Icon, label, onClick, accent, disabled }: { icon: React.ElementType; label: string; onClick?: () => void; accent?: boolean; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`flex flex-col items-center gap-0.5 h-auto py-1 px-2 rounded-md transition-all ${
            accent 
              ? "text-primary hover:bg-primary/10" 
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
          <span className="text-[9px] font-medium leading-tight whitespace-nowrap">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-end gap-0.5">{children}</div>
      <span className="text-[8px] font-medium text-muted-foreground/60 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function Toolbar({ config, onConfigChange, onOptimize, onAction, isOptimizing }: ToolbarProps) {
  const act = (action: string) => onAction?.(action);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card border-b border-border print:hidden">
      <ToolbarGroup label="Projeto">
        <ToolbarButton icon={FolderPlus} label="Novo" onClick={() => act("novoProjeto")} />
        <ToolbarButton icon={Save} label="Salvar" onClick={() => act("salvarProjeto")} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-10 mx-0.5" />

      <ToolbarGroup label="Editar">
        <ToolbarButton icon={FilePlus} label="Peças" onClick={() => act("editarPecas")} />
        <ToolbarButton icon={FileUp} label="Importar" onClick={() => act("importarPecas")} />
        <ToolbarButton icon={FileCode} label="DXF" onClick={() => act("importarDXF")} />
        <ToolbarButton icon={Box} label="Materiais" onClick={() => act("materiais")} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-10 mx-0.5" />

      <ToolbarGroup label="Otimização">
        <ToolbarButton
          icon={isOptimizing ? Loader2 : Scissors}
          label={isOptimizing ? "Calculando..." : "Otimizar"}
          onClick={onOptimize}
          accent
          disabled={isOptimizing}
        />
        <ToolbarButton icon={Settings} label="Config." onClick={() => act("configuracaoCorte")} />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[9px] gap-1 text-muted-foreground">
              Opções <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuCheckboxItem
              checked={config.usarDisponiveis}
              onCheckedChange={(v) => onConfigChange("usarDisponiveis", !!v)}
              className="text-xs"
            >
              Usar Disponíveis
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={config.cadastrarNovas}
              onCheckedChange={(v) => onConfigChange("cadastrarNovas", !!v)}
              className="text-xs"
            >
              Cadastrar Novas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={config.removerUsadas}
              onCheckedChange={(v) => onConfigChange("removerUsadas", !!v)}
              className="text-xs"
            >
              Remover Usadas
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarButton icon={Layers} label="Sobras" onClick={() => act("sobras")} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-10 mx-0.5" />

      <ToolbarGroup label="Máquinas">
        <ToolbarButton icon={BarChart3} label="Estratégias" onClick={() => act("estrategias")} />
        <ToolbarButton icon={Grid3X3} label="Layers" onClick={() => act("layers")} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-10 mx-0.5" />

      <ToolbarGroup label="Exportar">
        <ToolbarButton icon={FileDown} label="Gerar" onClick={() => act("gerarTudo")} />
        <ToolbarButton icon={FileText} label="Relatório" onClick={() => act("exportarRelatorio")} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-10 mx-0.5" />

      <ToolbarGroup label="Geral">
        <ToolbarButton icon={Cog} label="Config." onClick={() => act("configGerais")} />
        <ToolbarButton icon={Image} label="Bitmap" onClick={() => act("configBitmap")} />
      </ToolbarGroup>
    </div>
  );
}
