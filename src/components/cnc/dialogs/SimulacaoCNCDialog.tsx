import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NestingSheet, PlacedNestingPiece, PromobHole, Usinagem } from "@/types/promob";
import { DEFAULT_TOOL_MAGAZINE, findToolByDiameter, getMainFresa, ToolSlot } from "@/types/toolMagazine";
import { detectSharedEdges, getRemainingContourSegments } from "@/lib/gcode/commonCut";
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
  // Allow small negative offsets for fresa edge cuts (contour offset beyond sheet edge)
  const edgeMargin = 10; // generous margin for fresa offset
  const safeX = Math.max(limits.mesaMinX - edgeMargin, Math.min(x, limits.mesaMaxX + edgeMargin));
  const safeY = Math.max(limits.mesaMinY - edgeMargin, Math.min(y, limits.mesaMaxY + edgeMargin));
  // Z: never go below -(espessura + 0.1mm) to protect the sacrifice table
  const minZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
  const safeZ = Math.max(minZ, Math.min(z, limits.zMax));
  return { x: safeX, y: safeY, z: safeZ, clamped: x !== safeX || y !== safeY || z !== safeZ };
}

/**
 * Generate optimized toolpath with redundant safety: clamp + validate + alert
 * useCommonCut: when true, shared edges are cut once between adjacent pieces
 */
