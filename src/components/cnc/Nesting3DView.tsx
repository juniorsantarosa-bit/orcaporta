import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from "@react-three/drei";
import { SheetLayout } from "@/types/cutting";
import { useMemo } from "react";
import * as THREE from "three";

interface Nesting3DViewProps {
  layout: SheetLayout;
  selectedPieceId: number | null;
}

function SheetMesh({ layout }: { layout: SheetLayout }) {
  const sheetThickness = 2;
  const scale = 0.01; // mm to scene units

  return (
    <mesh position={[layout.sheetWidth * scale / 2, -sheetThickness * scale / 2, layout.sheetHeight * scale / 2]}>
      <boxGeometry args={[layout.sheetWidth * scale, sheetThickness * scale, layout.sheetHeight * scale]} />
      <meshStandardMaterial color="#e8e0d4" transparent opacity={0.4} />
    </mesh>
  );
}

function PieceMesh({ piece, isSelected, sheetHeight, espessura }: { 
  piece: SheetLayout["pieces"][0]; 
  isSelected: boolean; 
  sheetHeight: number;
  espessura: number;
}) {
  const scale = 0.01;
  const thickness = espessura * scale;
  const yOffset = thickness / 2 + 0.01;

  const color = useMemo(() => {
    if (isSelected) return "#3b82f6";
    const hue = (piece.pieceId * 47) % 360;
    return `hsl(${hue}, 45%, 65%)`;
  }, [piece.pieceId, isSelected]);

  return (
    <group position={[
      (piece.x + piece.width / 2) * scale,
      yOffset,
      (piece.y + piece.height / 2) * scale
    ]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[piece.width * scale, thickness, piece.height * scale]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.1}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.15 : 0}
        />
      </mesh>
      {/* Edge highlight */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(piece.width * scale, thickness, piece.height * scale)]} />
        <lineBasicMaterial color={isSelected ? "#60a5fa" : "#94a3b8"} linewidth={1} />
      </lineSegments>
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

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-5, 8, -5]} intensity={0.3} />

        {/* Ground grid */}
        <gridHelper
          args={[40, 40, "#cbd5e1", "#e2e8f0"]}
          position={[centerX, -0.05, centerZ]}
        />

        {/* Sheet base */}
        <SheetMesh layout={layout} />

        {/* Pieces */}
        {layout.pieces.map((piece) => (
          <PieceMesh
            key={`${piece.pieceId}-${piece.x}-${piece.y}`}
            piece={piece}
            isSelected={piece.pieceId === selectedPieceId}
            sheetHeight={layout.sheetHeight}
            espessura={15}
          />
        ))}

        {/* Contact shadows for realism */}
        <ContactShadows
          position={[centerX, -0.04, centerZ]}
          opacity={0.25}
          scale={40}
          blur={2}
        />

        <Environment preset="studio" />
      </Canvas>
    </div>
  );
}