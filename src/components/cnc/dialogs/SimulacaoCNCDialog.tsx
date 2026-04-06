import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet, PlacedNestingPiece, PromobHole } from "@/types/promob";
import { DEFAULT_TOOL_MAGAZINE, findToolByDiameter, getMainFresa, ToolSlot } from "@/types/toolMagazine";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play, Pause, RotateCcw, AlertTriangle, CheckCircle2,
  Maximize2, Move, RotateCw, Home, ZoomIn, ZoomOut, ChevronLeft, ChevronRight
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface SimulacaoCNCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: NestingSheet[];
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
  type: "rapid" | "cut" | "drill" | "retract" | "toolchange";
  from: THREE.Vector3;
  to: THREE.Vector3;
  toolDiam: number;
  safe: boolean;
  alertIdx?: number;
  toolName?: string;
  toolPosition?: number;
}

// Maximum penetration depth below sheet surface
const MAX_PENETRATION = -0.1;

/**
 * Clamp a value to safety limits, auto-correcting out-of-bounds values
 */
function clampToLimits(x: number, y: number, z: number, layout: NestingSheet, limits: SafetyLimits) {
  const safeX = Math.max(limits.mesaMinX, Math.min(x, limits.mesaMaxX));
  const safeY = Math.max(limits.mesaMinY, Math.min(y, limits.mesaMaxY));
  // Z: never go below -(espessura + 0.1mm) to protect the sacrifice table
  const minZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
  const safeZ = Math.max(minZ, Math.min(z, limits.zMax));
  return { x: safeX, y: safeY, z: safeZ, clamped: x !== safeX || y !== safeY || z !== safeZ };
}

/**
 * Generate optimized toolpath with redundant safety: clamp + validate + alert
 */
