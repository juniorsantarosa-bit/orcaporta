import { CanalLEDConfig } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  config: CanalLEDConfig;
  onChange: (c: CanalLEDConfig) => void;
}

function PecaPreview({ config }: { config: CanalLEDConfig }) {
  const { largura, altura, distanciaBorda, espessuraCanal, ladoReferencia, rompeLateral, bordaInicio, bordaFim } = config;
  const pad = 20;
  const maxW = 220;
  const maxH = 200;
  const scale = Math.min(maxW / largura, maxH / altura);
  const sw = largura * scale;
  const sh = altura * scale;

  // Channel position based on reference side
  let cx: number, cy: number, cw: number, ch: number;
  const channelW = espessuraCanal * scale;
  const dist = distanciaBorda * scale;

  if (ladoReferencia === "superior") {
    cx = rompeLateral ? (bordaInicio ? 6 * scale : -6 * scale) : 10 * scale;
    cy = dist;
    cw = rompeLateral
      ? sw - (bordaInicio ? 6 * scale : -6 * scale) - (bordaFim ? 6 * scale : -6 * scale)
      : sw - 20 * scale;
    ch = channelW;
  } else if (ladoReferencia === "inferior") {
    cx = rompeLateral ? (bordaInicio ? 6 * scale : -6 * scale) : 10 * scale;
    cy = sh - dist - channelW;
    cw = rompeLateral
      ? sw - (bordaInicio ? 6 * scale : -6 * scale) - (bordaFim ? 6 * scale : -6 * scale)
      : sw - 20 * scale;
    ch = channelW;
  } else if (ladoReferencia === "esquerda") {
    cx = dist;
    cy = rompeLateral ? (bordaInicio ? 6 * scale : -6 * scale) : 10 * scale;
    cw = channelW;
    ch = rompeLateral
      ? sh - (bordaInicio ? 6 * scale : -6 * scale) - (bordaFim ? 6 * scale : -6 * scale)
      : sh - 20 * scale;
  } else {
    cx = sw - dist - channelW;
    cy = rompeLateral ? (bordaInicio ? 6 * scale : -6 * scale) : 10 * scale;
    cw = channelW;
    ch = rompeLateral
      ? sh - (bordaInicio ? 6 * scale : -6 * scale) - (bordaFim ? 6 * scale : -6 * scale)
      : sh - 20 * scale;
  }

  return (
    <svg width={sw + pad * 2} height={sh + pad * 2} className="border border-border rounded bg-muted/30">
      <g transform={`translate(${pad},${pad})`}>
        <rect x={0} y={0} width={sw} height={sh} fill="hsl(40 30% 88%)" stroke="hsl(var(--border))" strokeWidth={1.5} rx={2} />
        <rect x={cx} y={cy} width={Math.max(cw, 1)} height={Math.max(ch, 1)}
          fill="hsl(200 70% 50% / 0.3)" stroke="hsl(200 70% 45%)" strokeWidth={1} strokeDasharray="3,2" />
        <text x={sw / 2} y={sh + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono">
          {largura}mm
        </text>
      </g>
    </svg>
  );
}

export function CanalLEDForm({ config, onChange }: Props) {
  const set = <K extends keyof CanalLEDConfig>(k: K, v: CanalLEDConfig[K]) => onChange({ ...config, [k]: v });

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
                <SelectItem value="superior">Superior</SelectItem>
                <SelectItem value="inferior">Inferior</SelectItem>
                <SelectItem value="esquerda">Esquerda</SelectItem>
                <SelectItem value="direita">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dist. borda (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.distanciaBorda} onChange={e => set("distanciaBorda", +e.target.value)} />
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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={config.rompeLateral} onCheckedChange={v => set("rompeLateral", !!v)} id="rompe" />
            <Label htmlFor="rompe" className="text-xs">Rompe lateral (passante)</Label>
          </div>
          {!config.rompeLateral && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={config.bordaInicio} onCheckedChange={v => set("bordaInicio", !!v)} id="bi" />
                <Label htmlFor="bi" className="text-xs">Borda início</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={config.bordaFim} onCheckedChange={v => set("bordaFim", !!v)} id="bf" />
                <Label htmlFor="bf" className="text-xs">Borda fim</Label>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox checked={config.cortarPeca} onCheckedChange={v => set("cortarPeca", !!v)} id="cortar" />
            <Label htmlFor="cortar" className="text-xs">Cortar peça (contorno)</Label>
          </div>
        </div>

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
