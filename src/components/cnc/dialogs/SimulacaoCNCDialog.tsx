import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Play, Pause, RotateCcw, FastForward, AlertTriangle, CheckCircle2, Eye, Maximize2, Move, RotateCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface SimulacaoCNCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: NestingSheet | null;
  machineConfig: {
    zSeguro: number;
    maxZMenos: number;
    deslocamentoX: number;
    deslocamentoY: number;
  };
}

interface SafetyLimits {
  mesaMinX: number;
  mesaMaxX: number;
  mesaMinY: number;
  mesaMaxY: number;
  zMin: number;
  zMax: number;
}

interface SafetyAlert {
  type: "error" | "warning";
  segmentIdx: number;
  message: string;
  detail: string;
  fix: string;
  x: number;
  y: number;
  z: number;
}

interface ToolpathSegment {
  type: "rapid" | "cut" | "drill" | "retract";
  from: THREE.Vector3;
  to: THREE.Vector3;
  toolDiam: number;
  safe: boolean;
  alertIdx?: number;
}

/**
 * Generate optimized toolpath - nearest-neighbor heuristic for minimum travel
 */
function generateToolpath(layout: NestingSheet, limits: SafetyLimits): { segments: ToolpathSegment[]; alerts: SafetyAlert[] } {
  const segments: ToolpathSegment[] = [];
  const alerts: SafetyAlert[] = [];
  const zSafe = 50;
  const zRapid = 16;
  const zCut = -(layout.espessura + 0.5);
  const toolDiam = 6;

  function checkSafety(x: number, y: number, z: number, segIdx: number, operation: string): boolean {
    let safe = true;

    if (x < limits.mesaMinX - 5) {
      alerts.push({
        type: "error", segmentIdx: segIdx,
        message: `X=${x.toFixed(1)}mm fora do limite esquerdo da mesa`,
        detail: `O movimento #${segIdx} durante "${operation}" posiciona a ferramenta em X=${x.toFixed(1)}mm, que está ${(limits.mesaMinX - x).toFixed(1)}mm além do limite esquerdo da mesa (${limits.mesaMinX}mm).`,
        fix: `Ajuste o deslocamento X da máquina ou reposicione a chapa. Verifique se a compensação do raio da fresa (${toolDiam / 2}mm) não excede os limites.`,
        x, y, z
      });
      safe = false;
    }
    if (x > limits.mesaMaxX + 5) {
      alerts.push({
        type: "error", segmentIdx: segIdx,
        message: `X=${x.toFixed(1)}mm fora do limite direito da mesa`,
        detail: `O movimento #${segIdx} durante "${operation}" excede o curso máximo X da máquina em ${(x - limits.mesaMaxX).toFixed(1)}mm.`,
        fix: `Reduza o tamanho da chapa ou ajuste o ponto de referência. Curso máximo X: ${limits.mesaMaxX}mm.`,
        x, y, z
      });
      safe = false;
    }
    if (y < limits.mesaMinY - 5) {
      alerts.push({
        type: "error", segmentIdx: segIdx,
        message: `Y=${y.toFixed(1)}mm fora do limite frontal da mesa`,
        detail: `O movimento #${segIdx} durante "${operation}" posiciona a ferramenta em Y=${y.toFixed(1)}mm, além do limite frontal (${limits.mesaMinY}mm).`,
        fix: `Verifique o zeramento da peça e o deslocamento Y configurado.`,
        x, y, z
      });
      safe = false;
    }
    if (y > limits.mesaMaxY + 5) {
      alerts.push({
        type: "error", segmentIdx: segIdx,
        message: `Y=${y.toFixed(1)}mm fora do limite traseiro da mesa`,
        detail: `O movimento #${segIdx} durante "${operation}" excede o curso máximo Y em ${(y - limits.mesaMaxY).toFixed(1)}mm.`,
        fix: `Reduza a profundidade da chapa ou ajuste o zeramento. Curso máximo Y: ${limits.mesaMaxY}mm.`,
        x, y, z
      });
      safe = false;
    }
    if (z < limits.zMin) {
      const excess = Math.abs(z - limits.zMin);
      alerts.push({
        type: excess > 2 ? "error" : "warning", segmentIdx: segIdx,
        message: `Z=${z.toFixed(1)}mm abaixo do limite seguro`,
        detail: `O movimento #${segIdx} durante "${operation}" penetra ${excess.toFixed(1)}mm além do Z mínimo permitido (${limits.zMin}mm). Isso pode danificar a mesa de sacrifício.`,
        fix: `Verifique a espessura configurada da chapa (${layout.espessura}mm) e o valor de maxZMenos nas configurações da máquina. Ajuste para no máximo Z=${limits.zMin}mm.`,
        x, y, z
      });
      safe = false;
    }

    return safe;
  }

  // Collect all operations: holes first, then cuts
  interface HoleOp { pieceIdx: number; hole: PromobHole; px: number; py: number; }
  const holeOps: HoleOp[] = [];

  layout.pieces.forEach((piece, pieceIdx) => {
    if (!piece.furos || piece.furos.length === 0) return;
    piece.furos.forEach(hole => {
      holeOps.push({ pieceIdx, hole, px: piece.x + hole.X, py: piece.y + hole.Y });
    });
  });

  // Sort holes by nearest-neighbor for minimum travel
  const sortedHoles: HoleOp[] = [];
  const remaining = [...holeOps];
  let currentPos = { x: 0, y: 0 };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = Math.hypot(remaining[i].px - currentPos.x, remaining[i].py - currentPos.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    sortedHoles.push(picked);
    currentPos = { x: picked.px, y: picked.py };
  }

  // Start position
  let pos = new THREE.Vector3(0, 0, zSafe);

  // Drill all holes
  sortedHoles.forEach(({ hole, px, py }) => {
    const hx = px;
    const hy = py;
    const hz = -(hole.Z || layout.espessura * 0.7);

    // Rapid to above hole
    const above = new THREE.Vector3(hx, hy, zRapid);
    const safe1 = checkSafety(hx, hy, zRapid, segments.length, `Posicionamento furo Ø${hole.DIAM}mm`);
    segments.push({ type: "rapid", from: pos.clone(), to: above, toolDiam: hole.DIAM, safe: safe1 });
    pos = above.clone();

    // Drill down
    const drill = new THREE.Vector3(hx, hy, hz);
    const safe2 = checkSafety(hx, hy, hz, segments.length, `Furação Ø${hole.DIAM}mm prof.${Math.abs(hz).toFixed(1)}mm`);
    segments.push({ type: "drill", from: pos.clone(), to: drill, toolDiam: hole.DIAM, safe: safe2 });
    pos = drill.clone();

    // Retract
    const retract = new THREE.Vector3(hx, hy, zSafe);
    segments.push({ type: "retract", from: pos.clone(), to: retract, toolDiam: hole.DIAM, safe: true });
    pos = retract.clone();
  });

  // Cut contours - sort pieces by nearest-neighbor
  const piecesToCut = [...layout.pieces];
  const sortedPieces: PlacedNestingPiece[] = [];
  const remainPieces = [...piecesToCut];
  currentPos = { x: pos.x, y: pos.y };

  while (remainPieces.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remainPieces.length; i++) {
      const d = Math.hypot(remainPieces[i].x - currentPos.x, remainPieces[i].y - currentPos.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remainPieces.splice(bestIdx, 1)[0];
    sortedPieces.push(picked);
    currentPos = { x: picked.x + picked.width, y: picked.y + picked.height };
  }

  // Cut each piece contour
  sortedPieces.forEach(piece => {
    const offset = toolDiam / 2;
    const x1 = piece.x - offset;
    const y1 = piece.y - offset;
    const x2 = piece.x + piece.width + offset;
    const y2 = piece.y + piece.height + offset;

    // Clamp to sheet bounds (no cutting outside sheet)
    const cx1 = Math.max(x1, -offset);
    const cy1 = Math.max(y1, -offset);
    const cx2 = Math.min(x2, layout.sheetWidth + offset);
    const cy2 = Math.min(y2, layout.sheetHeight + offset);

    // Rapid to start
    const start = new THREE.Vector3(cx1, cy1, zSafe);
    segments.push({ type: "rapid", from: pos.clone(), to: start, toolDiam, safe: true });
    pos = start.clone();

    // Plunge entry
    const plunge = new THREE.Vector3(cx1, cy1, zCut);
    const sp = checkSafety(cx1, cy1, zCut, segments.length, `Entrada de corte peça ${piece.label}`);
    segments.push({ type: "cut", from: pos.clone(), to: plunge, toolDiam, safe: sp });
    pos = plunge.clone();

    // Cut rectangle
    const corners = [
      new THREE.Vector3(cx2, cy1, zCut),
      new THREE.Vector3(cx2, cy2, zCut),
      new THREE.Vector3(cx1, cy2, zCut),
      new THREE.Vector3(cx1, cy1, zCut),
    ];

    corners.forEach((corner, ci) => {
      const edgeNames = ["inferior", "direita", "superior", "esquerda"];
      const sc = checkSafety(corner.x, corner.y, corner.z, segments.length, `Corte borda ${edgeNames[ci]} peça ${piece.label}`);
      segments.push({ type: "cut", from: pos.clone(), to: corner, toolDiam, safe: sc });
      pos = corner.clone();
    });

    // Retract
    const retractEnd = new THREE.Vector3(cx1, cy1, zSafe);
    segments.push({ type: "retract", from: pos.clone(), to: retractEnd, toolDiam, safe: true });
    pos = retractEnd.clone();
  });

  return { segments, alerts };
}

// ============ 3D Simulation Scene ============

function SimulationScene3D({ segments, progress, layout }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet }) {
  const toolRef = useRef<THREE.Mesh>(null);
  const scale = 0.01;
  const totalSegments = segments.length;
  const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

  // Track completed cuts and drills for material removal effect
  const completedCuts = useMemo(() => {
    const cuts: { x: number; y: number; w: number; h: number }[] = [];
    const drills: { x: number; y: number; r: number; depth: number }[] = [];

    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "drill") {
        drills.push({
          x: seg.to.x * scale,
          y: seg.to.y * scale,
          r: Math.max(seg.toolDiam / 2, 1.5) * scale,
          depth: Math.abs(seg.to.z) * scale,
        });
      }
      if (seg.type === "cut") {
        const minX = Math.min(seg.from.x, seg.to.x) * scale;
        const minY = Math.min(seg.from.y, seg.to.y) * scale;
        const maxX = Math.max(seg.from.x, seg.to.x) * scale;
        const maxY = Math.max(seg.from.y, seg.to.y) * scale;
        const w = maxX - minX + seg.toolDiam * scale;
        const h = maxY - minY + seg.toolDiam * scale;
        if (w > 0.001 || h > 0.001) {
          cuts.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: Math.max(w, seg.toolDiam * scale), h: Math.max(h, seg.toolDiam * scale) });
        }
      }
    }
    return { cuts, drills };
  }, [currentIdx, segments, scale]);

  // Calculate tool position
  let toolPos = new THREE.Vector3(0, 50 * scale, 0);
  if (segments.length > 0 && currentIdx >= 0) {
    const seg = segments[currentIdx];
    const frac = Math.min((progress * totalSegments) - currentIdx, 1);
    const fromS = new THREE.Vector3(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
    const toS = new THREE.Vector3(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
    toolPos = fromS.clone().lerp(toS, frac);
  }

  // Build trail line
  const trailPoints = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "cut" || seg.type === "drill") {
        pts.push(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
        pts.push(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
      }
    }
    return new Float32Array(pts);
  }, [currentIdx, segments, scale]);

  const rapidPoints = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "rapid" || seg.type === "retract") {
        pts.push(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
        pts.push(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
      }
    }
    return new Float32Array(pts);
  }, [currentIdx, segments, scale]);

  useFrame(() => {
    if (toolRef.current) {
      toolRef.current.position.copy(toolPos);
    }
  });

  const sheetW = layout.sheetWidth * scale;
  const sheetH = layout.sheetHeight * scale;
  const thickness = layout.espessura * scale;
  const currentSeg = currentIdx >= 0 && currentIdx < segments.length ? segments[currentIdx] : null;
  const isUnsafe = currentSeg && !currentSeg.safe;

  return (
    <>
      <PerspectiveCamera makeDefault position={[sheetW / 2 + 15, 12, sheetH / 2 + 15]} fov={45} />
      <OrbitControls
        makeDefault
        target={[sheetW / 2, 0, sheetH / 2]}
        enableDamping
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={60}
        enablePan
      />

      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 25, 15]} intensity={0.9} castShadow />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      <hemisphereLight args={["#b1c4de", "#8b7355", 0.3]} />

      {/* Mesa de sacrifício */}
      <mesh position={[sheetW / 2, -thickness - 0.02, sheetH / 2]} receiveShadow>
        <boxGeometry args={[sheetW + 2, 0.04, sheetH + 2]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.9} />
      </mesh>

      {/* Sheet (chapa inteira, sem marcações) */}
      <mesh position={[sheetW / 2, -thickness / 2, sheetH / 2]} castShadow receiveShadow>
        <boxGeometry args={[sheetW, thickness, sheetH]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Cut grooves - material removal marks */}
      {completedCuts.cuts.map((cut, i) => (
        <mesh key={`cut-${i}`} position={[cut.x, 0.001, cut.y]}>
          <boxGeometry args={[cut.w, thickness + 0.002, cut.h]} />
          <meshStandardMaterial color="#3a3020" roughness={0.8} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Drilled holes */}
      {completedCuts.drills.map((drill, i) => (
        <mesh key={`drill-${i}`} position={[drill.x, thickness / 2 + 0.001, drill.y]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[drill.r, drill.r, drill.depth, 16]} />
          <meshStandardMaterial color="#2a2015" roughness={0.9} />
        </mesh>
      ))}

      {/* Tool (spindle + collet + bit) */}
      <group ref={toolRef as any} position={toolPos}>
        {/* Spindle body */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.06, 0.04, 0.6, 16]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Collet */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.035, 0.025, 0.12, 12]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Cutting bit */}
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.015, 0.012, 0.35, 8]} />
          <meshStandardMaterial
            color={isUnsafe ? "#ff0000" : "#e0c050"}
            metalness={0.7}
            roughness={0.3}
            emissive={isUnsafe ? "#ff0000" : "#000000"}
            emissiveIntensity={isUnsafe ? 0.5 : 0}
          />
        </mesh>
        {/* Rotation indicator ring */}
        {progress > 0 && progress < 1 && currentSeg && (currentSeg.type === "cut" || currentSeg.type === "drill") && (
          <mesh position={[0, 0.1, 0]} rotation={[0, Date.now() * 0.01, 0]}>
            <torusGeometry args={[0.02, 0.003, 4, 16]} />
            <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.3} />
          </mesh>
        )}
      </group>

      {/* Cut trail (green) */}
      {trailPoints.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[trailPoints, 3]} count={trailPoints.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial color="#00ff88" linewidth={1} transparent opacity={0.7} />
        </lineSegments>
      )}

      {/* Rapid trail (yellow dashed) */}
      {rapidPoints.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[rapidPoints, 3]} count={rapidPoints.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial color="#ffaa00" linewidth={1} transparent opacity={0.3} />
        </lineSegments>
      )}

      {/* Grid */}
      <gridHelper args={[40, 40, "#444444", "#333333"]} position={[sheetW / 2, -thickness - 0.03, sheetH / 2]} />
    </>
  );
}

