import { PrateleiraConfig, calcularFurosPrateleira } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  config: PrateleiraConfig;
  onChange: (c: PrateleiraConfig) => void;
}

function PecaPreview({ config }: { config: PrateleiraConfig }) {
  const holes = calcularFurosPrateleira(config);
  const { largura, altura } = config;
  const pad = 20;
  const maxW = 220;
  const maxH = 180;
  const scale = Math.min(maxW / largura, maxH / altura);
  const sw = largura * scale;
  const sh = altura * scale;

  return (
    <svg width={sw + pad * 2} height={sh + pad * 2} className="border border-border rounded bg-muted/30">
      <g transform={`translate(${pad},${pad})`}>
        <rect x={0} y={0} width={sw} height={sh} fill="hsl(40 30% 88%)" stroke="hsl(var(--border))" strokeWidth={1.5} rx={2} />
        {holes.map((h, i) => (
          <circle key={i} cx={h.x * scale} cy={h.y * scale} r={Math.max(3, 2.5 * scale)}
            fill="hsl(217 91% 45% / 0.5)" stroke="hsl(217 91% 40%)" strokeWidth={1} />
        ))}
        <text x={sw / 2} y={sh + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono">
          {largura}mm
        </text>
        <text x={-10} y={sh / 2} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" className="font-mono" transform={`rotate(-90, -10, ${sh / 2})`}>
          {altura}mm
        </text>
      </g>
    </svg>
  );
}

export function PrateleiraForm({ config, onChange }: Props) {
  const set = <K extends keyof PrateleiraConfig>(k: K, v: PrateleiraConfig[K]) => onChange({ ...config, [k]: v });

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Largura (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.largura} onChange={e => set("largura", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Altura (mm)</Label>
            <Input type="number" className="h-8 text-xs" value={config.altura} onChange={e => set("altura", +e.target.value)} />
          </div>
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
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          4 furos padrão | Ø5mm | Prof: 12mm | Recuo: 37mm × 9.5mm das bordas
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Preview</span>
        <PecaPreview config={config} />
      </div>
    </div>
  );
}
