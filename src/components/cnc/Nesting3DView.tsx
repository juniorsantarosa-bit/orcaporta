import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Text, Html } from "@react-three/drei";
import { NestingSheet, PlacedNestingPiece } from "@/types/promob";
import { useMemo, useState } from "react";
import * as THREE from "three";

interface Nesting3DViewProps {
  layout: NestingSheet;
  selectedPieceId: number | null;
}

function SheetMesh({ layout }: { layout: NestingSheet }) {
  const sheetThickness = 2;
  const scale = 0.01;

  return (
    <mesh position={[layout.sheetWidth * scale / 2, -sheetThickness * scale / 2, layout.sheetHeight * scale / 2]}>
      <boxGeometry args={[layout.sheetWidth * scale, sheetThickness * scale, layout.sheetHeight * scale]} />
      <meshStandardMaterial color="#e8e0d4" transparent opacity={0.35} />
    </mesh>
  );
}

function DrillHole3D({ x, y, diam, depth, pieceX, pieceY, espessura }: {
  x: number; y: number; diam: number; depth: number;
  pieceX: number; pieceY: number; espessura: number;
}) {
  const scale = 0.01;
  const r = Math.max(diam / 2, 1.5) * scale;
  const d = Math.min(depth, espessura) * scale;
  const cx = (pieceX + x) * scale;
  const cz = (pieceY + y) * scale;
  const cy = espessura * scale + 0.011;

  const color = diam >= 15 ? "#f59e0b" : diam >= 5 ? "#3b82f6" : "#ef4444";

  return (
    <group position={[cx, cy, cz]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, d, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* Ring at top */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, d / 2, 0]}>
        <torusGeometry args={[r, r * 0.15, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function PieceMesh({ piece, isSelected, espessura }: {
  piece: PlacedNestingPiece;
  isSelected: boolean;
  espessura: number;
}) {
  const [hovered, setHovered] = useState(false);
  const scale = 0.01;
  const thickness = espessura * scale;
  const yOffset = thickness / 2 + 0.01;

  const color = useMemo(() => {
    if (isSelected) return "#3b82f6";
    const hue = (piece.pieceId * 47) % 360;
    return `hsl(${hue}, 40%, 68%)`;
  }, [piece.pieceId, isSelected]);

  return (
    <group position={[
      (piece.x + piece.width / 2) * scale,
      yOffset,
      (piece.y + piece.height / 2) * scale
    ]}>
      {/* Main piece body */}
      <mesh
        castShadow receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[piece.width * scale, thickness, piece.height * scale]} />
        <meshStandardMaterial
          color={hovered ? "#60a5fa" : color}
          roughness={0.25}
          metalness={0.05}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {/* Edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(piece.width * scale, thickness, piece.height * scale)]} />
        <lineBasicMaterial color={isSelected ? "#60a5fa" : "#94a3b8"} linewidth={1} />
      </lineSegments>

      {/* Edge band indicators (colored strips on edges) */}
      {piece.bordaSup && (
        <mesh position={[0, thickness / 2 + 0.001, -piece.height * scale / 2 + 0.005]}>
          <boxGeometry args={[piece.width * scale, 0.002, 0.01]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      )}
      {piece.bordaInf && (
        <mesh position={[0, thickness / 2 + 0.001, piece.height * scale / 2 - 0.005]}>
          <boxGeometry args={[piece.width * scale, 0.002, 0.01]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      )}

      {/* Label floating above piece */}
      <Html
        position={[0, thickness / 2 + 0.08, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
          <span className="text-[8px] font-bold text-primary">{piece.label}</span>
          <span className="text-[7px] text-muted-foreground ml-1">{piece.descricao}</span>
          <span className="text-[6px] text-muted-foreground ml-1 font-mono">{piece.width}×{piece.height}</span>
        </div>
      </Html>
    </group>
  );
}

export function Nesting3DView({ layout, selectedPieceId }: Nesting3DViewProps) {
  const scale = 0.01;
  const centerX = layout.sheetWidth * scale / 2;
  const centerZ = layout.sheetHeight * scale / 2;

  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-gradient-to-b from-muted/30 to-muted/10">
      <Canvas shadows>
        <PerspectiveCamera
          makeDefault
          position={[centerX + 15, 12, centerZ + 15]}
          fov={45}
        />
        <OrbitControls
          target={[centerX, 0, centerZ]}
          enableDamping
          dampingFactor={0.1}
          minDistance={5}
          maxDistance={50}
        />

        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 10]} intensity={1} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-5, 8, -5]} intensity={0.3} />

        <gridHelper args={[40, 40, "#cbd5e1", "#e2e8f0"]} position={[centerX, -0.05, centerZ]} />

        <SheetMesh layout={layout} />

        {layout.pieces.map((piece) => (
          <group key={`${piece.pieceId}-${piece.x}-${piece.y}`}>
            <PieceMesh
              piece={piece}
              isSelected={piece.pieceId === selectedPieceId}
              espessura={layout.espessura}
            />
            {/* Drill holes */}
            {piece.furos?.map((hole, hi) => (
              <DrillHole3D
                key={hi}
                x={hole.X} y={hole.Y}
                diam={hole.DIAM} depth={hole.Z}
                pieceX={piece.x} pieceY={piece.y}
                espessura={layout.espessura}
              />
            ))}
          </group>
        ))}

        <ContactShadows position={[centerX, -0.04, centerZ]} opacity={0.25} scale={40} blur={2} />
        <Environment preset="studio" />
      </Canvas>
    </div>
  );
}
