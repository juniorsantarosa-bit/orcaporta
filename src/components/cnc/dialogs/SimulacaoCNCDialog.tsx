import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, RotateCcw, FastForward, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

// Safety limits
interface SafetyLimits {
  mesaMinX: number;
  mesaMaxX: number;
  mesaMinY: number;
  mesaMaxY: number;
  zMin: number;
  zMax: number;
}

interface ToolpathSegment {
  type: "rapid" | "cut" | "drill" | "retract";
  from: THREE.Vector3;
  to: THREE.Vector3;
  toolDiam: number;
  safe: boolean;
  warning?: string;
}

function generateToolpath(layout: NestingSheet, limits: SafetyLimits): { segments: ToolpathSegment[]; warnings: string[] } {
  const segments: ToolpathSegment[] = [];
  const warnings: string[] = [];
  const zSafe = 50;
  const zCut = -(layout.espessura + 0.5);
  const toolDiam = 6;

  function checkSafety(x: number, y: number, z: number): { safe: boolean; warning?: string } {
    if (x < limits.mesaMinX || x > limits.mesaMaxX) return { safe: false, warning: `X=${x.toFixed(0)} fora dos limites da mesa (${limits.mesaMinX}-${limits.mesaMaxX})` };
    if (y < limits.mesaMinY || y > limits.mesaMaxY) return { safe: false, warning: `Y=${y.toFixed(0)} fora dos limites da mesa (${limits.mesaMinY}-${limits.mesaMaxY})` };
    if (z < limits.zMin) return { safe: false, warning: `Z=${z.toFixed(1)} abaixo do limite (${limits.zMin})` };
    return { safe: true };
  }

  // Sort pieces for optimal path
  const sortedPieces = [...layout.pieces].sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // Start position
  let pos = new THREE.Vector3(0, 0, zSafe);

  // Drill all holes first
  sortedPieces.forEach(piece => {
    if (!piece.furos || piece.furos.length === 0) return;
    piece.furos.forEach(hole => {
      const hx = piece.x + hole.X;
      const hy = piece.y + hole.Y;
      const hz = -(hole.Z || layout.espessura * 0.7);

      // Rapid to above hole
      const aboveHole = new THREE.Vector3(hx, hy, zSafe);
      const safety1 = checkSafety(hx, hy, zSafe);
      segments.push({ type: "rapid", from: pos.clone(), to: aboveHole, toolDiam: hole.DIAM, safe: safety1.safe, warning: safety1.warning });
      if (!safety1.safe && safety1.warning) warnings.push(safety1.warning);
      pos = aboveHole.clone();

      // Drill down
      const drillPos = new THREE.Vector3(hx, hy, hz);
      const safety2 = checkSafety(hx, hy, hz);
      segments.push({ type: "drill", from: pos.clone(), to: drillPos, toolDiam: hole.DIAM, safe: safety2.safe, warning: safety2.warning });
      if (!safety2.safe && safety2.warning) warnings.push(safety2.warning);
      pos = drillPos.clone();

      // Retract
      const retract = new THREE.Vector3(hx, hy, zSafe);
      segments.push({ type: "retract", from: pos.clone(), to: retract, toolDiam: hole.DIAM, safe: true });
      pos = retract.clone();
    });
  });

  // Cut contours - use common-cut logic
  // Group adjacent pieces to find shared edges
  sortedPieces.forEach(piece => {
    const offset = toolDiam / 2;
    const x1 = piece.x - offset;
    const y1 = piece.y - offset;
    const x2 = piece.x + piece.width + offset;
    const y2 = piece.y + piece.height + offset;

    // Rapid to start
    const start = new THREE.Vector3(x1, y1, zSafe);
    const s0 = checkSafety(x1, y1, zSafe);
    segments.push({ type: "rapid", from: pos.clone(), to: start, toolDiam, safe: s0.safe, warning: s0.warning });
    if (!s0.safe && s0.warning) warnings.push(s0.warning);
    pos = start.clone();

    // Plunge
    const plunge = new THREE.Vector3(x1, y1, zCut);
    const sp = checkSafety(x1, y1, zCut);
    segments.push({ type: "cut", from: pos.clone(), to: plunge, toolDiam, safe: sp.safe, warning: sp.warning });
    if (!sp.safe && sp.warning) warnings.push(sp.warning);
    pos = plunge.clone();

    // Cut rectangle
    const corners = [
      new THREE.Vector3(x2, y1, zCut),
      new THREE.Vector3(x2, y2, zCut),
      new THREE.Vector3(x1, y2, zCut),
      new THREE.Vector3(x1, y1, zCut),
    ];

    corners.forEach(corner => {
      const sc = checkSafety(corner.x, corner.y, corner.z);
      segments.push({ type: "cut", from: pos.clone(), to: corner, toolDiam, safe: sc.safe, warning: sc.warning });
      if (!sc.safe && sc.warning) warnings.push(sc.warning);
      pos = corner.clone();
    });

    // Retract
    const retractEnd = new THREE.Vector3(x1, y1, zSafe);
    segments.push({ type: "retract", from: pos.clone(), to: retractEnd, toolDiam, safe: true });
    pos = retractEnd.clone();
  });

  return { segments, warnings: [...new Set(warnings)] };
}

