import { FileUp, Scissors, Calculator, Loader2, FilePlus, Users, FolderOpen, BarChart3, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SimpleToolbarProps {
  onNew: () => void;
  onImport: () => void;
  onOptimize: () => void;
  onOrcamento: () => void;
  onClientes: () => void;
  onOrcamentosSalvos: () => void;
  onRelatorios: () => void;
  onEmpresa: () => void;
  isOptimizing?: boolean;
  hasPieces: boolean;
  hasLayouts: boolean;
  /** Nome do cliente atualmente selecionado (mostrado no botão) */
  selectedClientName?: string | null;
}

function TBtn({
  icon: Icon, label, onClick, accent, disabled, sublabel,
}: { icon: React.ElementType; label: string; onClick?: () => void; accent?: boolean; disabled?: boolean; sublabel?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={accent ? "default" : "ghost"}
          size="sm"
          disabled={disabled}
          className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3 rounded-md"
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
          <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{label}</span>
          {sublabel && (
            <span className="text-[8px] leading-tight whitespace-nowrap opacity-70 max-w-[120px] truncate">
              {sublabel}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{sublabel ? `${label} — ${sublabel}` : label}</TooltipContent>
    </Tooltip>
  );
}

export function SimpleToolbar({
  onNew, onImport, onOptimize, onOrcamento, onClientes, onOrcamentosSalvos, onRelatorios, onEmpresa,
  isOptimizing, hasPieces, hasLayouts, selectedClientName,
}: SimpleToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
      <TBtn icon={FilePlus} label="Novo" onClick={onNew} />
      <TBtn icon={FileUp} label="Importar Imagem" onClick={onImport} />
      <Separator orientation="vertical" className="h-10 mx-1" />
      <TBtn
        icon={Users}
        label="Cliente"
        sublabel={selectedClientName ?? "nenhum"}
        onClick={onClientes}
        accent={!!selectedClientName}
      />
      <TBtn icon={Building2} label="Empresa" onClick={onEmpresa} />
      <Separator orientation="vertical" className="h-10 mx-1" />
      <TBtn
        icon={isOptimizing ? Loader2 : Scissors}
        label={isOptimizing ? "Otimizando..." : "Otimizar"}
        onClick={onOptimize}
        disabled={!hasPieces || isOptimizing}
      />
      <TBtn icon={Calculator} label="Gerar Orçamento" onClick={onOrcamento} accent disabled={!hasPieces} />
      <Separator orientation="vertical" className="h-10 mx-1" />
      <TBtn icon={FolderOpen} label="Orçamentos" onClick={onOrcamentosSalvos} />
      <TBtn icon={BarChart3} label="Relatórios" onClick={onRelatorios} />

      <div className="flex-1" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">
        Orçamento por Imagem · IA
      </span>
    </div>
  );
}
