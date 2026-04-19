/**
 * Aspire / Vectric .tap and .nc parser.
 *
 * Reads a G-code file produced by Aspire (header "(TURBO_DNA_ASPIRE)" or any
 * standard G-code), extracts the cutting contour at the final cut depth, and
 * computes:
 *
 *   - bounding box (width × height)  → used as the piece's W × H
 *   - the polyline / arc segments of the contour
 *   - the list of "edges" (sides) by grouping consecutive collinear lines
 *     and contiguous arcs as a single side (per user spec)
 *   - the real travelled length of every side (sum of segments / arc length)
 *
 * This is intentionally a CONTOUR-FOCUSED parser: we only need the outer cut
 * pass for budgeting purposes — drilling and pockets are ignored.
 */

export interface AspireSide {
  /** 1-based index for display (Lado 1, Lado 2, …) */
  index: number;
  /** Length in mm — sum of line segments + arc lengths in this side */
  lengthMm: number;
  /** "reto" if every segment of the side is straight, "curvo" if any arc */
  kind: "reto" | "curvo";
}

/** Contour segment in LOCAL piece coords (0..width × 0..height) */
export type AspireContourSeg =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "arc"; x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; cw: boolean };

export interface AspirePiece {
  /** Outer width in mm (X span of the contour) */
  width: number;
  /** Outer height in mm (Y span of the contour) */
  height: number;
  /** Total travelled length of the contour in mm */
  perimeter: number;
  /** Detected sides (edges) for edge-banding selection */
  sides: AspireSide[];
  /** Tool diameter detected from comments (best-effort), default 6 */
  toolDiameter: number;
  /** Z final cut depth (most negative Z reached on G1), for info only */
  zCutDepth: number;
  /** Outer contour segments in local piece coordinates (0..width × 0..height) */
  contour: AspireContourSeg[];
  /** Original machine X of the piece bounding box min (where the file's X=0 sits relative to the piece) */
  originMinX: number;
  /** Original machine Y of the piece bounding box min */
  originMinY: number;
  /** Original machine X of the bounding box max */
  originMaxX: number;
  /** Original machine Y of the bounding box max */
  originMaxY: number;
  /**
   * "contour" = peça com contorno fechado (lados/banding fazem sentido)
   * "frisos"  = múltiplas passagens únicas (frisos / cortes individuais).
   *             Não há lados — só conta o comprimento total × N usinagens.
   */
  mode: "contour" | "frisos";
  /** Quando mode = "frisos": número de passagens (usinagens) detectadas */
  frisoCount?: number;
  /** Quando mode = "frisos": comprimento médio de cada passagem em mm */
  frisoLengthMm?: number;
}

interface Pt { x: number; y: number }

interface LineSeg { kind: "line"; a: Pt; b: Pt }
interface ArcSeg  { kind: "arc";  a: Pt; b: Pt; cx: number; cy: number; cw: boolean }
type Seg = LineSeg | ArcSeg;

const TWO_PI = Math.PI * 2;

function dist(a: Pt, b: Pt) { return Math.hypot(b.x - a.x, b.y - a.y); }

/** Length of an arc going from a→b around (cx,cy), direction cw=true means G2 */
function arcLength(s: ArcSeg): number {
  const r = Math.hypot(s.a.x - s.cx, s.a.y - s.cy);
  let a1 = Math.atan2(s.a.y - s.cy, s.a.x - s.cx);
  let a2 = Math.atan2(s.b.y - s.cy, s.b.x - s.cx);
  let delta: number;
  if (s.cw) {
    // G2 = clockwise → angle decreases
    delta = a1 - a2;
  } else {
    // G3 = counter-clockwise → angle increases
    delta = a2 - a1;
  }
  if (delta <= 0) delta += TWO_PI;
  if (delta > TWO_PI) delta -= TWO_PI;
  return r * delta;
}

/** Tangent (unit vector) at the START of a segment */
function tangentStart(s: Seg): Pt {
  if (s.kind === "line") {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  }
  // For an arc, tangent at start point is perpendicular to radius vector.
  const rx = s.a.x - s.cx, ry = s.a.y - s.cy;
  // CCW (G3) tangent = (-ry, rx). CW (G2) tangent = (ry, -rx).
  const tx = s.cw ? ry : -ry;
  const ty = s.cw ? -rx : rx;
  const L = Math.hypot(tx, ty) || 1;
  return { x: tx / L, y: ty / L };
}