function SimulationScene({ segments, progress, layout }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet }) {
  const toolRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.BufferGeometry>(null);
  const scale = 0.01;

  // Calculate tool position based on progress
  const totalSegments = segments.length;
  const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

  // Build trail points up to current position
  const trailPoints: THREE.Vector3[] = [];
  let toolPos = new THREE.Vector3(0, 0, 50 * scale);

  for (let i = 0; i <= currentIdx && i < segments.length; i++) {
    const seg = segments[i];
    const fromScaled = new THREE.Vector3(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
    const toScaled = new THREE.Vector3(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);

    if (seg.type === "cut" || seg.type === "drill") {
      trailPoints.push(fromScaled.clone(), toScaled.clone());
    }

    if (i === currentIdx) {
      const frac = (progress * totalSegments) - currentIdx;
      toolPos = fromScaled.clone().lerp(toScaled, frac);
    }
  }

  useFrame(() => {
    if (toolRef.current) {
      toolRef.current.position.copy(toolPos);
    }
  });

  const sheetW = layout.sheetWidth * scale;
  const sheetH = layout.sheetHeight * scale;
  const thickness = layout.espessura * scale;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      {/* Sheet/mesa */}
      <mesh position={[sheetW / 2, -thickness / 2, sheetH / 2]}>
        <boxGeometry args={[sheetW, thickness, sheetH]} />
        <meshStandardMaterial color="#c4a882" opacity={0.6} transparent />
      </mesh>

      {/* Pieces */}
      {layout.pieces.map((piece, idx) => (
        <mesh key={idx} position={[(piece.x + piece.width / 2) * scale, thickness / 2, (piece.y + piece.height / 2) * scale]}>
          <boxGeometry args={[piece.width * scale, thickness, piece.height * scale]} />
          <meshStandardMaterial color={`hsl(${(idx * 47) % 360}, 55%, 65%)`} />
        </mesh>
      ))}

      {/* Tool (spindle) */}
      <mesh ref={toolRef} position={toolPos}>
        <cylinderGeometry args={[0.03, 0.015, 0.8, 16]} />
        <meshStandardMaterial color="#ff4444" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Trail */}
      {trailPoints.length >= 2 && (
        <line>
          <bufferGeometry ref={trailRef}>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(trailPoints.flatMap(p => [p.x, p.y, p.z])), 3]}
              count={trailPoints.length}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00ff88" linewidth={2} />
        </line>
      )}

      {/* Unsafe segments in red */}
      {segments.filter(s => !s.safe).map((seg, i) => {
        const from = new THREE.Vector3(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
        const to = new THREE.Vector3(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
        return (
          <line key={`unsafe-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]), 3]}
                count={2}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ff0000" linewidth={3} />
          </line>
        );
      })}

      <OrbitControls makeDefault />
      <gridHelper args={[40, 40, "#333", "#222"]} position={[sheetW / 2, -thickness, sheetH / 2]} />
    </>
  );
}

export function SimulacaoCNCDialog({ open, onOpenChange, layout, machineConfig }: SimulacaoCNCDialogProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const animRef = useRef<number>(0);

  const limits: SafetyLimits = {
    mesaMinX: machineConfig.deslocamentoX,
    mesaMaxX: machineConfig.deslocamentoX + 3000,
    mesaMinY: machineConfig.deslocamentoY,
    mesaMaxY: machineConfig.deslocamentoY + 2000,
    zMin: machineConfig.maxZMenos,
    zMax: machineConfig.zSeguro,
  };

  const { segments, warnings } = layout ? generateToolpath(layout, limits) : { segments: [], warnings: [] };

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const step = () => {
      setProgress(p => {
        const next = p + 0.0005 * speed;
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

  const reset = () => {
    setPlaying(false);
    setProgress(0);
  };

  const unsafeCount = segments.filter(s => !s.safe).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Simulação CNC 3D
            {layout && <span className="text-sm font-normal text-muted-foreground">— Chapa {layout.id}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative bg-black/90 rounded-md mx-4">
          {layout && segments.length > 0 ? (
            <Canvas camera={{ position: [15, 12, 15], fov: 50 }}>
              <SimulationScene segments={segments} progress={progress} layout={layout} />
            </Canvas>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Otimize um plano de corte antes de simular.
            </div>
          )}

          {/* Safety overlay */}
          {warnings.length > 0 && (
            <div className="absolute top-2 right-2 bg-destructive/90 text-white text-[10px] px-3 py-2 rounded-md max-w-xs">
              <div className="flex items-center gap-1 font-bold mb-1">
                <AlertTriangle className="h-3 w-3" /> {warnings.length} alerta(s) de segurança
              </div>
              {warnings.slice(0, 3).map((w, i) => (
                <div key={i} className="opacity-90">• {w}</div>
              ))}
            </div>
          )}

          {unsafeCount === 0 && segments.length > 0 && (
            <div className="absolute top-2 right-2 bg-green-700/90 text-white text-[10px] px-3 py-1.5 rounded-md flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Todos os movimentos dentro dos limites
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
          <Button size="sm" variant="ghost" onClick={() => setSpeed(s => Math.min(s * 2, 16))} className="gap-1">
            <FastForward className="h-3 w-3" /> {speed}x
          </Button>

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
            <span>{segments.length} movimentos</span>
            <span className={unsafeCount > 0 ? "text-destructive font-bold" : "text-green-500"}>
              {unsafeCount > 0 ? `⚠ ${unsafeCount} inseguros` : "✓ Seguro"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
