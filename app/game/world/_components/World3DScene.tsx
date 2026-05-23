/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

// The actual three.js scene. Loaded only on the client (see
// World3DClient → next/dynamic with ssr:false).
//
// Performance contract: every visible thing is an InstancedMesh so the
// renderer ships one draw call per "layer" (hex prisms, military
// buildings, food buildings, magic spires, hero banners, NPC pennants,
// extra-forces glow rings) regardless of tile count. Empirically this
// keeps a ~5K-tile world well above 60fps on a recent laptop.

import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// r3f v9 ships an empty catalogue — JSX primitives like <instancedMesh>,
// <cylinderGeometry>, etc. resolve only after the THREE namespace has
// been extended into it. Without this, the elements render as no-ops
// (no error, just an empty scene) which is exactly what happened
// during initial verification.
//
// The cast is because extend() expects a Catalogue (record of
// constructables) but `import * as THREE` also exposes non-constructable
// namespaces like THREE.AnimationUtils. r3f tolerates these at runtime;
// it's the types that are too strict.
extend(THREE as unknown as Parameters<typeof extend>[0]);
import type { Caste, LandType } from "@/lib/game/types";
import type { World3DTile } from "@/lib/game/world-snapshot-3d";
import {
  CASTE_COLOR_HEX,
  HEX_RADIUS,
  HEX_SPACING,
  UNOWNED_COLOR_HEX,
} from "./world-constants";

const SQRT3 = Math.sqrt(3);

interface World3DSceneProps {
  tiles: World3DTile[];
  onSelectTile: (tileId: string | null) => void;
  selectedTileId: string | null;
}

interface ComputedTile {
  tile: World3DTile;
  x: number;
  z: number;
  height: number;
  colorHex: number;
}

function axialToWorld(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_SPACING * HEX_RADIUS * SQRT3 * (q + r / 2),
    z: HEX_SPACING * HEX_RADIUS * 1.5 * r,
  };
}

function casteHex(caste: Caste | null): number {
  return caste ? CASTE_COLOR_HEX[caste] : UNOWNED_COLOR_HEX;
}

function heightForLevel(level: number): number {
  // Floor at 0.35 so even level-1 tiles read as a deliberate hex prism
  // rather than a near-flat sliver; tops out around 1.55 for level 10.
  return 0.35 + Math.min(10, Math.max(1, level)) * 0.12;
}

export function World3DScene({
  tiles,
  onSelectTile,
  selectedTileId,
}: World3DSceneProps) {
  const computed = useMemo<ComputedTile[]>(
    () =>
      tiles.map((tile) => {
        const { x, z } = axialToWorld(tile.q, tile.r);
        return {
          tile,
          x,
          z,
          height: heightForLevel(tile.level),
          colorHex: casteHex(tile.caste),
        };
      }),
    [tiles]
  );

  const framing = useMemo(() => {
    if (computed.length === 0) {
      return { centerX: 0, centerZ: 0, worldRadius: 30, viewRadius: 30 };
    }
    let sx = 0;
    let sz = 0;
    for (const c of computed) {
      sx += c.x;
      sz += c.z;
    }
    const centerX = sx / computed.length;
    const centerZ = sz / computed.length;
    let maxDist = 0;
    for (const c of computed) {
      const d = Math.hypot(c.x - centerX, c.z - centerZ);
      if (d > maxDist) maxDist = d;
    }
    // worldRadius is the true extent (for fog & far-plane sizing);
    // viewRadius is the initial camera framing distance — capped so a
    // 6K-tile world doesn't park the camera 200 units away where every
    // hex is a sub-pixel speck. Users can wheel out to see the rest.
    return {
      centerX,
      centerZ,
      worldRadius: Math.max(20, maxDist),
      viewRadius: Math.min(40, Math.max(20, maxDist)),
    };
  }, [computed]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [
          framing.centerX,
          framing.viewRadius * 0.9,
          framing.centerZ + framing.viewRadius * 1.1,
        ],
        fov: 55,
        near: 0.1,
        far: Math.max(500, framing.worldRadius * 8),
      }}
    >
      <color attach="background" args={["#0a0d12"]} />
      <fog
        attach="fog"
        args={["#0a0d12", framing.viewRadius * 1.5, framing.worldRadius * 4]}
      />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[
          framing.centerX + framing.viewRadius,
          framing.viewRadius * 2,
          framing.centerZ + framing.viewRadius * 0.5,
        ]}
        intensity={0.85}
      />
      <SceneContent
        computed={computed}
        framing={framing}
        onSelectTile={onSelectTile}
        selectedTileId={selectedTileId}
      />
    </Canvas>
  );
}