function generateToolpath(layout: NestingSheet, limits: SafetyLimits): { segments: ToolpathSegment[]; alerts: SafetyAlert[] } {
  const segments: ToolpathSegment[] = [];
  const alerts: SafetyAlert[] = [];
  const zSafe = 50;
  const zRapid = 16;
  const magazine = DEFAULT_TOOL_MAGAZINE;
  const mainFresa = getMainFresa(magazine);
  const mainToolDiam = mainFresa.diametro;

  const minAllowedZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
  const zCut = Math.max(-(layout.espessura + 0.1), minAllowedZ);

  function validateAndClamp(rawX: number, rawY: number, rawZ: number, segIdx: number, operation: string): { x: number; y: number; z: number; safe: boolean } {
    const clamped = clampToLimits(rawX, rawY, rawZ, layout, limits);
    if (clamped.clamped) {
      const changes: string[] = [];
      if (rawX !== clamped.x) changes.push(`X: ${rawX.toFixed(1)}→${clamped.x.toFixed(1)}`);
      if (rawY !== clamped.y) changes.push(`Y: ${rawY.toFixed(1)}→${clamped.y.toFixed(1)}`);
      if (rawZ !== clamped.z) changes.push(`Z: ${rawZ.toFixed(1)}→${clamped.z.toFixed(1)}`);
      alerts.push({
        type: "warning", segmentIdx: segIdx,
        message: `Movimento auto-corrigido em "${operation}"`,
        detail: `O movimento #${segIdx} foi automaticamente ajustado. Correções: ${changes.join(", ")}.`,
        fix: `Nenhuma ação necessária — o sistema corrigiu automaticamente. Verifique: espessura (${layout.espessura}mm), dimensões (${layout.sheetWidth}×${layout.sheetHeight}mm).`,
        x: rawX, y: rawY, z: rawZ,
      });
    }
    return { x: clamped.x, y: clamped.y, z: clamped.z, safe: true };
  }

  // Collect holes and group by diameter
  interface HoleOp { hole: PromobHole; px: number; py: number; }
  const holesByDiam = new Map<number, HoleOp[]>();

  layout.pieces.forEach((piece) => {
    if (!piece.furos || piece.furos.length === 0) return;
    piece.furos.forEach(hole => {
      const px = piece.x + (piece.rotated ? hole.Y : hole.X);
      const py = piece.y + (piece.rotated ? hole.X : hole.Y);
      const diam = hole.DIAM;
      if (!holesByDiam.has(diam)) holesByDiam.set(diam, []);
      holesByDiam.get(diam)!.push({ hole, px, py });
    });
  });

  let pos = new THREE.Vector3(0, 0, zSafe);
  let currentToolDiam = 0;
  let currentToolName = "";
  let currentToolPos = 0;

  // Helper: add toolchange segment
  function emitToolChange(toolSlot: ToolSlot) {
    if (currentToolDiam === toolSlot.diametro && currentToolName === toolSlot.nome) return;
    // Retract to safe Z first
    segments.push({ type: "retract", from: pos.clone(), to: new THREE.Vector3(pos.x, pos.y, zSafe), toolDiam: currentToolDiam || toolSlot.diametro, safe: true });
    pos = new THREE.Vector3(pos.x, pos.y, zSafe);
    // Rapid to tool change position (origin)
    segments.push({ type: "rapid", from: pos.clone(), to: new THREE.Vector3(0, 0, zSafe), toolDiam: toolSlot.diametro, safe: true });
    pos = new THREE.Vector3(0, 0, zSafe);
    // Toolchange segment (visual pause)
    segments.push({
      type: "toolchange", from: pos.clone(), to: pos.clone(),
      toolDiam: toolSlot.diametro, safe: true,
      toolName: toolSlot.nome, toolPosition: toolSlot.position,
    });
    currentToolDiam = toolSlot.diametro;
    currentToolName = toolSlot.nome;
    currentToolPos = toolSlot.position;
  }

  // Helper: nearest-neighbor sort
  function sortByNearest(ops: HoleOp[], startPos: { x: number; y: number }): HoleOp[] {
    const sorted: HoleOp[] = [];
    const remaining = [...ops];
    let cur = startPos;
    while (remaining.length > 0) {
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = Math.hypot(remaining[i].px - cur.x, remaining[i].py - cur.y);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const picked = remaining.splice(bestIdx, 1)[0];
      sorted.push(picked);
      cur = { x: picked.px, y: picked.py };
    }
    return sorted;
  }

  // Process holes grouped by diameter — each group gets a tool change
  const diametersSorted = Array.from(holesByDiam.keys()).sort((a, b) => a - b);
  for (const diam of diametersSorted) {
    const holes = holesByDiam.get(diam)!;
    // Find matching tool in magazine
    const tool = findToolByDiameter(magazine, diam, "broca") || findToolByDiameter(magazine, diam);
    const toolSlot: ToolSlot = tool || {
      position: 0, nome: `Broca ${diam}mm`, tipo: "broca",
      diametro: diam, rpm: 8000, avancoCorte: 3000, avancoEntrada: 3000, ativo: true,
    };

    emitToolChange(toolSlot);

    const sorted = sortByNearest(holes, { x: pos.x, y: pos.y });
    for (const { hole, px, py } of sorted) {
      const rawHz = -(hole.Z || layout.espessura * 0.7);
      const hz = Math.max(rawHz, minAllowedZ);

      const above = validateAndClamp(px, py, zRapid, segments.length, `Posicionamento furo Ø${diam}mm`);
      segments.push({ type: "rapid", from: pos.clone(), to: new THREE.Vector3(above.x, above.y, above.z), toolDiam: diam, safe: true, toolName: toolSlot.nome, toolPosition: toolSlot.position });
      pos = new THREE.Vector3(above.x, above.y, above.z);

      const drill = validateAndClamp(px, py, hz, segments.length, `Furação Ø${diam}mm prof.${Math.abs(hz).toFixed(1)}mm`);
      segments.push({ type: "drill", from: pos.clone(), to: new THREE.Vector3(drill.x, drill.y, drill.z), toolDiam: diam, safe: true, toolName: toolSlot.nome, toolPosition: toolSlot.position });
      pos = new THREE.Vector3(drill.x, drill.y, drill.z);

      segments.push({ type: "retract", from: pos.clone(), to: new THREE.Vector3(drill.x, drill.y, zSafe), toolDiam: diam, safe: true, toolName: toolSlot.nome, toolPosition: toolSlot.position });
      pos = new THREE.Vector3(drill.x, drill.y, zSafe);
    }
  }

  // Switch to main cutting fresa for contours
  emitToolChange(mainFresa);

  // Cut contours - sort pieces by nearest-neighbor
  const remainPieces = [...layout.pieces];
  const sortedPieces: PlacedNestingPiece[] = [];
  let currentPos = { x: pos.x, y: pos.y };
  while (remainPieces.length > 0) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < remainPieces.length; i++) {
      const d = Math.hypot(remainPieces[i].x - currentPos.x, remainPieces[i].y - currentPos.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remainPieces.splice(bestIdx, 1)[0];
    sortedPieces.push(picked);
    currentPos = { x: picked.x + picked.width, y: picked.y + picked.height };
  }

  const offset = mainToolDiam / 2;
  sortedPieces.forEach(piece => {
    const cx1 = Math.max(piece.x - offset, 0);
    const cy1 = Math.max(piece.y - offset, 0);
    const cx2 = Math.min(piece.x + piece.width + offset, layout.sheetWidth);
    const cy2 = Math.min(piece.y + piece.height + offset, layout.sheetHeight);

    const start = validateAndClamp(cx1, cy1, zSafe, segments.length, `Posicionamento peça ${piece.label}`);
    segments.push({ type: "rapid", from: pos.clone(), to: new THREE.Vector3(start.x, start.y, start.z), toolDiam: mainToolDiam, safe: true, toolName: mainFresa.nome, toolPosition: mainFresa.position });
    pos = new THREE.Vector3(start.x, start.y, start.z);

    const plunge = validateAndClamp(cx1, cy1, zCut, segments.length, `Entrada de corte peça ${piece.label}`);
    segments.push({ type: "cut", from: pos.clone(), to: new THREE.Vector3(plunge.x, plunge.y, plunge.z), toolDiam: mainToolDiam, safe: true, toolName: mainFresa.nome, toolPosition: mainFresa.position });
    pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

    const rawCorners = [
      { x: cx2, y: cy1 }, { x: cx2, y: cy2 },
      { x: cx1, y: cy2 }, { x: cx1, y: cy1 },
    ];
    const edgeNames = ["inferior", "direita", "superior", "esquerda"];
    rawCorners.forEach((corner, ci) => {
      const c = validateAndClamp(corner.x, corner.y, zCut, segments.length, `Corte borda ${edgeNames[ci]} peça ${piece.label}`);
      segments.push({ type: "cut", from: pos.clone(), to: new THREE.Vector3(c.x, c.y, c.z), toolDiam: mainToolDiam, safe: true, toolName: mainFresa.nome, toolPosition: mainFresa.position });
      pos = new THREE.Vector3(c.x, c.y, c.z);
    });

    segments.push({ type: "retract", from: pos.clone(), to: new THREE.Vector3(pos.x, pos.y, zSafe), toolDiam: mainToolDiam, safe: true, toolName: mainFresa.nome, toolPosition: mainFresa.position });
    pos = new THREE.Vector3(pos.x, pos.y, zSafe);
  });

  // Final safety pass
  segments.forEach((seg) => {
    const minZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
    if (seg.to.z < minZ) seg.to.z = minZ;
    if (seg.to.x < 0) seg.to.x = 0;
    if (seg.to.y < 0) seg.to.y = 0;
    if (seg.to.x > layout.sheetWidth) seg.to.x = layout.sheetWidth;
    if (seg.to.y > layout.sheetHeight) seg.to.y = layout.sheetHeight;
  });

  return { segments, alerts };
}