/** Tangent at END of a segment */
function tangentEnd(s: Seg): Pt {
  if (s.kind === "line") return tangentStart(s); // same direction
  const rx = s.b.x - s.cx, ry = s.b.y - s.cy;
  const tx = s.cw ? ry : -ry;
  const ty = s.cw ? -rx : rx;
  const L = Math.hypot(tx, ty) || 1;
  return { x: tx / L, y: ty / L };
}

function segLength(s: Seg): number {
  return s.kind === "line" ? dist(s.a, s.b) : arcLength(s);
}

/** Parse a G-code line, return motion if any */
interface Move {
  kind: "G0" | "G1" | "G2" | "G3";
  x?: number; y?: number; z?: number;
  i?: number; j?: number; r?: number;
}

function parseLine(line: string): Move | null {
  const clean = line.replace(/\([^)]*\)/g, "").trim();
  if (!clean || clean.startsWith("(") || clean.startsWith("%")) return null;
  // Detect motion code (use the first G we find on the line; modal handled by caller)
  const mMotion = clean.match(/G\s*0*([0-3])\b/i);
  let kind: Move["kind"] | undefined;
  if (mMotion) {
    switch (mMotion[1]) {
      case "0": kind = "G0"; break;
      case "1": kind = "G1"; break;
      case "2": kind = "G2"; break;
      case "3": kind = "G3"; break;
    }
  }
  const has = (axis: string) => {
    const re = new RegExp(`(?:^|\\s|G\\d+\\s*)${axis}(-?\\d*\\.?\\d+)`, "i");
    const m = clean.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };
  const x = has("X"), y = has("Y"), z = has("Z");
  const i = has("I"), j = has("J"), r = has("R");
  if (!kind && x === undefined && y === undefined && z === undefined) return null;
  return { kind: kind ?? ("G1" as const), x, y, z, i, j, r };
}

/**
 * Build the list of segments for the FINAL CUT pass only.
 * Heuristic for Aspire output:
 *   - The whole file usually contains a ramp-down (G1 with descending Z)
 *     followed by the contour cut at a constant Z (the most negative Z).
 *   - We keep G1/G2/G3 segments whose Z (current) equals the file's minimum Z
 *     within ±0.05 mm. That isolates the actual contour pass.
 */
