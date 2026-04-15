import { DobradicaConfig, calcularPosicoesDobradicas } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  config: DobradicaConfig;
  onChange: (c: DobradicaConfig) => void;
}

function PecaPreview({ config }: { config: DobradicaConfig }) {
  const { larguraPorta, alturaPorta, diametroFresa, distanciaBordaLateral, lado } = config;
  const positions = calcularPosicoesDobradicas(config);
  const raio = diametroFresa / 2;

  const pad = 20;
  const maxW = 200;
  const maxH = 300;
  const scale = Math.min(maxW / larguraPorta, maxH / alturaPorta);
  const sw = larguraPorta * scale;
  const sh = alturaPorta * scale;

  const holesX = lado === "esquerda" || lado === "inferior"
    ? (distanciaBordaLateral + raio) * scale
    : sw - (distanciaBordaLateral + raio) * scale;

  return (
    <svg width={sw + pad * 2} height={sh + pad * 2} className="border border-border rounded bg-muted/30">
      <g transform={`translate(${pad},${pad})`}>
        <rect x={0} y={0} width={sw} height={sh} fill="hsl(40 30% 88%)" stroke="hsl(var(--border))" strokeWidth={1.5} rx={2} />
        {positions.map((posY, i) => (
          <g key={i}>
            <circle cx={holesX} cy={posY * scale} r={raio * scale} fill="hsl(30 70% 40% / 0.4)" stroke="hsl(30 70% 35%)" strokeWidth={1} />
            <text x={sw + 6} y={posY * scale + 3} fontSize={9} fill="hsl(var(--foreground))" className="font-mono">
              {posY.toFixed(0)}mm
            </text>
          </g>
        ))}
        <text x={sw / 2} y={sh + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono">
          {larguraPorta}mm
        </text>
        <text x={-10} y={sh / 2} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono" transform={`rotate(-90, -10, ${sh / 2})`}>
          {alturaPorta}mm
        </text>
      </g>
    </svg>
  );
}

export function DobradicaForm({ config, onChange }: Props) {
  const set = <K extends keyof DobradicaConfig>(k: K, v: DobradicaConfig[K]) => onChange({ ...config, [k]: v });

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lado</Label>
            <Select value={config.lado} onValueChange={v => set("lado", v as any)}>
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
            <Label className="text-xs">Espessura (mm)</Label>
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
            <Label className="text-xs">Largura porta (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.larguraPorta} onChange={e => set("larguraPorta", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Altura porta (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.alturaPorta} onChange={e => set("alturaPorta", +e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nº Dobradiças</Label>
            <Select value={String(config.numDobradicasTotal)} onValueChange={v => set("numDobradicasTotal", +v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Recuo bordas (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.recuoBorda} onChange={e => set("recuoBorda", +e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Dist. borda lateral (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.distanciaBordaLateral} onChange={e => set("distanciaBordaLateral", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ø Fresa (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.diametroFresa} readOnly disabled />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={config.cortarPeca} onCheckedChange={v => set("cortarPeca", !!v)} id="cortarDob" />
            <Label htmlFor="cortarDob" className="text-xs">Cortar peça (contorno)</Label>
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
          Profundidade: {config.profundidade}mm da superfície | Fresa Forstner Ø{config.diametroFresa}mm
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Preview</span>
        <PecaPreview config={config} />
      </div>
    </div>
  );
}
