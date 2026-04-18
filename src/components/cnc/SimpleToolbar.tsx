import { FileUp, Scissors, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SimpleToolbarProps {
  onImport: () => void;
  onOptimize: () => void;
  onOrcamento: () => void;
  isOptimizing?: boolean;
  hasPieces: boolean;
  hasLayouts: boolean;
}

function TBtn({
  icon: Icon, label, onClick, accent, disabled,
}: { icon: React.ElementType; label: string; onClick?: () => void; accent?: boolean; disabled?: boolean }) {
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
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SimpleToolbar({
  onImport, onOptimize, onOrcamento, isOptimizing, hasPieces, hasLayouts,
}: SimpleToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
      <TBtn icon={FileUp} label="Importar Peças" onClick={onImport} />
      <Separator orientation="vertical" className="h-10 mx-1" />
      <TBtn
        icon={isOptimizing ? Loader2 : Scissors}
        label={isOptimizing ? "Otimizando..." : "Otimizar"}
        onClick={onOptimize}
        accent
        disabled={isOptimizing || !hasPieces}
      />
      <Separator orientation="vertical" className="h-10 mx-1" />
      <TBtn icon={Calculator} label="Gerar Orçamento" onClick={onOrcamento} accent disabled={!hasLayouts} />

      <div className="flex-1" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        Modo Serra · Versão Orçamento
      </span>
    </div>
  );
}