// ============ 3D Camera Controls Component ============
function CameraControls({ sheetW, sheetH, cameraAction }: { sheetW: number; sheetH: number; cameraAction: string }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(sheetW / 2 + 15, 12, sheetH / 2 + 15);
  }, [camera, sheetW, sheetH]);

  useEffect(() => {
    if (!cameraAction || !controlsRef.current) return;
    const controls = controlsRef.current;
    const target = new THREE.Vector3(sheetW / 2, 0, sheetH / 2);
    
    if (cameraAction === "zoomIn") {
      camera.position.lerp(target, 0.2);
      camera.updateProjectionMatrix();
    } else if (cameraAction === "zoomOut") {
      const dir = camera.position.clone().sub(target).normalize();
      camera.position.add(dir.multiplyScalar(3));
      camera.updateProjectionMatrix();
    } else if (cameraAction === "fit") {
      camera.position.set(sheetW / 2, Math.max(sheetW, sheetH) * 0.8, sheetH / 2 + 0.1);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      if (controls.target) controls.target.copy(target);
    } else if (cameraAction === "home") {
      camera.position.set(sheetW / 2 + 15, 12, sheetH / 2 + 15);
      camera.updateProjectionMatrix();
      if (controls.target) controls.target.copy(target);
    }
    controls.update?.();
  }, [cameraAction, camera, sheetW, sheetH]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[sheetW / 2, 0, sheetH / 2]}
      enableDamping
      dampingFactor={0.1}
      minDistance={3}
      maxDistance={60}
      enablePan
    />
  );
}

