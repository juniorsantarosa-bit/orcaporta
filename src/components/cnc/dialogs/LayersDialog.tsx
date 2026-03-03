import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayerInfo } from "@/types/cutting";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mockLayers: LayerInfo[] = [
  { nome: "Contorno_15.00_Shape", tipo: "R" },
  { nome: "Contorno_18.00_Shape", tipo: "R" },
  { nome: "Furação_V15", tipo: "R" },
  { nome: "Furação_V3", tipo: "R" },
  { nome: "Furação_V35", tipo: "R" },
  { nome: "Small_Contorno_15.00_Shape", tipo: "R" },
  { nome: "Small_Contorno_18.00_Shape", tipo: "R" },
  { nome: "Furação_V5", tipo: "" },
  { nome: "Usinagem_Interna_15.4_LIVRE", tipo: "" },
  { nome: "Usinagem_Linha_18_FRESA_45G", tipo: "" },
];

export function LayersDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">Smart CUT</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-foreground/80 mb-3">
          No projeto atual foram encontrados os seguinte layers:
        </p>

        <ul className="space-y-1 mb-4 pl-4">
          {mockLayers.map((layer) => (
            <li key={layer.nome} className="text-xs flex items-center gap-1">
              <span className="text-muted-foreground">•</span>
              {layer.tipo && <span className="text-muted-foreground">({layer.tipo})</span>}
              <span>{layer.nome}</span>
            </li>
          ))}
        </ul>

        <div className="text-[10px] text-muted-foreground space-y-0.5 mb-4">
          <p>(I) = Layer Cadastrado na Lista para Ignorar</p>
          <p>(R) = Layer Cadastrado na Ordem de Usinagem Atual</p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