// ============ 2D Simulation View ============

function SimulationView2D({ segments, progress, layout }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scaleX = (w - 40) / layout.sheetWidth;
    const scaleY = (h - 40) / layout.sheetHeight;
    const sc = Math.min(scaleX, scaleY);
    const ox = 20;
    const oy = 20;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // Sheet background (chapa limpa)
    ctx.fillStyle = "#d4c4a8";
    ctx.fillRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);

    const totalSegments = segments.length;
    const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

    // Draw completed cuts as dark lines (material removed)
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "cut") {
        ctx.strokeStyle = "#3a2a18";
        ctx.lineWidth = Math.max(seg.toolDiam * sc, 2);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
        ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
        ctx.stroke();
      }
      if (seg.type === "drill") {
        ctx.fillStyle = "#2a1a0a";
        const r = Math.max(seg.toolDiam / 2 * sc, 2);
        ctx.beginPath();
        ctx.arc(ox + seg.to.x * sc, oy + seg.to.y * sc, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw trail
    ctx.lineWidth = 1;
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "rapid" || seg.type === "retract") {
        ctx.strokeStyle = "rgba(255,170,0,0.2)";
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = seg.safe ? "rgba(0,255,136,0.6)" : "rgba(255,0,0,0.8)";
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
      ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw tool position
    if (currentIdx >= 0 && currentIdx < segments.length) {
      const seg = segments[currentIdx];
      const frac = Math.min((progress * totalSegments) - currentIdx, 1);
      const tx = seg.from.x + (seg.to.x - seg.from.x) * frac;
      const ty = seg.from.y + (seg.to.y - seg.from.y) * frac;

      ctx.fillStyle = seg.safe ? "#ff4444" : "#ff0000";
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = seg.safe ? "#ff6666" : "#ff0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Legend
    ctx.font = "10px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(`${layout.sheetWidth} × ${layout.sheetHeight} mm`, ox + 4, oy + layout.sheetHeight * sc + 14);
  }, [segments, progress, layout]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={600}
      className="w-full h-full rounded"
      style={{ imageRendering: "crisp-edges" }}
    />
  );
}

