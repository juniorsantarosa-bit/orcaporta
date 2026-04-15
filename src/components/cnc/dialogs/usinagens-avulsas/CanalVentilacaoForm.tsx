import { CanalVentilacaoConfig, calcularPosicoesCanaisVentilacao, calcularComprimentoCanal } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  config: CanalVentilacaoConfig;
  onChange: (c: CanalVentilacaoConfig) => void;
}

function PecaPreview({ config }: { config: CanalVentilacaoConfig }) {
  const { largura, altura, espessuraCanal, ladoReferencia, distanciaTopos } = config;
  const positions = calcularPosicoesCanaisVentilacao(config);
  const comprimentoCanal = calcularComprimentoCanal(config);
  const pad = 24;
  const maxW = 220;
  const maxH = 250;
  const scale = Math.min(maxW / largura, maxH / altura);
  const sw = largura * scale;
  const sh = altura * scale;
  const channelW = espessuraCanal * scale;
  const isHorizontal = ladoReferencia === "esquerda" || ladoReferencia === "direita";
  const topoScaled = distanciaTopos * scale;

  return (
    <svg width={sw + pad * 2 + 40} height={sh + pad * 2 + 20} className="border border-border rounded bg-muted/30">
      <g transform={`translate(${pad},${pad})`}>
        <rect x={0} y={0} width={sw} height={sh} fill="hsl(40 30% 88%)" stroke="hsl(var(--border))" strokeWidth={1.5} rx={2} />
        {positions.map((pos, i) => {
          if (isHorizontal) {
            const cy = pos * scale - channelW / 2;
            const cLen = comprimentoCanal * scale;
            return <rect key={i} x={topoScaled} y={cy} width={Math.max(cLen, 1)} height={Math.max(channelW, 1)}
              fill="hsl(200 70% 50% / 0.3)" stroke="hsl(200 70% 45%)" strokeWidth={0.8} />;
          } else {
            const cx = pos * scale - channelW / 2;
            const cLen = comprimentoCanal * scale;
            return <rect key={i} x={cx} y={topoScaled} width={Math.max(channelW, 1)} height={Math.max(cLen, 1)}
              fill="hsl(200 70% 50% / 0.3)" stroke="hsl(200 70% 45%)" strokeWidth={0.8} />;
          }
        })}
        {/* Dimension labels */}
        <text x={sw / 2} y={sh + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono">
          {largura}mm
        </text>
        <text x={-10} y={sh / 2} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono" transform={`rotate(-90, -10, ${sh / 2})`}>
          {altura}mm
        </text>
        {/* Channel length label */}
        <text x={sw + 6} y={sh / 2} fontSize={8} fill="hsl(200 70% 45%)" className="font-mono">
          Canal: {comprimentoCanal.toFixed(0)}mm
        </text>
      </g>
    </svg>
  );
}

export function CanalVentilacaoForm({ config, onChange }: Props) {
  const set = <K extends keyof CanalVentilacaoConfig>(k: K, v: CanalVentilacaoConfig[K]) => onChange({ ...config, [k]: v });
  const comprimentoCanal = calcularComprimentoCanal(config);

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Largura (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.largura} onChange={e => set("largura", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Altura (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.altura} onChange={e => set("altura", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Espessura</Label>
            <Select value={String(config.espessura)} onValueChange={v => set("espessura", Number(v) as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15mm</SelectItem>
                <SelectItem value="18">18mm</SelectItem>
                <SelectItem value="25">25mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lado referência</Label>
            <Select value={config.ladoReferencia} onValueChange={v => set("ladoReferencia", v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="esquerda">Esquerda</SelectItem>
                <SelectItem value="direita">Direita</SelectItem>
                <SelectItem value="superior">Superior</SelectItem>
                <SelectItem value="inferior">Inferior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nº Canais</Label>
            <Input type="number" min={1} max={20} className="h-8 text-xs" value={config.numCanais} onChange={e => set("numCanais", +e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Espessura canal (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.espessuraCanal} onChange={e => set("espessuraCanal", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Profundidade (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.profundidadeCanal} onChange={e => set("profundidadeCanal", +e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Dist. borda superior (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.distanciaBordaSuperior} onChange={e => set("distanciaBordaSuperior", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Dist. borda inferior (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.distanciaBordaInferior} onChange={e => set("distanciaBordaInferior", +e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Dist. topos dos canais (mm)</Label>
          <Input type="number" className="h-8 text-xs" value={config.distanciaTopos} onChange={e => set("distanciaTopos", +e.target.value)} />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Comprimento dos canais: <span className="font-semibold text-foreground">{comprimentoCanal.toFixed(0)}mm</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={config.distribuicaoEquivalente} onCheckedChange={v => set("distribuicaoEquivalente", !!v)} id="equiv" />
            <Label htmlFor="equiv" className="text-xs">Distribuição equivalente</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={config.cortarPeca} onCheckedChange={v => set("cortarPeca", !!v)} id="cortarV" />
            <Label htmlFor="cortarV" className="text-xs">Cortar peça (contorno)</Label>
          </div>
        </div>

        {!config.distribuicaoEquivalente && (
          <div>
            <Label className="text-xs">Espaçamento entre canais (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.espacamentoEntreCanais} onChange={e => set("espacamentoEntreCanais", +e.target.value)} />
          </div>
        )}

        {!config.cortarPeca && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Afastamento X (mm)</Label>
              <Input type="number" className="h-8 text-xs" value={config.afastamentoX} onChange={e => set("afastamentoX", +e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Afastamento Y (mm)</Label>
              <Input type="number" className="h-8 text-xs" value={config.afastamentoY} onChange={e => set("afastamentoY", +e.target.value)} />
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Fresa Ø6mm | Velocidade: 24000 RPM | Avanço: 8000mm/min
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Preview</span>
        <PecaPreview config={config} />
      </div>
    </div>
  );
}
