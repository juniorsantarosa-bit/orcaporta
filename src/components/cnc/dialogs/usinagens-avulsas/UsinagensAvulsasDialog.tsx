import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Drill, BookOpen, Lightbulb, Wind, ArrowLeft } from "lucide-react";
import { CuttingPiece } from "@/types/cutting";
import { PromobHole, Usinagem } from "@/types/promob";
import {
  UsinagemAvulsaTipo, DobradicaConfig, PrateleiraConfig, CanalLEDConfig, CanalVentilacaoConfig,
  DOBRADICA_DEFAULTS, PRATELEIRA_DEFAULTS, CANAL_LED_DEFAULTS, CANAL_VENTILACAO_DEFAULTS,
  calcularPosicoesDobradicas, calcularFurosPrateleira, calcularPosicoesCanaisVentilacao, calcularComprimentoCanal,
} from "./types";
import { DobradicaForm } from "./DobradicaForm";
import { PrateleiraForm } from "./PrateleiraForm";
import { CanalLEDForm } from "./CanalLEDForm";
import { CanalVentilacaoForm } from "./CanalVentilacaoForm";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddPiece: (piece: CuttingPiece) => void;
  nextPieceId: number;
}

const opcoes: { tipo: UsinagemAvulsaTipo; icon: React.ElementType; label: string; desc: string }[] = [
  { tipo: "dobradica", icon: Drill, label: "Dobradiça", desc: "Furos para dobradiças de portas" },
  { tipo: "prateleira", icon: BookOpen, label: "Prateleira", desc: "4 furos padrão para prateleira" },
  { tipo: "canal_led", icon: Lightbulb, label: "Canal de LED", desc: "Rebaixo para fita LED" },
  { tipo: "canal_ventilacao", icon: Wind, label: "Canal de Ventilação", desc: "Canais de ventilação distribuídos" },
];