// ============ Alert Detail Panel ============

function AlertDetailPanel({ alerts, onClose }: { alerts: SafetyAlert[]; onClose: () => void }) {
  const [selectedAlert, setSelectedAlert] = useState(0);

  if (alerts.length === 0) return null;
  const alert = alerts[selectedAlert];

  return (
    <div className="absolute top-2 right-2 bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg max-w-sm z-10">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {alerts.length} alerta(s) de segurança
        </div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClose}>×</Button>
      </div>

      {alerts.length > 1 && (
        <div className="flex gap-1 px-3 py-1 border-b border-border">
          {alerts.map((a, i) => (
            <Button
              key={i}
              variant={i === selectedAlert ? "default" : "ghost"}
              size="sm"
              className="h-5 px-1.5 text-[9px]"
              onClick={() => setSelectedAlert(i)}
            >
              #{i + 1}
            </Button>
          ))}
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="text-xs font-semibold text-destructive">{alert.message}</div>
        <div className="text-[10px] text-muted-foreground leading-relaxed">{alert.detail}</div>
        <div className="text-[10px] bg-muted/50 rounded p-2">
          <span className="font-semibold text-foreground">Correção: </span>
          <span className="text-muted-foreground">{alert.fix}</span>
        </div>
        <div className="text-[9px] font-mono text-muted-foreground">
          Posição: X={alert.x.toFixed(1)} Y={alert.y.toFixed(1)} Z={alert.z.toFixed(1)} | Segmento #{alert.segmentIdx}
        </div>
      </div>
    </div>
  );
}

// ============ Main Dialog ============

export function SimulacaoCNCDialog({ open, onOpenChange, layout, machineConfig }: SimulacaoCNCDialogProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [showAlerts, setShowAlerts] = useState(true);
  const animRef = useRef<number>(0);

  const limits: SafetyLimits = {
    mesaMinX: machineConfig.deslocamentoX,
    mesaMaxX: machineConfig.deslocamentoX + (layout?.sheetWidth || 2750) + 50,
    mesaMinY: machineConfig.deslocamentoY,
    mesaMaxY: machineConfig.deslocamentoY + (layout?.sheetHeight || 1840) + 50,
    zMin: machineConfig.maxZMenos,
    zMax: machineConfig.zSeguro,
  };

  const { segments, alerts } = useMemo(() =>
    layout ? generateToolpath(layout, limits) : { segments: [], alerts: [] },
    [layout, limits.mesaMinX, limits.mesaMaxX, limits.mesaMinY, limits.mesaMaxY, limits.zMin]
  );

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const step = () => {
      setProgress(p => {
        const next = p + 0.0003 * speed;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, speed]);

  const reset = () => { setPlaying(false); setProgress(0); };

  const currentSegIdx = Math.min(Math.floor(progress * segments.length), segments.length - 1);
  const currentSeg = currentSegIdx >= 0 ? segments[currentSegIdx] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Simulação CNC
              {layout && <span className="text-sm font-normal text-muted-foreground">— Chapa {layout.id} ({layout.sheetWidth}×{layout.sheetHeight}mm)</span>}
            </DialogTitle>

            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "3d" | "2d")}>
                <TabsList className="h-7">
                  <TabsTrigger value="3d" className="text-[10px] h-5 px-2">3D</TabsTrigger>
                  <TabsTrigger value="2d" className="text-[10px] h-5 px-2">2D</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative mx-4 rounded-lg overflow-hidden bg-black/95">
          {layout && segments.length > 0 ? (
            viewMode === "3d" ? (
              <Canvas shadows>
                <SimulationScene3D segments={segments} progress={progress} layout={layout} />
              </Canvas>
            ) : (
              <SimulationView2D segments={segments} progress={progress} layout={layout} />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Otimize um plano de corte antes de simular.
            </div>
          )}

          {/* Alerts panel */}
          {showAlerts && alerts.length > 0 && (
            <AlertDetailPanel alerts={alerts} onClose={() => setShowAlerts(false)} />
          )}

          {/* Safe badge */}
          {alerts.length === 0 && segments.length > 0 && (
            <div className="absolute top-2 right-2 bg-green-800/90 text-white text-[10px] px-3 py-1.5 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Todos os movimentos validados
            </div>
          )}

          {/* Current operation info */}
          {currentSeg && progress > 0 && progress < 1 && (
            <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur text-[9px] font-mono px-2 py-1 rounded border border-border">
              <span className={`font-bold ${currentSeg.type === "rapid" ? "text-yellow-400" : currentSeg.type === "drill" ? "text-blue-400" : currentSeg.type === "cut" ? "text-green-400" : "text-muted-foreground"}`}>
                {currentSeg.type === "rapid" ? "G0 RÁPIDO" : currentSeg.type === "drill" ? "FURAÇÃO" : currentSeg.type === "cut" ? "G1 CORTE" : "RETRAÇÃO"}
              </span>
              <span className="text-muted-foreground ml-2">
                X{currentSeg.to.x.toFixed(0)} Y{currentSeg.to.y.toFixed(0)} Z{currentSeg.to.z.toFixed(1)}
              </span>
              <span className="text-muted-foreground ml-2">Ø{currentSeg.toolDiam}mm</span>
            </div>
          )}

          {/* 3D view controls hint */}
          {viewMode === "3d" && (
            <div className="absolute bottom-2 right-2 flex gap-2 text-[8px] text-muted-foreground/50">
              <span className="flex items-center gap-0.5"><RotateCw className="h-2.5 w-2.5" /> Girar</span>
              <span className="flex items-center gap-0.5"><Move className="h-2.5 w-2.5" /> Pan</span>
              <span className="flex items-center gap-0.5"><Maximize2 className="h-2.5 w-2.5" /> Zoom</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 pb-4 pt-2 flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)} className="gap-1">
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? "Pausar" : "Iniciar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSpeed(s => s >= 16 ? 1 : s * 2)} className="gap-1">
            <FastForward className="h-3 w-3" /> {speed}x
          </Button>

          {alerts.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-destructive"
              onClick={() => setShowAlerts(!showAlerts)}
            >
              <AlertTriangle className="h-3 w-3" />
              {alerts.length}
            </Button>
          )}

          <div className="flex-1">
            <Slider
              value={[progress * 100]}
              onValueChange={([v]) => setProgress(v / 100)}
              max={100}
              step={0.1}
              className="w-full"
            />
          </div>

          <span className="text-[10px] text-muted-foreground font-mono w-16 text-right">
            {(progress * 100).toFixed(1)}%
          </span>

          <div className="flex gap-2 text-[9px] text-muted-foreground">
            <span>{segments.length} mov.</span>
            <span className={alerts.length > 0 ? "text-destructive font-bold" : "text-green-500"}>
              {alerts.length > 0 ? `⚠ ${alerts.length}` : "✓ OK"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