// ============ 3D Simulation Scene ============

function SimulationScene3D({ segments, progress, layout, cameraAction }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet; cameraAction: string }) {
  const toolRef = useRef<THREE.Group>(null);
  const scale = 0.01;
  const totalSegments = segments.length;
  const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

  const completedCuts = useMemo(() => {
    const cuts: { x: number; y: number; w: number; h: number }[] = [];
    const drills: { x: number; y: number; r: number; depth: number }[] = [];

    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "drill") {
        drills.push({
          x: seg.to.x * scale, y: seg.to.y * scale,
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

  let toolPos = new THREE.Vector3(0, 50 * scale, 0);
  if (segments.length > 0 && currentIdx >= 0) {
    const seg = segments[currentIdx];
    const frac = Math.min((progress * totalSegments) - currentIdx, 1);
    const fromS = new THREE.Vector3(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
    const toS = new THREE.Vector3(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
    toolPos = fromS.clone().lerp(toS, frac);
  }

  // Trail: green for cuts/drills, red for rapid/retract
  const cutTrailPoints = useMemo(() => {
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

  const rapidTrailPoints = useMemo(() => {
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
  const isCutting = currentSeg && (currentSeg.type === "cut" || currentSeg.type === "drill");

  return (
    <>
      <PerspectiveCamera makeDefault position={[sheetW / 2 + 15, 12, sheetH / 2 + 15]} fov={45} />
      <CameraControls sheetW={sheetW} sheetH={sheetH} cameraAction={cameraAction} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 15]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      <hemisphereLight args={["#ddeeff", "#c0b090", 0.3]} />

      {/* Mesa de sacrifício */}
      <mesh position={[sheetW / 2, -thickness - 0.02, sheetH / 2]} receiveShadow>
        <boxGeometry args={[sheetW + 2, 0.04, sheetH + 2]} />
        <meshStandardMaterial color="#8a7a6a" roughness={0.9} />
      </mesh>

      {/* Sheet (chapa) */}
      <mesh position={[sheetW / 2, -thickness / 2, sheetH / 2]} castShadow receiveShadow>
        <boxGeometry args={[sheetW, thickness, sheetH]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Cut grooves */}
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

      {/* Tool */}
      <group ref={toolRef} position={toolPos}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.06, 0.04, 0.6, 16]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.035, 0.025, 0.12, 12]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.015, 0.012, 0.35, 8]} />
          <meshStandardMaterial color={isCutting ? "#00cc66" : "#e0c050"} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Cut trail (green) */}
      {cutTrailPoints.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[cutTrailPoints, 3]} count={cutTrailPoints.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial color="#00cc44" linewidth={1} transparent opacity={0.8} />
        </lineSegments>
      )}

      {/* Rapid trail (red) */}
      {rapidTrailPoints.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[rapidTrailPoints, 3]} count={rapidTrailPoints.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial color="#ff3333" linewidth={1} transparent opacity={0.4} />
        </lineSegments>
      )}

      {/* Grid */}
      <gridHelper args={[40, 40, "#cccccc", "#dddddd"]} position={[sheetW / 2, -thickness - 0.03, sheetH / 2]} />
    </>
  );
}

// ============ 2D Simulation View with Pan & Zoom ============

function SimulationView2D({ segments, progress, layout }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(z * factor, 10)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { // middle button
      e.preventDefault();
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan(p => ({
        x: p.x + (e.clientX - lastMouse.current.x),
        y: p.y + (e.clientY - lastMouse.current.y),
      }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const baseScale = Math.min((w - 80) / layout.sheetWidth, (h - 80) / layout.sheetHeight);
    const sc = baseScale * zoom;
    const ox = 40 + pan.x;
    const oy = 40 + pan.y;

    ctx.clearRect(0, 0, w, h);
    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Sheet background
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);

    const totalSegments = segments.length;
    const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

    // Draw completed cuts
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

    // Draw trail - RED for rapid, GREEN for cuts/drills
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "rapid" || seg.type === "retract") {
        ctx.strokeStyle = "rgba(255,50,50,0.5)";
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = "rgba(0,200,68,0.7)";
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
      const isCut = seg.type === "cut" || seg.type === "drill";

      ctx.fillStyle = isCut ? "#00cc44" : "#ff3333";
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isCut ? "#00aa33" : "#cc0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Legend
    ctx.font = "11px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText(`${layout.sheetWidth} × ${layout.sheetHeight} mm · ${layout.material} · ${layout.espessura}mm`, ox + 4, oy + layout.sheetHeight * sc + 16);

    // Legend colors
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(ox + layout.sheetWidth * sc - 160, oy + layout.sheetHeight * sc + 6, 10, 10);
    ctx.fillStyle = "#666";
    ctx.fillText("Rápido (vazio)", ox + layout.sheetWidth * sc - 145, oy + layout.sheetHeight * sc + 16);

    ctx.fillStyle = "#00cc44";
    ctx.fillRect(ox + layout.sheetWidth * sc - 60, oy + layout.sheetHeight * sc + 6, 10, 10);
    ctx.fillStyle = "#666";
    ctx.fillText("Corte", ox + layout.sheetWidth * sc - 45, oy + layout.sheetHeight * sc + 16);
  }, [segments, progress, layout, pan, zoom]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      className="w-full h-full rounded cursor-grab active:cursor-grabbing"
      style={{ imageRendering: "crisp-edges" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={e => e.preventDefault()}
    />
  );
}

// ============ Sim Toolbar Button ============
function SimToolButton({ icon: Icon, label, onClick, active }: { icon: React.ElementType; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

// ============ Alert Detail Panel ============

function AlertDetailPanel({ alerts, onClose }: { alerts: SafetyAlert[]; onClose: () => void }) {
  const [selectedAlert, setSelectedAlert] = useState(0);

  if (alerts.length === 0) return null;
  const alert = alerts[Math.min(selectedAlert, alerts.length - 1)];

  return (
    <div className="absolute top-2 right-12 bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg max-w-sm z-10 max-h-[50%] overflow-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {alerts.length} aviso(s) — auto-corrigidos
        </div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClose}>×</Button>
      </div>

      {alerts.length > 1 && (
        <div className="flex gap-1 px-3 py-1 border-b border-border flex-wrap">
          {alerts.slice(0, 20).map((a, i) => (
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
          {alerts.length > 20 && <span className="text-[9px] text-muted-foreground self-center">+{alerts.length - 20} mais</span>}
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="text-xs font-semibold text-yellow-600">{alert.message}</div>
        <div className="text-[10px] text-muted-foreground leading-relaxed">{alert.detail}</div>
        <div className="text-[10px] bg-muted/50 rounded p-2">
          <span className="font-semibold text-foreground">Info: </span>
          <span className="text-muted-foreground">{alert.fix}</span>
        </div>
        <div className="text-[9px] font-mono text-muted-foreground">
          Posição original: X={alert.x.toFixed(1)} Y={alert.y.toFixed(1)} Z={alert.z.toFixed(1)} | Segmento #{alert.segmentIdx}
        </div>
      </div>
    </div>
  );
}

// ============ Speed Options ============
const SPEED_OPTIONS = [0.2, 0.5, 0.75, 1, 2, 4];

// ============ Main Dialog ============

export function SimulacaoCNCDialog({ open, onOpenChange, layouts, machineConfig }: SimulacaoCNCDialogProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [cameraAction, setCameraAction] = useState("");
  const cameraActionCounter = useRef(0);
  const animRef = useRef<number>(0);

  const triggerCameraAction = (action: string) => {
    cameraActionCounter.current++;
    setCameraAction(`${action}_${cameraActionCounter.current}`);
  };

  const layout = layouts[selectedSheetIdx] || null;

  const limits: SafetyLimits = useMemo(() => ({
    mesaMinX: machineConfig.deslocamentoX,
    mesaMaxX: machineConfig.deslocamentoX + (layout?.sheetWidth || 2750),
    mesaMinY: machineConfig.deslocamentoY,
    mesaMaxY: machineConfig.deslocamentoY + (layout?.sheetHeight || 1840),
    zMin: -(layout ? layout.espessura + Math.abs(MAX_PENETRATION) : 1),
    zMax: machineConfig.zSeguro,
  }), [machineConfig, layout]);

  const { segments, alerts } = useMemo(() =>
    layout ? generateToolpath(layout, limits) : { segments: [], alerts: [] },
    [layout, limits]
  );

  // Reset on sheet change
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [selectedSheetIdx]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const step = () => {
      setProgress(p => {
        const next = p + 0.0003 * speed;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, speed]);

  const reset = () => { setPlaying(false); setProgress(0); };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  const currentSegIdx = Math.min(Math.floor(progress * segments.length), segments.length - 1);
  const currentSeg = currentSegIdx >= 0 ? segments[currentSegIdx] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Simulação CNC
            </DialogTitle>

            <div className="flex items-center gap-2">
              {/* Sheet selector */}
              {layouts.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={selectedSheetIdx === 0}
                    onClick={() => setSelectedSheetIdx(i => i - 1)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Select value={String(selectedSheetIdx)} onValueChange={v => setSelectedSheetIdx(Number(v))}>
                    <SelectTrigger className="h-7 w-auto text-[10px] min-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {layouts.map((l, i) => (
                        <SelectItem key={i} value={String(i)} className="text-xs">
                          Chapa {l.id} — {l.material} {l.espessura}mm
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={selectedSheetIdx === layouts.length - 1}
                    onClick={() => setSelectedSheetIdx(i => i + 1)}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "3d" | "2d")}>
                <TabsList className="h-7">
                  <TabsTrigger value="3d" className="text-[10px] h-5 px-2">3D</TabsTrigger>
                  <TabsTrigger value="2d" className="text-[10px] h-5 px-2">2D</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Main viewport */}
          <div className="flex-1 relative mx-4 rounded-lg overflow-hidden bg-background border border-border">
            {layout && segments.length > 0 ? (
              viewMode === "3d" ? (
                <Canvas shadows gl={{ alpha: false }} style={{ background: "#f5f5f5" }}>
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
              <div className="absolute top-2 right-12 bg-green-100 text-green-800 text-[10px] px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-green-200">
                <CheckCircle2 className="h-3 w-3" /> Todos os movimentos validados
              </div>
            )}

            {/* Current operation info */}
            {currentSeg && progress > 0 && progress < 1 && (
              <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur text-[9px] font-mono px-2 py-1 rounded border border-border">
                <span className={`font-bold ${
                  currentSeg.type === "toolchange" ? "text-blue-500" :
                  currentSeg.type === "rapid" ? "text-red-500" :
                  currentSeg.type === "drill" ? "text-green-600" :
                  currentSeg.type === "cut" ? "text-green-600" : "text-muted-foreground"
                }`}>
                  {currentSeg.type === "toolchange" ? `🔧 TROCA: T${currentSeg.toolPosition} ${currentSeg.toolName}` :
                   currentSeg.type === "rapid" ? "G0 RÁPIDO" :
                   currentSeg.type === "drill" ? "FURAÇÃO" :
                   currentSeg.type === "cut" ? "G1 CORTE" : "RETRAÇÃO"}
                </span>
                {currentSeg.type !== "toolchange" && (
                  <span className="text-muted-foreground ml-2">
                    X{currentSeg.to.x.toFixed(0)} Y{currentSeg.to.y.toFixed(0)} Z{currentSeg.to.z.toFixed(1)}
                  </span>
                )}
                <span className="text-muted-foreground ml-2">
                  {currentSeg.toolName ? `T${currentSeg.toolPosition} ${currentSeg.toolName}` : `Ø${currentSeg.toolDiam}mm`}
                </span>
              </div>
            )}

            {/* Sheet info */}
            {layout && (
              <div className="absolute top-2 left-2 bg-card/90 backdrop-blur text-[9px] font-mono px-2 py-1 rounded border border-border">
                <span className="font-semibold text-foreground">{layout.material}</span>
                <span className="text-muted-foreground ml-1">{layout.sheetWidth}×{layout.sheetHeight}mm</span>
                <span className="text-muted-foreground ml-1">Esp: {layout.espessura}mm</span>
                {currentSeg && (
                  <span className="ml-1 text-blue-500 font-semibold">
                    | T{currentSeg.toolPosition || '?'} {currentSeg.toolName || `Ø${currentSeg.toolDiam}mm`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right toolbar (similar to cutting view) */}
          <div className="w-9 border-l border-border bg-card flex flex-col items-center py-2 gap-0.5 mr-4">
            <SimToolButton icon={Home} label="Resetar Vista" onClick={reset} />
            <Separator className="my-1 w-5" />
            {viewMode === "3d" && (
              <>
                <SimToolButton icon={RotateCw} label="Orbit (arrastar)" active />
                <SimToolButton icon={Move} label="Pan (Shift+arrastar)" />
              </>
            )}
            {viewMode === "2d" && (
              <SimToolButton icon={Move} label="Pan (botão central)" active />
            )}
            <Separator className="my-1 w-5" />
            <SimToolButton icon={ZoomIn} label="Zoom +" onClick={() => {}} />
            <SimToolButton icon={ZoomOut} label="Zoom -" onClick={() => {}} />
            <SimToolButton icon={Maximize2} label="Zoom Fit" onClick={() => {}} />
            <Separator className="my-1 w-5" />
            {alerts.length > 0 ? (
              <SimToolButton icon={AlertTriangle} label={`${alerts.length} avisos`} onClick={() => setShowAlerts(!showAlerts)} active={showAlerts} />
            ) : (
              <SimToolButton icon={CheckCircle2} label="Sem alertas" />
            )}
          </div>
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

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-all ${
                  speed === s ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

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
            <span className={alerts.length > 0 ? "text-yellow-600 font-bold" : "text-green-600"}>
              {alerts.length > 0 ? `⚠ ${alerts.length} corrigidos` : "✓ OK"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