interface SceneContentProps {
  computed: ComputedTile[];
  framing: {
    centerX: number;
    centerZ: number;
    worldRadius: number;
    viewRadius: number;
  };
  onSelectTile: (tileId: string | null) => void;
  selectedTileId: string | null;
}

function SceneContent({
  computed,
  framing,
  onSelectTile,
  selectedTileId,
}: SceneContentProps) {
  const baseHexRef = useRef<THREE.InstancedMesh>(null);
  const militaryRef = useRef<THREE.InstancedMesh>(null);
  const foodRef = useRef<THREE.InstancedMesh>(null);
  const magicRef = useRef<THREE.InstancedMesh>(null);
  const heroBannerRef = useRef<THREE.InstancedMesh>(null);
  const npcPennantRef = useRef<THREE.InstancedMesh>(null);
  const glowRingRef = useRef<THREE.InstancedMesh>(null);

  // Subsets — each Instanced layer renders only the tiles that belong
  // in it, so e.g. the food-silo mesh allocates exactly N_food instances.
  const subsets = useMemo(() => {
    const byType: Record<LandType, ComputedTile[]> = {
      unrevealed: [],
      unassigned: [],
      military: [],
      food: [],
      magic: [],
    };
    const heroes: ComputedTile[] = [];
    const npcs: ComputedTile[] = [];
    const extras: ComputedTile[] = [];
    for (const c of computed) {
      byType[c.tile.type].push(c);
      if (c.tile.hasHero) heroes.push(c);
      if (c.tile.isNpc && c.tile.ownerId) npcs.push(c);
      if (c.tile.hasExtraForces) extras.push(c);
    }
    return { byType, heroes, npcs, extras };
  }, [computed]);

  // === Base hex prisms — one InstancedMesh for ALL tiles. ===
  useEffect(() => {
    const mesh = baseHexRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < computed.length; i++) {
      const c = computed[i];
      dummy.position.set(c.x, c.height / 2, c.z);
      dummy.scale.set(1, c.height, 1);
      // Pointy-top hex orientation: rotate the cylinder 30° around y so
      // its flat sides face neighbors (default cylinder has points at 0°
      // and 180°, which would put gaps between adjacent hexes).
      dummy.rotation.set(0, Math.PI / 6, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(c.colorHex);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [computed]);

  // === Buildings per land type ===
  useEffect(() => {
    setBuildingInstances(
      militaryRef.current,
      subsets.byType.military,
      "military"
    );
  }, [subsets.byType.military]);

  useEffect(() => {
    setBuildingInstances(foodRef.current, subsets.byType.food, "food");
  }, [subsets.byType.food]);

  useEffect(() => {
    setBuildingInstances(magicRef.current, subsets.byType.magic, "magic");
  }, [subsets.byType.magic]);

  // === Hero banners (tall thin pole + flag) ===
  useEffect(() => {
    const mesh = heroBannerRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < subsets.heroes.length; i++) {
      const c = subsets.heroes[i];
      dummy.position.set(c.x + 0.35, c.height + 0.8, c.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = subsets.heroes.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [subsets.heroes]);

  // === NPC pennants (small skull-tone marker) ===
  useEffect(() => {
    const mesh = npcPennantRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < subsets.npcs.length; i++) {
      const c = subsets.npcs[i];
      dummy.position.set(c.x - 0.35, c.height + 0.55, c.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = subsets.npcs.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [subsets.npcs]);

  // === Glow rings (extra forces) ===
  useEffect(() => {
    const mesh = glowRingRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < subsets.extras.length; i++) {
      const c = subsets.extras[i];
      dummy.position.set(c.x, 0.02, c.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(c.colorHex);
      mesh.setColorAt(i, color);
    }
    mesh.count = subsets.extras.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [subsets.extras]);

  // === Camera fly-to on selected tile ===
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof MapControls> | null>(
    null
  );
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!selectedTileId) return;
    const c = computed.find((x) => x.tile.tileId === selectedTileId);
    if (!c) return;
    // Stand about 6 units away and 4 above the target hex top, so the
    // tile is centered with a slight downward angle.
    targetLook.current = new THREE.Vector3(c.x, c.height, c.z);
    targetPos.current = new THREE.Vector3(c.x + 5, c.height + 4, c.z + 5);
  }, [selectedTileId, computed]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!targetPos.current || !targetLook.current || !controls) return;
    camera.position.lerp(targetPos.current, 0.08);
    // MapControls/OrbitControls expose a `.target` Vector3; type via
    // cast since drei's typing of the ref is the underlying class.
    const ctrl = controls as unknown as { target: THREE.Vector3; update(): void };
    ctrl.target.lerp(targetLook.current, 0.08);
    ctrl.update();
    if (
      camera.position.distanceTo(targetPos.current) < 0.1 &&
      ctrl.target.distanceTo(targetLook.current) < 0.1
    ) {
      targetPos.current = null;
      targetLook.current = null;
    }
  });

  // Tile pick — InstancedMesh exposes `instanceId` on the event.
  const handleClick = (e: { instanceId?: number; stopPropagation: () => void }) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (typeof id === "number" && computed[id]) {
      onSelectTile(computed[id].tile.tileId);
    }
  };

  // Geometry singletons. Defined inline below via JSX <…Geometry args=… />
  // refs and lookups; React/three will reuse them across renders.

  // Ground plane sized to comfortably cover the world plus the fog
  // distance, so the camera never sees the plane's edge from a low angle.
  const groundSize = framing.worldRadius * 8;

  return (
    <>
      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[framing.centerX, -0.01, framing.centerZ]}
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#0e1219" roughness={0.95} />
      </mesh>

      {/* Hex prisms — one instance per tile, click-pickable. */}
      <instancedMesh
        ref={baseHexRef}
        args={[undefined, undefined, computed.length]}
        onClick={handleClick}
        frustumCulled={false}
      >
        <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, 1, 6]} />
        <meshStandardMaterial roughness={0.85} metalness={0.05} />
      </instancedMesh>

      {/* Buildings per type */}
      <instancedMesh
        ref={militaryRef}
        args={[undefined, undefined, Math.max(1, subsets.byType.military.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.55, 0.5, 0.55]} />
        <meshStandardMaterial color="#7a4a26" roughness={0.9} />
      </instancedMesh>

      <instancedMesh
        ref={foodRef}
        args={[undefined, undefined, Math.max(1, subsets.byType.food.length)]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.3, 0.3, 0.6, 12]} />
        <meshStandardMaterial color="#3f8a3a" roughness={0.8} />
      </instancedMesh>

      <instancedMesh
        ref={magicRef}
        args={[undefined, undefined, Math.max(1, subsets.byType.magic.length)]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.3, 0.95, 8]} />
        <meshStandardMaterial
          color="#9b5cd6"
          emissive="#3a1860"
          emissiveIntensity={0.35}
          roughness={0.55}
        />
      </instancedMesh>

      {/* Hero banner — slim post + flag */}
      <instancedMesh
        ref={heroBannerRef}
        args={[undefined, undefined, Math.max(1, subsets.heroes.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.07, 0.8, 0.5]} />
        <meshStandardMaterial color="#f5d36a" roughness={0.6} />
      </instancedMesh>

      {/* NPC pennant — darker, smaller */}
      <instancedMesh
        ref={npcPennantRef}
        args={[undefined, undefined, Math.max(1, subsets.npcs.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.06, 0.45, 0.32]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </instancedMesh>

      {/* Extra forces — emissive ring at ground level under the tile. */}
      <instancedMesh
        ref={glowRingRef}
        args={[undefined, undefined, Math.max(1, subsets.extras.length)]}
        frustumCulled={false}
      >
        <ringGeometry args={[HEX_RADIUS * 0.95, HEX_RADIUS * 1.25, 6]} />
        <meshStandardMaterial
          emissiveIntensity={0.9}
          // emissive color is set per-instance from caste; base color
          // stays bright so unlit faces still register.
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      <MapControls
        ref={controlsRef}
        target={[framing.centerX, 0, framing.centerZ]}
        enableDamping
        dampingFactor={0.08}
        // MapControls is the same controller as OrbitControls but with
        // the mouse bindings swapped: LEFT-drag pans (travel around the
        // world, Google-Earth-style), RIGHT-drag rotates, scroll zooms.
        // That matches the "fly the realm" mental model — users expect
        // to move ACROSS the map, not orbit a fixed point.
        screenSpacePanning={false}
        // Keep the camera above the horizon — looking up from under the
        // ground breaks the illusion fast.
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={3}
        maxDistance={framing.worldRadius * 4}
      />
    </>
  );
}

// Shared writer for the simple per-tile-type building meshes. Each
// instance is positioned on top of its tile's hex prism with a small
// vertical lift so the building doesn't z-fight the prism's top face.
function setBuildingInstances(
  mesh: THREE.InstancedMesh | null,
  subset: ComputedTile[],
  type: LandType
): void {
  if (!mesh) return;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < subset.length; i++) {
    const c = subset[i];
    const top = c.height + buildingLift(type);
    dummy.position.set(c.x, top, c.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = subset.length;
  mesh.instanceMatrix.needsUpdate = true;
}

function buildingLift(type: LandType): number {
  switch (type) {
    case "military":
      return 0.25; // half the box height
    case "food":
      return 0.3; // half the cylinder height
    case "magic":
      return 0.475; // half the cone height
    default:
      return 0;
  }
}