export function UsinagensAvulsasDialog({ open, onOpenChange, onAddPiece, nextPieceId }: Props) {
  const [tipo, setTipo] = useState<UsinagemAvulsaTipo | null>(null);
  const [dobradicaCfg, setDobradicaCfg] = useState<DobradicaConfig>({ ...DOBRADICA_DEFAULTS });
  const [prateleiraCfg, setPrateleiraCfg] = useState<PrateleiraConfig>({ ...PRATELEIRA_DEFAULTS });
  const [canalLedCfg, setCanalLedCfg] = useState<CanalLEDConfig>({ ...CANAL_LED_DEFAULTS });
  const [canalVentCfg, setCanalVentCfg] = useState<CanalVentilacaoConfig>({ ...CANAL_VENTILACAO_DEFAULTS });

  const handleClose = (v: boolean) => {
    if (!v) setTipo(null);
    onOpenChange(v);
  };

  const handleConfirm = () => {
    let piece: CuttingPiece;

    if (tipo === "dobradica") {
      const positions = calcularPosicoesDobradicas(dobradicaCfg);
      const raio = dobradicaCfg.diametroFresa / 2;
      const xPos = dobradicaCfg.lado === "esquerda" || dobradicaCfg.lado === "inferior"
        ? dobradicaCfg.distanciaBordaLateral + raio
        : dobradicaCfg.larguraPorta - dobradicaCfg.distanciaBordaLateral - raio;

      const furos: PromobHole[] = positions.map(y => ({
        FACE: "SUP" as const,
        X: xPos,
        Y: y,
        DIAM: dobradicaCfg.diametroFresa,
        Z: dobradicaCfg.profundidade,
      }));

      piece = {
        id: nextPieceId,
        projeto: "Usinagem Avulsa",
        cliente: "Avulso",
        descricao: `Porta c/ ${dobradicaCfg.numDobradicasTotal} dobradiças`,
        largura: dobradicaCfg.larguraPorta,
        altura: dobradicaCfg.alturaPorta,
        espessura: dobradicaCfg.espessura,
        material: `MDF ${dobradicaCfg.espessura}mm`,
        quantidade: 1,
        bordaInf: true, bordaSup: true, bordaEsq: true, bordaDir: true,
        veio: false,
        observacao: `Dobradiça lado ${dobradicaCfg.lado}${!dobradicaCfg.cortarPeca ? " | Apenas usinagem" : ""}`,
        furos,
        usinagens: [],
      };
    } else if (tipo === "prateleira") {
      const holes = calcularFurosPrateleira(prateleiraCfg);
      const furos: PromobHole[] = holes.map(h => ({
        FACE: "SUP" as const,
        X: h.x,
        Y: h.y,
        DIAM: 5,
        Z: 12,
      }));

      piece = {
        id: nextPieceId,
        projeto: "Usinagem Avulsa",
        cliente: "Avulso",
        descricao: "Prateleira c/ furos",
        largura: prateleiraCfg.largura,
        altura: prateleiraCfg.altura,
        espessura: prateleiraCfg.espessura,
        material: `MDF ${prateleiraCfg.espessura}mm`,
        quantidade: 1,
        bordaInf: true, bordaSup: false, bordaEsq: false, bordaDir: false,
        veio: false,
        observacao: `Prateleira padrão${!prateleiraCfg.cortarPeca ? " | Apenas usinagem" : ""}`,
        furos,
        usinagens: [],
      };
    } else if (tipo === "canal_led") {
      const usinagens: Usinagem[] = [{
        tipo: "canal",
        x: canalLedCfg.ladoReferencia === "esquerda" ? canalLedCfg.distanciaBorda
          : canalLedCfg.ladoReferencia === "direita" ? canalLedCfg.largura - canalLedCfg.distanciaBorda - canalLedCfg.espessuraCanal
          : 0,
        y: canalLedCfg.ladoReferencia === "superior" ? canalLedCfg.distanciaBorda
          : canalLedCfg.ladoReferencia === "inferior" ? canalLedCfg.altura - canalLedCfg.distanciaBorda - canalLedCfg.espessuraCanal
          : 0,
        largura: canalLedCfg.espessuraCanal,
        profundidade: canalLedCfg.profundidadeCanal,
        comprimento: (canalLedCfg.ladoReferencia === "superior" || canalLedCfg.ladoReferencia === "inferior")
          ? canalLedCfg.largura : canalLedCfg.altura,
        face: "SUP",
        passante: false,
      }];

      piece = {
        id: nextPieceId,
        projeto: "Usinagem Avulsa",
        cliente: "Avulso",
        descricao: "Peça c/ canal LED",
        largura: canalLedCfg.largura,
        altura: canalLedCfg.altura,
        espessura: canalLedCfg.espessura,
        material: `MDF ${canalLedCfg.espessura}mm`,
        quantidade: 1,
        bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
        veio: false,
        observacao: `Canal LED ${canalLedCfg.ladoReferencia}${!canalLedCfg.cortarPeca ? " | Apenas usinagem" : ""}`,
        furos: [],
        usinagens,
      };
    } else if (tipo === "canal_ventilacao") {
      const positions = calcularPosicoesCanaisVentilacao(canalVentCfg);
      const isHoriz = canalVentCfg.ladoReferencia === "esquerda" || canalVentCfg.ladoReferencia === "direita";
      const comprimentoCanal = calcularComprimentoCanal(canalVentCfg);

      const usinagens: Usinagem[] = positions.map(pos => ({
        tipo: "canal" as const,
        // pos is center of channel; store top-left corner for rendering
        x: isHoriz ? canalVentCfg.distanciaTopos : pos - canalVentCfg.espessuraCanal / 2,
        y: isHoriz ? pos - canalVentCfg.espessuraCanal / 2 : canalVentCfg.distanciaTopos,
        largura: canalVentCfg.espessuraCanal,
        profundidade: canalVentCfg.profundidadeCanal,
        comprimento: comprimentoCanal,
        face: "SUP" as const,
        passante: false,
      }));

      piece = {
        id: nextPieceId,
        projeto: "Usinagem Avulsa",
        cliente: "Avulso",
        descricao: `Peça c/ ${canalVentCfg.numCanais} canais ventilação`,
        largura: canalVentCfg.largura,
        altura: canalVentCfg.altura,
        espessura: canalVentCfg.espessura,
        material: `MDF ${canalVentCfg.espessura}mm`,
        quantidade: 1,
        bordaInf: false, bordaSup: false, bordaEsq: false, bordaDir: false,
        veio: false,
        observacao: `Ventilação${!canalVentCfg.cortarPeca ? " | Apenas usinagem" : ""}`,
        furos: [],
        usinagens,
      };
    } else return;

    onAddPiece(piece);
    toast.success(`Peça "${piece.descricao}" adicionada à lista!`);
    setTipo(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTipo(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {tipo ? opcoes.find(o => o.tipo === tipo)?.label : "Usinagens Avulsas"}
          </DialogTitle>
          <DialogDescription>
            {tipo
              ? "Configure os parâmetros e visualize o preview em tempo real."
              : "Selecione o tipo de usinagem que deseja configurar."
            }
          </DialogDescription>
        </DialogHeader>

        {!tipo ? (
          <div className="grid grid-cols-2 gap-3">
            {opcoes.map(op => (
              <button
                key={op.tipo}
                onClick={() => setTipo(op.tipo)}
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left"
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <op.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{op.label}</p>
                  <p className="text-xs text-muted-foreground">{op.desc}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {tipo === "dobradica" && <DobradicaForm config={dobradicaCfg} onChange={setDobradicaCfg} />}
            {tipo === "prateleira" && <PrateleiraForm config={prateleiraCfg} onChange={setPrateleiraCfg} />}
            {tipo === "canal_led" && <CanalLEDForm config={canalLedCfg} onChange={setCanalLedCfg} />}
            {tipo === "canal_ventilacao" && <CanalVentilacaoForm config={canalVentCfg} onChange={setCanalVentCfg} />}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => { setTipo(null); onOpenChange(false); }}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm}>
                Confirmar e Adicionar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