export function parseAspireFile(text: string): AspirePiece {
  const lines = text.split(/\r?\n/);

  // Pass 1: scan all motions and find min Z reached on G1.
  let curX = 0, curY = 0, curZ = 0;
  let modal: Move["kind"] = "G0";
  let minZ = Infinity;
  const motions: Array<{ m: Move; from: Pt; to: Pt; z: number }> = [];
  for (const raw of lines) {
    const mv = parseLine(raw);
    if (!mv) continue;
    if (mv.kind) modal = mv.kind;
    const k = mv.kind ?? modal;
    const nx = mv.x !== undefined ? mv.x : curX;
    const ny = mv.y !== undefined ? mv.y : curY;
    const nz = mv.z !== undefined ? mv.z : curZ;
    motions.push({ m: { ...mv, kind: k }, from: { x: curX, y: curY }, to: { x: nx, y: ny }, z: nz });
    if (k === "G1" && mv.z !== undefined && mv.z < minZ) minZ = mv.z;
    if ((k === "G2" || k === "G3") && nz < minZ) minZ = nz;
    curX = nx; curY = ny; curZ = nz;
  }
  if (!isFinite(minZ)) minZ = 0;

  // Pass 2: keep only contour segments at the final depth, grouped into
  // PASSES (continuous paths broken by G0 rapids). Each pass = one
  // uninterrupted machining stroke. A "friso" file is one with many
  // separate single-stroke passes.
  const segs: Seg[] = [];
  const passes: Seg[][] = [];
  let curPass: Seg[] = [];
  const flushPass = () => {
    if (curPass.length > 0) {
      passes.push(curPass);
      curPass = [];
    }
  };
  const tol = 0.05; // mm
  for (const it of motions) {
    const k = it.m.kind!;
    if (k === "G0") {
      // rapid → break the current continuous pass
      flushPass();
      continue;
    }
    if (Math.abs(it.z - minZ) > tol) continue; // not the final cut layer
    if (it.from.x === it.to.x && it.from.y === it.to.y) continue; // pure Z move
    let seg: Seg | null = null;
    if (k === "G1") {
      seg = { kind: "line", a: it.from, b: it.to };
    } else {
      // Arc — need center
      let cx: number, cy: number;
      if (it.m.i !== undefined || it.m.j !== undefined) {
        cx = it.from.x + (it.m.i ?? 0);
        cy = it.from.y + (it.m.j ?? 0);
      } else if (it.m.r !== undefined) {
        const r = it.m.r;
        const mx = (it.from.x + it.to.x) / 2;
        const my = (it.from.y + it.to.y) / 2;
        const dx = it.to.x - it.from.x, dy = it.to.y - it.from.y;
        const d = Math.hypot(dx, dy);
        const h2 = Math.max(0, r * r - (d * d) / 4);
        const h = Math.sqrt(h2);
        const px = -dy / (d || 1), py = dx / (d || 1);
        const sign = (k === "G2") ? -1 : 1;
        cx = mx + sign * h * px;
        cy = my + sign * h * py;
      } else {
        continue;
      }
      seg = { kind: "arc", a: it.from, b: it.to, cx, cy, cw: k === "G2" };
    }
    if (seg) {
      segs.push(seg);
      curPass.push(seg);
    }
  }
  flushPass();

  // Compute bounding box from segments (sample arcs for accuracy).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (p: Pt) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const s of segs) {
    expand(s.a); expand(s.b);
    if (s.kind === "arc") {
      // sample every 5° to capture extremes
      const r = Math.hypot(s.a.x - s.cx, s.a.y - s.cy);
      const a1 = Math.atan2(s.a.y - s.cy, s.a.x - s.cx);
      const a2 = Math.atan2(s.b.y - s.cy, s.b.x - s.cx);
      let delta = s.cw ? a1 - a2 : a2 - a1;
      if (delta <= 0) delta += TWO_PI;
      const steps = Math.max(2, Math.ceil(delta / (Math.PI / 36)));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const ang = s.cw ? a1 - delta * t : a1 + delta * t;
        expand({ x: s.cx + r * Math.cos(ang), y: s.cy + r * Math.sin(ang) });
      }
    }
  }

  const width = isFinite(maxX) ? Math.round(maxX - minX) : 0;
  const height = isFinite(maxY) ? Math.round(maxY - minY) : 0;
  const perimeter = segs.reduce((a, s) => a + segLength(s), 0);

  // ---- Group segments into "sides" -----------------------------------------
  // Aspire / CNC contours are typically composed of:
  //   • long straight lines (real sides)
  //   • short fillet arcs (R≤ ~15mm) at corners — these are CORNERS, not sides
  //   • optional large-radius arcs (R > ~100mm) that ARE genuine curved sides
  //   • a small lead-in line + a final lead-out line at the start/end of the cut
  //
  // Strategy:
  //   1. Drop short lead-in / lead-out segments (length < ~25mm) at the very
  //      start and end of the contour — they are not sides.
  //   2. Walk the segments and accumulate them into the current side.
  //      A short corner arc is treated as a separator: it closes the current
  //      side AND starts a new one (and is itself NOT counted as a side).
  //      A long arc (large radius) IS a side ("curvo").
  //      A line that turns >25° relative to the previous direction also starts
  //      a new side.

  const SHORT_LEAD = 25;       // mm — lead-in / lead-out heuristic
  const FILLET_R_MAX = 15;     // mm — arcs ≤ this radius are corner fillets
  const TURN_THRESHOLD = (25 * Math.PI) / 180;

  // Trim lead-in/out at the boundaries (only short straight lines, not arcs).
  let i0 = 0, i1 = segs.length - 1;
  while (i0 <= i1 && segs[i0].kind === "line" && segLength(segs[i0]) < SHORT_LEAD) i0++;
  while (i1 >= i0 && segs[i1].kind === "line" && segLength(segs[i1]) < SHORT_LEAD) i1--;
  const work = segs.slice(i0, i1 + 1);

  const sides: AspireSide[] = [];
  let curLen = 0;
  let curHasArc = false;
  let prevEnd: Pt | null = null;

  const closeSide = () => {
    if (curLen <= 0.5) return; // ignore degenerate
    sides.push({
      index: sides.length + 1,
      lengthMm: Math.round(curLen * 10) / 10,
      kind: curHasArc ? "curvo" : "reto",
    });
    curLen = 0;
    curHasArc = false;
  };

  for (let i = 0; i < work.length; i++) {
    const s = work[i];
    const isFillet =
      s.kind === "arc" &&
      Math.hypot(s.a.x - s.cx, s.a.y - s.cy) <= FILLET_R_MAX;

    if (isFillet) {
      // Corner fillet: close any open side and skip this segment as a side.
      closeSide();
      prevEnd = tangentEnd(s);
      continue;
    }

    if (curLen === 0) {
      // first segment of a fresh side
      curLen = segLength(s);
      curHasArc = s.kind === "arc";
      prevEnd = tangentEnd(s);
      continue;
    }

    const startT = tangentStart(s);
    const dot = Math.max(-1, Math.min(1, prevEnd!.x * startT.x + prevEnd!.y * startT.y));
    const ang = Math.acos(dot);

    if (ang > TURN_THRESHOLD) {
      closeSide();
      curLen = segLength(s);
      curHasArc = s.kind === "arc";
    } else {
      curLen += segLength(s);
      if (s.kind === "arc") curHasArc = true;
    }
    prevEnd = tangentEnd(s);
  }
  closeSide();

  // Heuristic: detect tool diameter from "Descricao" comment like "Topo Raso (6 milimetros)"
  let toolDiameter = 6;
  const descMatch = text.match(/Descricao\s*:\s*[^()\n]*\(( \d+(?:\.\d+)?)/i);
  if (descMatch) toolDiameter = parseFloat(descMatch[1]);

  // ---- Detect "frisos" mode -----------------------------------------------
  // Frisos = many separate single-stroke passes (não há contorno fechado).
  // Heurística: para cada pass, removemos lead-in/lead-out (segmentos curtos
  // <50mm) e ficamos com o "corte útil". Se ≥3 passes resultam em uma única
  // linha reta de comprimento ≥ 100mm cada, é um arquivo de frisos.
  const usefulPasses: { length: number; isStraight: boolean }[] = passes.map(p => {
    // remover G1 muito curtos no início/fim (rampa de descida e lead-out)
    const minLen = 50;
    let i0 = 0, i1 = p.length - 1;
    while (i0 <= i1 && p[i0].kind === "line" && segLength(p[i0]) < minLen) i0++;
    while (i1 >= i0 && p[i1].kind === "line" && segLength(p[i1]) < minLen) i1--;
    const core = p.slice(i0, i1 + 1);
    const length = core.reduce((a, s) => a + segLength(s), 0);
    const isStraight = core.length >= 1 && core.every(s => s.kind === "line");
    return { length, isStraight };
  });
  const longPasses = usefulPasses.filter(p => p.length >= 100);
  const allStraight = longPasses.length > 0 && longPasses.every(p => p.isStraight);
  // Quando há ≥3 passes longos retos, e a soma dos comprimentos é
  // significativamente maior que o "perímetro" do bbox (passes paralelos),
  // tratamos como frisos.
  const isFrisos = allStraight && longPasses.length >= 3;

  let mode: "contour" | "frisos" = "contour";
  let frisoCount: number | undefined;
  let frisoLengthMm: number | undefined;
  let perimeterFinal = perimeter;
  let sidesFinal = sides;

  if (isFrisos) {
    mode = "frisos";
    frisoCount = longPasses.length;
    const totalLen = longPasses.reduce((a, p) => a + p.length, 0);
    frisoLengthMm = Math.round((totalLen / longPasses.length) * 10) / 10;
    perimeterFinal = Math.round(totalLen * 10) / 10;
    // Em modo frisos NÃO há "lados" para banding — uma linha por friso
    // (apenas para informação visual, não selecionável).
    sidesFinal = longPasses.map((p, i) => ({
      index: i + 1,
      lengthMm: Math.round(p.length * 10) / 10,
      kind: "reto" as const,
    }));
  }

  // Build local-coordinate contour (0..width × 0..height) for visualization.
  const ox = isFinite(minX) ? minX : 0;
  const oy = isFinite(minY) ? minY : 0;
  const contour: AspireContourSeg[] = segs.map(s =>
    s.kind === "line"
      ? { kind: "line", x1: s.a.x - ox, y1: s.a.y - oy, x2: s.b.x - ox, y2: s.b.y - oy }
      : { kind: "arc", x1: s.a.x - ox, y1: s.a.y - oy, x2: s.b.x - ox, y2: s.b.y - oy, cx: s.cx - ox, cy: s.cy - oy, cw: s.cw }
  );

  return {
    width,
    height,
    perimeter: Math.round(perimeterFinal * 10) / 10,
    sides: sidesFinal,
    toolDiameter,
    zCutDepth: minZ,
    contour,
    originMinX: isFinite(minX) ? minX : 0,
    originMinY: isFinite(minY) ? minY : 0,
    originMaxX: isFinite(maxX) ? maxX : 0,
    originMaxY: isFinite(maxY) ? maxY : 0,
    mode,
    frisoCount,
    frisoLengthMm,
  };
}