function generateToolpath(layout: NestingSheet, limits: SafetyLimits, useCommonCut: boolean = true): { segments: ToolpathSegment[]; alerts: SafetyAlert[]; totalDistance: number; cutDistance: number; rapidDistance: number } {
  const segments: ToolpathSegment[] = [];
  const alerts: SafetyAlert[] = [];
  const zSafe = 50;
  const zRapid = 16;
  const magazine = DEFAULT_TOOL_MAGAZINE;
  const mainFresa = getMainFresa(magazine);
  const mainToolDiam = mainFresa.diametro;

  const minAllowedZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
  const zCut = Math.max(-(layout.espessura + 0.1), minAllowedZ);

  let totalDistance = 0;
  let cutDistance = 0;
  let rapidDistance = 0;

  function dist3d(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

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

  function addSegment(type: ToolpathSegment["type"], from: THREE.Vector3, to: THREE.Vector3, toolDiam: number, toolName?: string, toolPosition?: number) {
    const d = dist3d(from, to);
    totalDistance += d;
    if (type === "rapid" || type === "retract") rapidDistance += d;
    else if (type === "cut" || type === "drill") cutDistance += d;
    segments.push({ type, from: from.clone(), to: to.clone(), toolDiam, safe: true, toolName, toolPosition });
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

  function emitToolChange(toolSlot: ToolSlot) {
    if (currentToolDiam === toolSlot.diametro && currentToolName === toolSlot.nome) return;
    addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), currentToolDiam || toolSlot.diametro);
    pos = new THREE.Vector3(pos.x, pos.y, zSafe);
    addSegment("rapid", pos, new THREE.Vector3(0, 0, zSafe), toolSlot.diametro);
    pos = new THREE.Vector3(0, 0, zSafe);
    segments.push({
      type: "toolchange", from: pos.clone(), to: pos.clone(),
      toolDiam: toolSlot.diametro, safe: true,
      toolName: toolSlot.nome, toolPosition: toolSlot.position,
    });
    currentToolDiam = toolSlot.diametro;
    currentToolName = toolSlot.nome;
    currentToolPos = toolSlot.position;
  }

  // Nearest-neighbor sort for holes
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

  // Process holes grouped by diameter
  const diametersSorted = Array.from(holesByDiam.keys()).sort((a, b) => a - b);
  for (const diam of diametersSorted) {
    const holes = holesByDiam.get(diam)!;
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
      addSegment("rapid", pos, new THREE.Vector3(above.x, above.y, above.z), diam, toolSlot.nome, toolSlot.position);
      pos = new THREE.Vector3(above.x, above.y, above.z);

      const drill = validateAndClamp(px, py, hz, segments.length, `Furação Ø${diam}mm prof.${Math.abs(hz).toFixed(1)}mm`);
      addSegment("drill", pos, new THREE.Vector3(drill.x, drill.y, drill.z), diam, toolSlot.nome, toolSlot.position);
      pos = new THREE.Vector3(drill.x, drill.y, drill.z);

      addSegment("retract", pos, new THREE.Vector3(drill.x, drill.y, zSafe), diam, toolSlot.nome, toolSlot.position);
      pos = new THREE.Vector3(drill.x, drill.y, zSafe);
    }
  }

  // === MACHINING OPERATIONS (usinagens: grooves, circular cutouts, etc.) ===
  // These come AFTER drilling, BEFORE contour cuts — matching real CNC workflow
  interface UsinagemOp { u: Usinagem; px: number; py: number; piece: PlacedNestingPiece; }
  const usinagemOps: UsinagemOp[] = [];

  layout.pieces.forEach((piece) => {
    if (!piece.usinagens || piece.usinagens.length === 0) return;
    piece.usinagens.forEach(u => {
      // Handle rotation: when piece is rotated 90°, swap X/Y and adjust dimensions
      let px: number, py: number;
      let adjustedU = { ...u };
      if (piece.rotated) {
        px = piece.x + (u.y || 0);
        py = piece.y + (u.x || 0);
        // Swap comprimento/largura for rotated pieces
        adjustedU = { ...u, comprimento: u.largura, largura: u.comprimento || u.largura };
      } else {
        px = piece.x + (u.x || 0);
        py = piece.y + (u.y || 0);
      }
      usinagemOps.push({ u: adjustedU, px, py, piece });
    });
  });

  if (usinagemOps.length > 0) {
    // Use fresa for machining operations — may need different tool for different groove widths
    emitToolChange(mainFresa);

    // Sort by nearest-neighbor
    const sortedUsOps: UsinagemOp[] = [];
    const remainUs = [...usinagemOps];
    let uCur = { x: pos.x, y: pos.y };
    while (remainUs.length > 0) {
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < remainUs.length; i++) {
        const d = Math.hypot(remainUs[i].px - uCur.x, remainUs[i].py - uCur.y);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const picked = remainUs.splice(bestIdx, 1)[0];
      sortedUsOps.push(picked);
      uCur = { x: picked.px, y: picked.py };
    }

    for (const { u, px, py, piece } of sortedUsOps) {
      const depthZ = Math.max(-(u.profundidade || layout.espessura), minAllowedZ);
      const label = piece.label || "?";

      if (u.tipo === "recorte_circular") {
        // Circular cutout — smooth circle with 64 segments for proper rendering
        const r = (u.largura || 0) / 2;
        const start = validateAndClamp(px, py, zSafe, segments.length, `Pos. recorte circular Ø${u.largura}mm peça ${label}`);
        addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(start.x, start.y, start.z);

        // Entry at edge of circle
        const entryX = px + r;
        const entry = validateAndClamp(entryX, py, zSafe, segments.length, `Entrada circular peça ${label}`);
        addSegment("rapid", pos, new THREE.Vector3(entry.x, entry.y, entry.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(entry.x, entry.y, entry.z);

        const plunge = validateAndClamp(entryX, py, depthZ, segments.length, `Mergulho circular peça ${label}`);
        addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

        // Trace circle in 64 segments for smooth rendering
        const numSeg = 64;
        for (let s = 1; s <= numSeg; s++) {
          const angle = (s / numSeg) * Math.PI * 2;
          const cx = px + r * Math.cos(angle);
          const cy = py + r * Math.sin(angle);
          const pt = validateAndClamp(cx, cy, depthZ, segments.length, `Circular seg.${s} peça ${label}`);
          addSegment("cut", pos, new THREE.Vector3(pt.x, pt.y, pt.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(pt.x, pt.y, pt.z);
        }

        addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(pos.x, pos.y, zSafe);

    } else if (u.tipo === "recorte_retangular") {
        // Rectangular cutout — trace full perimeter, clamped to piece bounds
        const w = u.comprimento || u.largura;
        const h = u.largura;
        // Clamp rectangle to piece boundaries so it never invades adjacent pieces
        const pieceX2 = piece.x + piece.width;
        const pieceY2 = piece.y + piece.height;
        const x1 = Math.max(px, piece.x), y1 = Math.max(py, piece.y);
        const x2 = Math.min(px + w, pieceX2), y2 = Math.min(py + h, pieceY2);

        const start = validateAndClamp(x1, y1, zSafe, segments.length, `Pos. recorte retangular peça ${label}`);
        addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(start.x, start.y, start.z);

        const plunge = validateAndClamp(x1, y1, depthZ, segments.length, `Entrada recorte retangular peça ${label}`);
        addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

        // Trace 4 sides
        const corners = [
          { x: x2, y: y1 }, // bottom-right
          { x: x2, y: y2 }, // top-right
          { x: x1, y: y2 }, // top-left
          { x: x1, y: y1 }, // back to start
        ];
        for (const corner of corners) {
          const pt = validateAndClamp(corner.x, corner.y, depthZ, segments.length, `Recorte retangular peça ${label}`);
          addSegment("cut", pos, new THREE.Vector3(pt.x, pt.y, pt.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(pt.x, pt.y, pt.z);
        }

        addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(pos.x, pos.y, zSafe);

      } else if (u.tipo === "rebaixo") {
        // Rebaixo (pocket) — rectangular area with partial depth, trace 4 sides
        const w = u.comprimento || u.largura;
        const h = u.largura;
        const pieceX2 = piece.x + piece.width;
        const pieceY2 = piece.y + piece.height;
        const x1 = Math.max(px, piece.x), y1 = Math.max(py, piece.y);
        const x2 = Math.min(px + w, pieceX2), y2 = Math.min(py + h, pieceY2);

        const start = validateAndClamp(x1, y1, zSafe, segments.length, `Pos. rebaixo peça ${label}`);
        addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(start.x, start.y, start.z);

        const plunge = validateAndClamp(x1, y1, depthZ, segments.length, `Entrada rebaixo peça ${label}`);
        addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

        const corners = [
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
          { x: x1, y: y1 },
        ];
        for (const corner of corners) {
          const pt = validateAndClamp(corner.x, corner.y, depthZ, segments.length, `Rebaixo peça ${label}`);
          addSegment("cut", pos, new THREE.Vector3(pt.x, pt.y, pt.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(pt.x, pt.y, pt.z);
        }

        addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(pos.x, pos.y, zSafe);

      } else {
        // Canal/groove — linear movement
        const gLen = u.comprimento || u.largura;
        const endX = px + gLen;
        const endY = py;

        const start = validateAndClamp(px, py, zSafe, segments.length, `Pos. ${u.tipo} peça ${label}`);
        addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(start.x, start.y, start.z);

        const plunge = validateAndClamp(px, py, depthZ, segments.length, `Entrada ${u.tipo} peça ${label}`);
        addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

        const end = validateAndClamp(endX, endY, depthZ, segments.length, `Corte ${u.tipo} peça ${label}`);
        addSegment("cut", pos, new THREE.Vector3(end.x, end.y, end.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(end.x, end.y, end.z);

        addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(pos.x, pos.y, zSafe);
      }
    }
  }

  // Switch to main cutting fresa for contours
  emitToolChange(mainFresa);

  // === COMMON CUT DETECTION ===
  const gap = 6;
  const { sharedEdges, skippableEdges } = useCommonCut
    ? detectSharedEdges(layout.pieces, gap, mainToolDiam)
    : { sharedEdges: [] as any[], skippableEdges: new Set<string>() };

  const offset = mainToolDiam / 2;

  // Build a unified list of "cut operations" with a center position for nearest-neighbor sorting
  interface CutOp {
    type: "contour" | "commoncut";
    centerX: number;
    centerY: number;
    // For contour ops
    piece?: PlacedNestingPiece;
    origIdx?: number;
    // For common cut ops
    edge?: typeof sharedEdges[0];
  }

  const cutOps: CutOp[] = [];

  // Add contour ops
  layout.pieces.forEach((piece, origIdx) => {
    cutOps.push({
      type: "contour",
      centerX: piece.x + piece.width / 2,
      centerY: piece.y + piece.height / 2,
      piece,
      origIdx,
    });
  });

  // Add common cut ops
  for (const edge of sharedEdges) {
    cutOps.push({
      type: "commoncut",
      centerX: (edge.cutStart.x + edge.cutEnd.x) / 2,
      centerY: (edge.cutStart.y + edge.cutEnd.y) / 2,
      edge,
    });
  }

  // Sort ALL cut operations by nearest-neighbor from current position
  const sortedOps: CutOp[] = [];
  const remainOps = [...cutOps];
  let curPos = { x: pos.x, y: pos.y };
  while (remainOps.length > 0) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < remainOps.length; i++) {
      const d = Math.hypot(remainOps[i].centerX - curPos.x, remainOps[i].centerY - curPos.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remainOps.splice(bestIdx, 1)[0];
    sortedOps.push(picked);
    if (picked.type === "contour" && picked.piece) {
      curPos = { x: picked.piece.x + picked.piece.width, y: picked.piece.y + picked.piece.height };
    } else if (picked.edge) {
      curPos = { x: picked.edge.cutEnd.x, y: picked.edge.cutEnd.y };
    }
  }

  // Execute sorted operations
  for (const op of sortedOps) {
    if (op.type === "contour" && op.piece && op.origIdx !== undefined) {
      const piece = op.piece;
      const origIdx = op.origIdx;
      const activeEdges = getRemainingContourSegments(piece, origIdx, sharedEdges, mainToolDiam);
      if (activeEdges.length === 0) continue;

      if (activeEdges.length === 4) {
        // Full contour with lead-in/contour/lead-out matching G-code generator
        const R = 3; // raio de contorno
        const OVERCUT = 2.0;
        const leadDistance = 50; // leadOutDistance

        // Contour rectangle (with tool compensation) — same as contour.ts
        const x1 = piece.x - offset;                          // left
        const x2 = piece.x + piece.width + offset;            // right
        const y1 = piece.y - offset;                          // bottom
        const y2 = piece.y + piece.height + offset;           // top

        // Contour start point: middle of top edge
        const contourStartX = (x1 + x2) / 2;
        const contourStartY = y2;

        // Lead-in point: OUTSIDE contour (above top edge)
        const leadInX = contourStartX;
        const leadInY = contourStartY + leadDistance;

        // 1. Rapid to lead-in point (OUTSIDE contour)
        const liStart = validateAndClamp(leadInX, leadInY, zSafe, segments.length, `Lead-in peça ${piece.label}`);
        addSegment("rapid", pos, new THREE.Vector3(liStart.x, liStart.y, liStart.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(liStart.x, liStart.y, liStart.z);

        // 2. Ramp descent at lead-in → contour start (diagonal ramp)
        const rampEnd = validateAndClamp(contourStartX, contourStartY, zCut, segments.length, `Rampa entrada peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(rampEnd.x, rampEnd.y, rampEnd.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(rampEnd.x, rampEnd.y, rampEnd.z);

        // 3. Complete closed-loop contour (top→right corner→down→bottom corner→left→top corner→up→close+overcut)
        // Top edge: contourStart → right corner
        const c1 = validateAndClamp(x2 - R, y2, zCut, segments.length, `Topo dir peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c1.x, c1.y, c1.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c1.x, c1.y, c1.z);
        // Right-top corner arc
        const c2 = validateAndClamp(x2, y2 - R, zCut, segments.length, `Canto sup-dir peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c2.x, c2.y, c2.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c2.x, c2.y, c2.z);
        // Right edge down
        const c3 = validateAndClamp(x2, y1 + R, zCut, segments.length, `Dir inf peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c3.x, c3.y, c3.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c3.x, c3.y, c3.z);
        // Right-bottom corner arc
        const c4 = validateAndClamp(x2 - R, y1, zCut, segments.length, `Canto inf-dir peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c4.x, c4.y, c4.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c4.x, c4.y, c4.z);
        // Bottom edge left
        const c5 = validateAndClamp(x1 + R, y1, zCut, segments.length, `Inf esq peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c5.x, c5.y, c5.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c5.x, c5.y, c5.z);
        // Left-bottom corner arc
        const c6 = validateAndClamp(x1, y1 + R, zCut, segments.length, `Canto inf-esq peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c6.x, c6.y, c6.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c6.x, c6.y, c6.z);
        // Left edge up
        const c7 = validateAndClamp(x1, y2 - R, zCut, segments.length, `Esq sup peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c7.x, c7.y, c7.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c7.x, c7.y, c7.z);
        // Left-top corner arc
        const c8 = validateAndClamp(x1 + R, y2, zCut, segments.length, `Canto sup-esq peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c8.x, c8.y, c8.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c8.x, c8.y, c8.z);
        // Close loop with overcut
        const closeX = contourStartX + OVERCUT;
        const c9 = validateAndClamp(closeX, y2, zCut, segments.length, `Fechamento peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(c9.x, c9.y, c9.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(c9.x, c9.y, c9.z);

        // 4. Lead-out: exit OUTSIDE contour
        const loEnd = validateAndClamp(leadInX, leadInY, zCut, segments.length, `Lead-out peça ${piece.label}`);
        addSegment("cut", pos, new THREE.Vector3(loEnd.x, loEnd.y, loEnd.z), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(loEnd.x, loEnd.y, loEnd.z);

        // 5. Retract to safe Z
        addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
        pos = new THREE.Vector3(pos.x, pos.y, zSafe);
      } else {
        // Partial contour — cut only the remaining edge stubs not covered by common cut
        for (const edge of activeEdges) {
          const start = validateAndClamp(edge.from.x, edge.from.y, zSafe, segments.length, `Pos. borda ${edge.side} peça ${piece.label}`);
          addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(start.x, start.y, start.z);

          const plunge = validateAndClamp(edge.from.x, edge.from.y, zCut, segments.length, `Entrada ${edge.side} peça ${piece.label}`);
          addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

          const end = validateAndClamp(edge.to.x, edge.to.y, zCut, segments.length, `Corte ${edge.side} peça ${piece.label}`);
          addSegment("cut", pos, new THREE.Vector3(end.x, end.y, end.z), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(end.x, end.y, end.z);

          addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
          pos = new THREE.Vector3(pos.x, pos.y, zSafe);
        }
      }

    } else if (op.type === "commoncut" && op.edge) {
      const edge = op.edge;
      const pA = layout.pieces[edge.pieceAIndex];
      const pB = layout.pieces[edge.pieceBIndex];
      const labelA = pA.label || String(edge.pieceAIndex + 1);
      const labelB = pB.label || String(edge.pieceBIndex + 1);

      const start = validateAndClamp(edge.cutStart.x, edge.cutStart.y, zSafe, segments.length, `CommonCut ${labelA}↔${labelB} pos.`);
      addSegment("rapid", pos, new THREE.Vector3(start.x, start.y, start.z), mainToolDiam, mainFresa.nome, mainFresa.position);
      pos = new THREE.Vector3(start.x, start.y, start.z);

      const plunge = validateAndClamp(edge.cutStart.x, edge.cutStart.y, zCut, segments.length, `CommonCut ${labelA}↔${labelB} entrada`);
      addSegment("cut", pos, new THREE.Vector3(plunge.x, plunge.y, plunge.z), mainToolDiam, mainFresa.nome, mainFresa.position);
      pos = new THREE.Vector3(plunge.x, plunge.y, plunge.z);

      const end = validateAndClamp(edge.cutEnd.x, edge.cutEnd.y, zCut, segments.length, `CommonCut ${labelA}↔${labelB} corte`);
      addSegment("cut", pos, new THREE.Vector3(end.x, end.y, end.z), mainToolDiam, mainFresa.nome, mainFresa.position);
      pos = new THREE.Vector3(end.x, end.y, end.z);

      addSegment("retract", pos, new THREE.Vector3(pos.x, pos.y, zSafe), mainToolDiam, mainFresa.nome, mainFresa.position);
      pos = new THREE.Vector3(pos.x, pos.y, zSafe);
    }
  }

  // Final safety pass — allow small negative offsets for edge contours (fresa offset)
  segments.forEach((seg) => {
    const minZ = -(layout.espessura + Math.abs(MAX_PENETRATION));
    if (seg.to.z < minZ) seg.to.z = minZ;
    // Allow fresa offset beyond sheet edges (up to -offset) for proper through-cuts
    const edgeMargin = mainToolDiam / 2 + 1;
    if (seg.to.x < -edgeMargin) seg.to.x = -edgeMargin;
    if (seg.to.y < -edgeMargin) seg.to.y = -edgeMargin;
    if (seg.to.x > layout.sheetWidth + edgeMargin) seg.to.x = layout.sheetWidth + edgeMargin;
    if (seg.to.y > layout.sheetHeight + edgeMargin) seg.to.y = layout.sheetHeight + edgeMargin;
  });

  return { segments, alerts, totalDistance, cutDistance, rapidDistance };
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
    const actionName = cameraAction.split("_")[0];
    const controls = controlsRef.current;
    const target = new THREE.Vector3(sheetW / 2, 0, sheetH / 2);
    
    if (actionName === "zoomIn") {
      camera.position.lerp(target, 0.2);
      camera.updateProjectionMatrix();
    } else if (actionName === "zoomOut") {
      const dir = camera.position.clone().sub(target).normalize();
      camera.position.add(dir.multiplyScalar(3));
      camera.updateProjectionMatrix();
    } else if (actionName === "fit") {
      camera.position.set(sheetW / 2, Math.max(sheetW, sheetH) * 0.8, sheetH / 2 + 0.1);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      if (controls.target) controls.target.copy(target);
    } else if (actionName === "home") {
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

// ============ 3D Simulation Scene (Heightmap-based like Aspire) ============

function SimulationScene3D({ segments, progress, layout, cameraAction }: { segments: ToolpathSegment[]; progress: number; layout: NestingSheet; cameraAction: string }) {
  const toolRef = useRef<THREE.Group>(null);
  const scale = 0.01;
  const totalSegments = segments.length;
  const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

  const sheetW = layout.sheetWidth * scale;
  const sheetH = layout.sheetHeight * scale;
  const thickness = layout.espessura * scale;

  // Canvas heightmap resolution (1px ≈ 2mm)
  const CS = 0.5;
  const cw = Math.ceil(layout.sheetWidth * CS);
  const ch = Math.ceil(layout.sheetHeight * CS);

  // Wood colors
  const WOOD_BASE = "#ddd0b8";
  const WOOD_DARK = "#a08868"; // partial depth (rebaixo/canal)
  const WOOD_CUT_BG = "#f0ece4"; // through-cut reveals lighter sacrifice table

  // Create canvas & texture synchronously via useMemo
  const { hmCanvas, hmTexture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d")!;

    // Draw wood grain base
    ctx.fillStyle = WOOD_BASE;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle wood grain lines
    ctx.strokeStyle = "rgba(160,130,90,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < ch; i += 3) {
      const wobble = Math.sin(i * 0.05) * 2;
      ctx.beginPath();
      ctx.moveTo(0, i + wobble);
      ctx.lineTo(cw, i + wobble + Math.sin(i * 0.02) * 3);
      ctx.stroke();
    }
    // Occasional darker grain bands
    ctx.strokeStyle = "rgba(140,110,70,0.06)";
    ctx.lineWidth = 3;
    for (let i = 0; i < ch; i += 12 + Math.random() * 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.bezierCurveTo(cw * 0.3, i + 2, cw * 0.7, i - 2, cw, i + 1);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { hmCanvas: c, hmTexture: tex };
  }, [cw, ch]);

  // Track last rendered segment for progressive painting
  const lastRenderedIdx = useRef(-1);

  // Progressive rendering of material removal onto the canvas
  useEffect(() => {
    const ctx = hmCanvas.getContext("2d")!;
    const esp = layout.espessura;

    // If progress went backwards (slider dragged back), repaint from scratch
    if (currentIdx < lastRenderedIdx.current) {
      ctx.fillStyle = WOOD_BASE;
      ctx.fillRect(0, 0, cw, ch);
      // Re-draw grain
      ctx.strokeStyle = "rgba(160,130,90,0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < ch; i += 3) {
        const wobble = Math.sin(i * 0.05) * 2;
        ctx.beginPath();
        ctx.moveTo(0, i + wobble);
        ctx.lineTo(cw, i + wobble + Math.sin(i * 0.02) * 3);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(140,110,70,0.06)";
      ctx.lineWidth = 3;
      for (let i = 0; i < ch; i += 12 + Math.random() * 8) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.bezierCurveTo(cw * 0.3, i + 2, cw * 0.7, i - 2, cw, i + 1);
        ctx.stroke();
      }
      lastRenderedIdx.current = -1;
    }

    for (let i = lastRenderedIdx.current + 1; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];

      if (seg.type === "cut") {
        const isThrough = Math.abs(seg.to.z) >= esp - 0.5;
        const toolR = Math.max(seg.toolDiam / 2 * CS, 0.8);

        // Edge shadow for depth effect
        ctx.strokeStyle = "rgba(60,40,20,0.35)";
        ctx.lineWidth = toolR * 2 + 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(seg.from.x * CS, seg.from.y * CS);
        ctx.lineTo(seg.to.x * CS, seg.to.y * CS);
        ctx.stroke();

        // Main cut
        ctx.strokeStyle = isThrough ? WOOD_CUT_BG : WOOD_DARK;
        ctx.lineWidth = toolR * 2;
        ctx.beginPath();
        ctx.moveTo(seg.from.x * CS, seg.from.y * CS);
        ctx.lineTo(seg.to.x * CS, seg.to.y * CS);
        ctx.stroke();

        // Inner highlight for through-cuts (lighter center)
        if (isThrough) {
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = Math.max(toolR * 1.2, 1);
          ctx.beginPath();
          ctx.moveTo(seg.from.x * CS, seg.from.y * CS);
          ctx.lineTo(seg.to.x * CS, seg.to.y * CS);
          ctx.stroke();
        }
      }

      if (seg.type === "drill") {
        const r = Math.max(seg.toolDiam / 2 * CS, 1);
        const isThrough = Math.abs(seg.to.z) >= esp - 0.5;

        // Shadow ring
        ctx.fillStyle = "rgba(60,40,20,0.35)";
        ctx.beginPath();
        ctx.arc(seg.to.x * CS, seg.to.y * CS, r + 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Hole
        ctx.fillStyle = isThrough ? WOOD_CUT_BG : WOOD_DARK;
        ctx.beginPath();
        ctx.arc(seg.to.x * CS, seg.to.y * CS, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        if (isThrough) {
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.beginPath();
          ctx.arc(seg.to.x * CS, seg.to.y * CS, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    lastRenderedIdx.current = currentIdx;
    hmTexture.needsUpdate = true;
  }, [currentIdx, segments, layout.espessura, cw, ch, hmCanvas, hmTexture]);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => { hmTexture.dispose(); };
  }, [hmTexture]);

  // Tool position
  let toolPos = new THREE.Vector3(0, 50 * scale, 0);
  if (segments.length > 0 && currentIdx >= 0) {
    const seg = segments[currentIdx];
    const frac = Math.min((progress * totalSegments) - currentIdx, 1);
    const fromS = new THREE.Vector3(seg.from.x * scale, seg.from.z * scale, seg.from.y * scale);
    const toS = new THREE.Vector3(seg.to.x * scale, seg.to.z * scale, seg.to.y * scale);
    toolPos = fromS.clone().lerp(toS, frac);
  }

  const currentSeg = currentIdx >= 0 && currentIdx < segments.length ? segments[currentIdx] : null;
  const isCutting = currentSeg && (currentSeg.type === "cut" || currentSeg.type === "drill");

  // Trail lines
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
    if (toolRef.current) toolRef.current.position.copy(toolPos);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[sheetW / 2 + 15, 12, sheetH / 2 + 15]} fov={45} />
      <CameraControls sheetW={sheetW} sheetH={sheetH} cameraAction={cameraAction} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 15]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      <hemisphereLight args={["#ddeeff", "#c0b090", 0.3]} />

      {/* Mesa de sacrifício (white background under sheet) */}
      <mesh position={[sheetW / 2, -thickness - 0.01, sheetH / 2]} receiveShadow>
        <boxGeometry args={[sheetW + 2, 0.02, sheetH + 2]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.9} />
      </mesh>

      {/* Sheet body (sides visible when viewing from angle) */}
      <mesh position={[sheetW / 2, -thickness / 2, sheetH / 2]} castShadow receiveShadow>
        <boxGeometry args={[sheetW, thickness, sheetH]} />
        <meshStandardMaterial color={WOOD_BASE} roughness={0.45} metalness={0.02} />
      </mesh>

      {/* Sheet top surface — canvas heightmap texture */}
      <mesh position={[sheetW / 2, 0.002, sheetH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sheetW, sheetH]} />
        <meshStandardMaterial
          map={hmTexture}
          roughness={0.35}
          metalness={0.02}
        />
      </mesh>

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
          <lineBasicMaterial color="#00cc44" linewidth={1} transparent opacity={0.7} />
        </lineSegments>
      )}

      {/* Rapid trail (red) */}
      {rapidTrailPoints.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[rapidTrailPoints, 3]} count={rapidTrailPoints.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial color="#ff3333" linewidth={1} transparent opacity={0.3} />
        </lineSegments>
      )}

      {/* Grid */}
      <gridHelper args={[40, 40, "#cccccc", "#dddddd"]} position={[sheetW / 2, -thickness - 0.02, sheetH / 2]} />
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
    if (e.button === 0 || e.button === 1) { // left or middle button
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

    const espessura = layout.espessura;
    const totalSegments = segments.length;
    const currentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

    // Clear to white background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Sheet background (MDF tone)
    const sheetColor = "#e8dcc8";
    const sheetDarker = "#c4b49a"; // partial depth (rebaixo/canal)
    ctx.fillStyle = sheetColor;
    ctx.fillRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, layout.sheetWidth * sc, layout.sheetHeight * sc);

    // ===== PASS 1: Draw material removal effects (before trails) =====
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];

      if (seg.type === "cut") {
        const isThrough = Math.abs(seg.to.z) >= espessura - 0.5;
        const toolR = Math.max(seg.toolDiam / 2 * sc, 1);

        if (isThrough) {
          // Through-cut: white background shows through (material fully removed)
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = toolR * 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
          ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
          ctx.stroke();
          // Dark edge along cut
          ctx.strokeStyle = "rgba(80,60,40,0.5)";
          ctx.lineWidth = Math.max(toolR * 2 + 2, 3);
          ctx.beginPath();
          ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
          ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
          ctx.stroke();
          // White center again (over the edge)
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = Math.max(toolR * 2 - 1, 1.5);
          ctx.beginPath();
          ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
          ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
          ctx.stroke();
        } else {
          // Partial depth (canal de LED, rebaixo): darker shade of sheet
          ctx.strokeStyle = sheetDarker;
          ctx.lineWidth = toolR * 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
          ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
          ctx.stroke();
        }
      }

      if (seg.type === "drill") {
        const r = Math.max(seg.toolDiam / 2 * sc, 2);
        const isThrough = Math.abs(seg.to.z) >= espessura - 0.5;

        if (isThrough) {
          // Through-hole: white circle (material removed)
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ox + seg.to.x * sc, oy + seg.to.y * sc, r, 0, Math.PI * 2);
          ctx.fill();
          // Dark rim
          ctx.strokeStyle = "rgba(80,60,40,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ox + seg.to.x * sc, oy + seg.to.y * sc, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Partial hole (shelf hole, hinge): darker shade
          ctx.fillStyle = sheetDarker;
          ctx.beginPath();
          ctx.arc(ox + seg.to.x * sc, oy + seg.to.y * sc, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(100,80,60,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ox + seg.to.x * sc, oy + seg.to.y * sc, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // ===== PASS 2: Draw movement trails =====
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= currentIdx && i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "rapid" || seg.type === "retract") {
        ctx.strokeStyle = "rgba(255,50,50,0.45)";
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = "rgba(0,180,60,0.6)";
        ctx.setLineDash([]);
      }
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(ox + seg.from.x * sc, oy + seg.from.y * sc);
      ctx.lineTo(ox + seg.to.x * sc, oy + seg.to.y * sc);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ===== PASS 3: Tool position =====
    if (currentIdx >= 0 && currentIdx < segments.length) {
      const seg = segments[currentIdx];
      const frac = Math.min((progress * totalSegments) - currentIdx, 1);
      const tx = seg.from.x + (seg.to.x - seg.from.x) * frac;
      const ty = seg.from.y + (seg.to.y - seg.from.y) * frac;
      const isCut = seg.type === "cut" || seg.type === "drill";
      const toolR = Math.max(seg.toolDiam / 2 * sc, 3);

      // Tool footprint circle
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = isCut ? "#00cc44" : "#ff3333";
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, toolR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Tool center dot
      ctx.fillStyle = isCut ? "#00cc44" : "#ff3333";
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isCut ? "#00aa33" : "#cc0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + tx * sc, oy + ty * sc, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ===== Legend =====
    const ly = oy + layout.sheetHeight * sc + 16;
    ctx.font = "11px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText(`${layout.sheetWidth} × ${layout.sheetHeight} mm · ${layout.material} · ${layout.espessura}mm`, ox + 4, ly);

    // Legend icons
    const lx = ox + layout.sheetWidth * sc;
    ctx.fillStyle = "#ff3333"; ctx.fillRect(lx - 260, ly - 10, 10, 10);
    ctx.fillStyle = "#666"; ctx.fillText("Rápido (vazio)", lx - 245, ly);

    ctx.fillStyle = "#00cc44"; ctx.fillRect(lx - 150, ly - 10, 10, 10);
    ctx.fillStyle = "#666"; ctx.fillText("Corte", lx - 135, ly);

    ctx.fillStyle = "#ffffff"; ctx.fillRect(lx - 90, ly - 10, 10, 10);
    ctx.strokeStyle = "#999"; ctx.lineWidth = 1; ctx.strokeRect(lx - 90, ly - 10, 10, 10);
    ctx.fillStyle = "#666"; ctx.fillText("Passante", lx - 75, ly);

    ctx.fillStyle = sheetDarker; ctx.fillRect(lx - 15, ly - 10, 10, 10);
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

  const { segments, alerts, totalDistance, cutDistance, rapidDistance } = useMemo(() =>
    layout ? generateToolpath(layout, limits, false) : { segments: [], alerts: [], totalDistance: 0, cutDistance: 0, rapidDistance: 0 },
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
                  <SimulationScene3D segments={segments} progress={progress} layout={layout} cameraAction={cameraAction} />
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
            <SimToolButton icon={Home} label="Resetar Vista" onClick={() => { reset(); triggerCameraAction("home"); }} />
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
            <SimToolButton icon={ZoomIn} label="Zoom +" onClick={() => triggerCameraAction("zoomIn")} />
            <SimToolButton icon={ZoomOut} label="Zoom -" onClick={() => triggerCameraAction("zoomOut")} />
            <SimToolButton icon={Maximize2} label="Zoom Fit" onClick={() => triggerCameraAction("fit")} />
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

          <div className="flex gap-3 text-[9px] text-muted-foreground items-center">
            <span>{segments.length} mov.</span>
            <span>Rápido: {(rapidDistance / 1000).toFixed(1)}m</span>
            <span>Corte: {(cutDistance / 1000).toFixed(1)}m</span>
            <span className={alerts.length > 0 ? "text-yellow-600 font-bold" : "text-green-600"}>
              {alerts.length > 0 ? `⚠ ${alerts.length} corrigidos` : "✓ OK"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
