import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COVE_NODES, seasonLook } from "@/lib/game/loop";
import { useGame } from "@/lib/game/store";

const HARBOR_POS: Record<string, [number, number, number]> = {
  garden: [-6.4, 0, -5.6],
  shed: [6.6, 0, -5.0],
  stoop: [-3.5, 0, -1.2],
  gull: [1.8, 0, -0.9],
  lanterns: [3.9, 0, 3.1],
  pier: [1.55, 0, 5.6],
  slip: [-6.2, 0, 4.9],
  lights: [0.15, 0, 1.35],
};

const _look = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _dummy = new THREE.Object3D();

type Mats = ReturnType<typeof makeMats>;
type BProps = {
  mats: Mats;
  restored: boolean;
  current: boolean;
  onPick: () => void;
};

function canvasTex(
  size: number,
  repeat: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function makeMats() {
  const std = (color: number, roughness = 0.82, metalness = 0.04, map?: THREE.Texture) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (map) mat.map = map;
    return mat;
  };
  const grassMap = canvasTex(128, 8, (ctx, s) => {
    ctx.fillStyle = "#4f8a3a";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = "rgb(" + (40 + (i % 24)) + "," + (90 + (i % 50)) + "," + (32 + (i % 16)) + ")";
      ctx.fillRect((i * 13) % s, (i * 29) % s, 2 + (i % 3), 2);
    }
  });
  const sandMap = canvasTex(128, 6, (ctx, s) => {
    ctx.fillStyle = "#d7b07a";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = i % 4 === 0 ? "#c49a62" : "#e4c392";
      ctx.fillRect((i * 11) % s, (i * 23) % s, 1 + (i % 2), 1);
    }
  });
  const woodMap = canvasTex(64, 3, (ctx, s) => {
    for (let y = 0; y < s; y++) {
      const tone = 118 + ((y * 3) % 28);
      ctx.fillStyle = "rgb(" + tone + "," + (tone - 38) + "," + (tone - 70) + ")";
      ctx.fillRect(0, y, s, 1);
    }
    ctx.fillStyle = "rgba(60,30,12,0.35)";
    for (let x = 8; x < s; x += 16) ctx.fillRect(x, 0, 1, s);
  });
  return {
    grass: std(0xffffff, 0.95, 0.02, grassMap),
    grassDry: std(0xc8c090, 0.95, 0.02, grassMap),
    sand: std(0xffffff, 0.92, 0.02, sandMap),
    dirt: std(0x7a6244, 0.9),
    wood: std(0xffffff, 0.84, 0.04, woodMap),
    woodPale: std(0xe0b070, 0.8, 0.04, woodMap),
    woodDark: std(0x5a3a22, 0.88),
    stone: std(0x8a8680, 0.86),
    stoneDark: std(0x5c5854, 0.9),
    teal: std(0x2f8f80, 0.62),
    tealWorn: std(0x5d6e68, 0.88),
    cream: std(0xe8d6b4, 0.74),
    creamWorn: std(0xb8aa90, 0.9),
    roof: std(0xc45a3c, 0.68),
    roofWorn: std(0x6a5348, 0.9),
    white: std(0xf4f1ea, 0.64),
    brick: std(0x9a5a42, 0.8),
    foliage: std(0x3f8a3c, 0.78),
    foliageDeep: std(0x2d6a30, 0.82),
    foliageDry: std(0x6a7048, 0.92),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xf0d7a0,
      emissive: 0xc48a22,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9fe4f0,
      emissive: 0x4eb3c4,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.18,
    }),
    cloth: std(0x1e9e90, 0.7),
    clothRed: std(0xb5523a, 0.7),
    hull: std(0xd8c4a0, 0.7),
    rock: std(0x7a746c, 0.95),
    path: std(0xb89a72, 0.9),
    cloud: new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 1 }),
    maps: [grassMap, sandMap, woodMap] as THREE.Texture[],
  };
}

function CameraRig({ target }: { target: [number, number, number] }) {
  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    _tgt.set(target[0] * 0.42, 0.55, target[2] * 0.38 + 0.45);
    _look.lerp(_tgt, 1 - Math.exp(-2.6 * d));
    const idle = Math.sin(t * 0.14) * 0.28;
    _pos.set(8.15 + idle + target[0] * 0.1, 5.85, 8.55 - idle * 0.2 + target[2] * 0.07);
    state.camera.position.lerp(_pos, 1 - Math.exp(-1.8 * d));
    state.camera.lookAt(_look);
  });
  return null;
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.position.y = -0.08 + Math.sin(state.clock.elapsedTime * 0.55) * 0.025;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.4, -0.22, 9.2]} receiveShadow>
        <planeGeometry args={[48, 32]} />
        <meshStandardMaterial color="#0f5a72" roughness={0.22} metalness={0.2} />
      </mesh>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[1.2, -0.08, 8.6]}>
        <planeGeometry args={[46, 30]} />
        <meshStandardMaterial color="#1c88a4" roughness={0.12} metalness={0.3} transparent opacity={0.86} />
      </mesh>
    </group>
  );
}

function Terrain({ mats, restoredBias }: { mats: Mats; restoredBias: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.2, 0, -3.4]} receiveShadow>
        <planeGeometry args={[22, 16]} />
        <primitive object={restoredBias > 0.45 ? mats.grass : mats.grassDry} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.01, 2.15]} receiveShadow>
        <planeGeometry args={[20, 6.4]} />
        <primitive object={mats.sand} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.4, 0.03, 4.2]} receiveShadow>
        <planeGeometry args={[4.2, 8]} />
        <primitive object={mats.path} attach="material" />
      </mesh>
    </group>
  );
}

function Pier({ mats, restored }: { mats: Mats; restored: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    let n = 0;
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 2; x++) {
        _dummy.position.set(1.05 + x * 1.08, 0.14, 1.05 + z * 0.7);
        _dummy.rotation.set(0, 0, restored ? 0 : x ? 0.04 : -0.03);
        _dummy.updateMatrix();
        inst.setMatrixAt(n++, _dummy.matrix);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [restored]);
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, 32]} castShadow receiveShadow>
        <boxGeometry args={[1.02, 0.12, 0.62]} />
        <meshStandardMaterial color={restored ? 0xc9955a : 0x7a6248} roughness={0.84} />
      </instancedMesh>
      {[0, 3, 6, 9, 12].map((z) =>
        [0.5, 2.55].map((x) => (
          <mesh key={x + "-" + z} position={[x, -0.55, 1.4 + z * 0.7]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 1.4, 6]} />
            <primitive object={mats.woodDark} attach="material" />
          </mesh>
        )),
      )}
    </group>
  );
}

function Roof({ w, d, y, mats, restored }: { w: number; d: number; y: number; mats: Mats; restored: boolean }) {
  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.78, 1.05, 4]} />
        <primitive object={restored ? mats.roof : mats.roofWorn} attach="material" />
      </mesh>
      <mesh position={[0, -0.42, 0]} castShadow>
        <boxGeometry args={[w + 0.18, 0.12, d + 0.18]} />
        <primitive object={restored ? mats.woodDark : mats.stoneDark} attach="material" />
      </mesh>
    </group>
  );
}

function Windows({ restored, mats, pts }: { restored: boolean; mats: Mats; pts: Array<[number, number, number]> }) {
  return (
    <>
      {pts.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <boxGeometry args={[0.36, 0.42, 0.05]} />
            <primitive object={mats.woodDark} attach="material" />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.26, 0.32, 0.04]} />
            <primitive object={restored ? mats.glass : mats.stoneDark} attach="material" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Marker({ current }: { current: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = 3.15 + Math.sin(state.clock.elapsedTime * 2.4) * 0.12;
    ref.current.scale.setScalar(current ? 1 : 0);
  });
  if (!current) return null;
  return (
    <mesh ref={ref} position={[0, 3.2, 0]}>
      <sphereGeometry args={[0.16, 10, 10]} />
      <meshBasicMaterial color="#2fbe62" />
    </mesh>
  );
}

function Clouds({ show }: { show: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = 2.15 + Math.sin(state.clock.elapsedTime * 1.15) * 0.12;
  });
  if (!show) return null;
  return (
    <group ref={ref} position={[0, 2.15, 0]}>
      {[
        [0, 0, 0, 0.72],
        [0.55, 0.08, 0.15, 0.55],
        [-0.52, 0.05, -0.1, 0.5],
        [0.15, 0.28, -0.35, 0.42],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color="#f7fbff" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Inn({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.stoop} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.24, 2.35]} />
        <primitive object={mats.stone} attach="material" />
      </mesh>
      <mesh position={[0, 1.25, 0]} rotation={[0, restored ? 0 : 0.06, restored ? 0 : 0.04]} castShadow>
        <boxGeometry args={[2.6, 2.3, 2.15]} />
        <primitive object={restored ? mats.teal : mats.tealWorn} attach="material" />
      </mesh>
      <Roof w={2.8} d={2.3} y={2.8} mats={mats} restored={restored} />
      <mesh position={[1.05, 2.65, -0.4]} castShadow>
        <boxGeometry args={[0.32, 0.7, 0.32]} />
        <primitive object={mats.brick} attach="material" />
      </mesh>
      <mesh position={[0, 0.42, 1.18]} castShadow>
        <boxGeometry args={[1.7, 0.12, 0.7]} />
        <primitive object={mats.woodPale} attach="material" />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.7, 1.28]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 6]} />
          <primitive object={mats.woodDark} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 1.05]}>
        <boxGeometry args={[0.42, 0.7, 0.08]} />
        <primitive object={mats.woodDark} attach="material" />
      </mesh>
      <Windows restored={restored} mats={mats} pts={[[-0.7, 1.45, 1.08], [0.7, 1.45, 1.08], [-0.7, 0.95, 1.08]]} />
      <mesh position={[1.45, 1.55, 0.2]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.35, 0.04]} />
        <primitive object={restored ? mats.cloth : mats.woodDark} attach="material" />
      </mesh>
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function Cafe({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.gull} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.3, 1.7, 1.9]} />
        <primitive object={restored ? mats.cream : mats.creamWorn} attach="material" />
      </mesh>
      <mesh position={[0, 1.78, 0.05]} rotation={[0, 0, restored ? 0 : 0.08]} castShadow>
        <boxGeometry args={[2.5, 0.18, 2.1]} />
        <primitive object={restored ? mats.teal : mats.woodDark} attach="material" />
      </mesh>
      <mesh position={[0, 1.35, 1.05]} castShadow>
        <boxGeometry args={[2.0, 0.08, 0.55]} />
        <primitive object={restored ? mats.cloth : mats.wood} attach="material" />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.7, 1.15]}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 6]} />
          <primitive object={mats.woodDark} attach="material" />
        </mesh>
      ))}
      <Windows restored={restored} mats={mats} pts={[[-0.62, 0.9, 0.96], [0.62, 0.9, 0.96]]} />
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0, 1.45]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.06, 10]} />
            <primitive object={mats.woodPale} attach="material" />
          </mesh>
          {restored ? (
            <mesh position={[0, 0.85, 0]}>
              <coneGeometry args={[0.45, 0.18, 8]} />
              <primitive object={x < 0 ? mats.cloth : mats.clothRed} attach="material" />
            </mesh>
          ) : null}
        </group>
      ))}
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function Garden({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.garden} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      {[[-0.9, 0.7], [0.9, 0.7], [-0.9, -0.6], [0.9, -0.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]} receiveShadow>
          <boxGeometry args={[1.35, 0.16, 0.95]} />
          <primitive object={restored ? mats.dirt : mats.stoneDark} attach="material" />
        </mesh>
      ))}
      {restored
        ? [[-0.9, 0.55, 0.7], [0.85, 0.5, 0.65], [-0.7, 0.45, -0.55], [0.95, 0.6, -0.5]].map((p, i) => (
            <mesh key={`b${i}`} position={p as [number, number, number]} castShadow>
              <sphereGeometry args={[0.32 + (i % 2) * 0.08, 10, 8]} />
              <primitive object={mats.foliage} attach="material" />
            </mesh>
          ))
        : null}
      <mesh position={[0, restored ? 0.85 : 0.35, -1.35]} castShadow>
        <boxGeometry args={[1.6, restored ? 1.4 : 0.5, 1.1]} />
        <primitive object={restored ? mats.glass : mats.woodDark} attach="material" />
      </mesh>
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function Shed({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.shed} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.85, 0]} rotation={[0, restored ? -0.2 : -0.12, 0]} castShadow>
        <boxGeometry args={[2.1, 1.7, 1.7]} />
        <primitive object={restored ? mats.wood : mats.woodDark} attach="material" />
      </mesh>
      <mesh position={[0, 1.85, 0]} rotation={[0, -0.2, restored ? 0 : 0.1]} castShadow>
        <boxGeometry args={[2.3, 0.16, 1.9]} />
        <primitive object={restored ? mats.woodPale : mats.stoneDark} attach="material" />
      </mesh>
      <mesh position={[0.95, 0.28, 0.9]} castShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.55, 8]} />
        <primitive object={mats.woodDark} attach="material" />
      </mesh>
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}function Slip({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.slip} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      {[[-0.7, 0.28, 0.2], [0.5, 0.22, -0.4], [0.1, 0.18, 0.8], [-0.2, 0.35, -0.7]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0.2, i, 0.1]} castShadow>
          <icosahedronGeometry args={[0.45 + (i % 3) * 0.12, 0]} />
          <primitive object={mats.rock} attach="material" />
        </mesh>
      ))}
      <mesh position={[0.2, restored ? 0.42 : 0.18, 0.15]} rotation={[0, 0.6, restored ? 0 : 0.35]} castShadow>
        <boxGeometry args={[1.6, 0.22, 0.55]} />
        <primitive object={mats.hull} attach="material" />
      </mesh>
      <mesh position={[0.55, restored ? 0.85 : 0.4, 0.15]} rotation={[0, 0.6, 0.4]}>
        <boxGeometry args={[0.04, 0.9, 0.55]} />
        <primitive object={restored ? mats.white : mats.stone} attach="material" />
      </mesh>
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function LanternRow({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.lanterns} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      {[-1.2, 0, 1.2].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 1.4, 6]} />
            <primitive object={mats.woodDark} attach="material" />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <primitive object={restored ? mats.lamp : mats.stone} attach="material" />
          </mesh>
        </group>
      ))}
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function Square({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.lights} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[1.6, 20]} />
        <primitive object={restored ? mats.stone : mats.dirt} attach="material" />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 0.5, 10]} />
        <primitive object={mats.stone} attach="material" />
      </mesh>
      {restored
        ? [-0.9, 0.9].map((x, i) => (
            <group key={i} position={[x, 0, 0.9]}>
              <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 1.4, 6]} />
                <primitive object={mats.wood} attach="material" />
              </mesh>
              <mesh position={[0.25, 1.2, 0]} rotation={[0, 0, 0.4]}>
                <boxGeometry args={[0.5, 0.28, 0.04]} />
                <primitive object={i ? mats.cloth : mats.roof} attach="material" />
              </mesh>
            </group>
          ))
        : null}
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function PierHouse({ mats, restored, current, onPick }: BProps) {
  return (
    <group position={HARBOR_POS.pier} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.6, 1.35, 1.35]} />
        <primitive object={restored ? mats.woodPale : mats.woodDark} attach="material" />
      </mesh>
      <Roof w={1.8} d={1.5} y={1.7} mats={mats} restored={restored} />
      {restored ? (
        <group position={[1.6, 0.28, 1.1]} rotation={[0, 0.4, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.8, 0.28, 0.7]} />
            <primitive object={mats.hull} attach="material" />
          </mesh>
          <mesh position={[0, 0.55, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.05, 1.1, 0.7]} />
            <primitive object={mats.white} attach="material" />
          </mesh>
        </group>
      ) : null}
      <Marker current={current} />
      <Clouds show={!restored} />
    </group>
  );
}

function Lighthouse({ mats, on }: { mats: Mats; on: boolean }) {
  const beam = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!beam.current) return;
    beam.current.rotation.y = state.clock.elapsedTime * 0.55;
    beam.current.visible = on;
  });
  return (
    <group position={[4.6, 0, 9.2]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.55, 3.2, 10]} />
        <primitive object={on ? mats.white : mats.stone} attach="material" />
      </mesh>
      <mesh position={[0, 3.4, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.45, 10]} />
        <primitive object={mats.teal} attach="material" />
      </mesh>
      <mesh position={[0, 3.85, 0]}>
        <coneGeometry args={[0.42, 0.55, 8]} />
        <primitive object={mats.roof} attach="material" />
      </mesh>
      <mesh position={[0, 3.45, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <primitive object={on ? mats.lamp : mats.stoneDark} attach="material" />
      </mesh>
      <mesh ref={beam} position={[0, 3.45, 0]}>
        <coneGeometry args={[0.15, 7.5, 8, 1, true]} />
        <meshBasicMaterial color="#f0d7a0" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Trees({ mats, lush }: { mats: Mats; lush: boolean }) {
  const spots: Array<[number, number, number]> = [
    [-8.2, 0, -3.2],
    [-7.1, 0, -6.4],
    [8.4, 0, -3.6],
    [7.6, 0, -6.8],
    [-4.8, 0, -7.2],
    [4.2, 0, -7.0],
  ];
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 0.9, 6]} />
            <primitive object={mats.woodDark} attach="material" />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <sphereGeometry args={[0.58 + (i % 3) * 0.08, 10, 8]} />
            <primitive object={lush ? mats.foliage : mats.foliageDry} attach="material" />
          </mesh>
          <mesh position={[0.28, 1.35, 0.1]} castShadow>
            <sphereGeometry args={[0.4, 8, 8]} />
            <primitive object={lush ? mats.foliageDeep : mats.foliageDry} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Gulls() {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const place = (g: THREE.Group | null, i: number) => {
      if (!g) return;
      const a = t * 0.38 + i * 2.15;
      g.position.set(Math.cos(a) * (7.5 + i), 4.4 + Math.sin(t * 1.5 + i) * 0.35, Math.sin(a) * (5.8 + i * 0.4) + 1);
      g.rotation.y = -a + Math.PI / 2;
    };
    place(g1.current, 0);
    place(g2.current, 1);
    place(g3.current, 2);
  });
  return (
    <group>
      {[g1, g2, g3].map((ref, i) => (
        <group key={i} ref={ref}>
          <mesh rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.55, 0.04, 0.12]} />
            <meshBasicMaterial color="#f4f1ea" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Walker() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    const a = (window as unknown as { __saltwharfAvatar?: { x: number; z: number; yaw: number } }).__saltwharfAvatar;
    if (!g || !a) return;
    g.position.set(a.x, 0, a.z);
    g.rotation.y = a.yaw;
    g.visible = true;
  });
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
        <meshStandardMaterial color="#e8d2b0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color="#c4a070" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.62, 0.14]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.42, 0.35, 0.18]} />
        <meshStandardMaterial color="#2f8f80" roughness={0.7} />
      </mesh>
    </group>
  );
}

type ExploreState = {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  orbitYaw: number;
  pitch: number;
  dist: number;
};

const _explore: ExploreState = {
  x: 0.2,
  z: 2.4,
  yaw: 0,
  vx: 0,
  vz: 0,
  orbitYaw: 0.72,
  pitch: 0.48,
  dist: 9.2,
};

function ExploreRig() {
  const keys = useRef(new Set<string>());
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const { gl, camera } = useThree();

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-ui]")) return;
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      _explore.orbitYaw -= dx * 0.0065;
      _explore.pitch = Math.max(0.18, Math.min(1.15, _explore.pitch + dy * 0.004));
    };
    const onUp = () => {
      dragging.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      _explore.dist = Math.max(5.5, Math.min(16, _explore.dist + e.deltaY * 0.01));
    };
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
    };
    const blur = () => keys.current.clear();
    const el = gl.domElement;
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    (window as unknown as { __controlsTest: { getYaw: () => number; getSpeed: () => number; setKeys: (codes: string[]) => void } }).__controlsTest = {
      getYaw: () => _explore.yaw,
      getSpeed: () => Math.hypot(_explore.vx, _explore.vz),
      setKeys: (codes) => {
        keys.current = new Set(codes);
      },
    };
    (window as unknown as { __saltwharfAvatar: ExploreState }).__saltwharfAvatar = _explore;
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const oy = _explore.orbitYaw;
    const forwardX = -Math.sin(oy);
    const forwardZ = -Math.cos(oy);
    const rightX = Math.cos(oy);
    const rightZ = -Math.sin(oy);
    let mx = 0;
    let mz = 0;
    const k = keys.current;
    if (k.has("KeyW") || k.has("ArrowUp")) {
      mx += forwardX;
      mz += forwardZ;
    }
    if (k.has("KeyS") || k.has("ArrowDown")) {
      mx -= forwardX;
      mz -= forwardZ;
    }
    if (k.has("KeyA") || k.has("ArrowLeft")) {
      mx -= rightX;
      mz -= rightZ;
    }
    if (k.has("KeyD") || k.has("ArrowRight")) {
      mx += rightX;
      mz += rightZ;
    }
    const stick = (window as unknown as { __saltwharfStick?: { x: number; y: number } }).__saltwharfStick;
    if (stick) {
      mx += stick.x * rightX - stick.y * forwardX;
      mz += stick.x * rightZ - stick.y * forwardZ;
    }
    const len = Math.hypot(mx, mz);
    const speed = 4.4;
    if (len > 0.08) {
      mx /= len;
      mz /= len;
      _explore.vx = mx * speed;
      _explore.vz = mz * speed;
      _explore.x = Math.max(-8.5, Math.min(8.5, _explore.x + _explore.vx * d));
      _explore.z = Math.max(-7.2, Math.min(8.5, _explore.z + _explore.vz * d));
      _explore.yaw = Math.atan2(-mx, -mz);
    } else {
      _explore.vx = 0;
      _explore.vz = 0;
    }
    const dist = _explore.dist;
    const px = _explore.x + Math.sin(_explore.orbitYaw) * dist;
    const pz = _explore.z + Math.cos(_explore.orbitYaw) * dist;
    const py = 1.4 + Math.sin(_explore.pitch) * dist * 0.85;
    camera.position.lerp(_pos.set(px, py, pz), 1 - Math.exp(-4.2 * d));
    camera.lookAt(_explore.x, 1.05, _explore.z);
  });
  return null;
}

function Pumpkins() {
  const spots: Array<[number, number, number]> = [
    [2.4, 0, 5.2],
    [-1.8, 0, 5.5],
    [-5.6, 0, -4.6],
    [5.1, 0, 3.4],
  ];
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.22 + (i % 2) * 0.04, 10, 8]} />
            <meshStandardMaterial color="#d45a18" roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.03, 0.035, 0.1, 5]} />
            <meshStandardMaterial color="#3d6a28" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({
  coveNode,
  focus,
  onFocus,
  explore,
}: {
  coveNode: number;
  focus: number;
  onFocus: (i: number) => void;
  explore?: boolean;
}) {
  const look = seasonLook();
  const mats = useMemo(() => {
    const m = makeMats();
    m.foliage.color.setHex(look.webFoliage);
    m.foliageDeep.color.setHex(look.webFoliageDeep);
    m.grass.color.setHex(look.webGrass);
    return m;
  }, [look.webFoliage, look.webFoliageDeep, look.webGrass]);
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        if (m && typeof (m as THREE.Material).dispose === "function") (m as THREE.Material).dispose();
      }
      for (const t of mats.maps) t.dispose();
    },
    [mats],
  );
  const restoredBias = coveNode / Math.max(1, COVE_NODES.length);
  const lit = coveNode >= COVE_NODES.length - 1;
  const idOf = (id: string) => COVE_NODES.findIndex((n) => n.id === id);
  const st = (id: string) => {
    const i = idOf(id);
    return {
      restored: i >= 0 && i < coveNode,
      current: i === coveNode || i === focus,
      onPick: () => onFocus(i < 0 ? 0 : i),
    };
  };
  const sky = look.webSky;

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, explore ? 28 : 16, explore ? 52 : 38]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#d5eef8", "#6a7a48", 0.5]} />
      <directionalLight
        position={[8.5, 13, 5.2]}
        intensity={1.7}
        color="#fff1d0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={36}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-bias={-0.0004}
      />
      {explore ? <ExploreRig /> : <CameraRig target={HARBOR_POS[COVE_NODES[focus]?.id ?? "lights"] ?? [0, 0, 0]} />}
      <Terrain mats={mats} restoredBias={restoredBias} />
      <Water />
      <Pier mats={mats} restored={st("pier").restored} />
      <Inn mats={mats} {...st("stoop")} />
      <Cafe mats={mats} {...st("gull")} />
      <Garden mats={mats} {...st("garden")} />
      <Shed mats={mats} {...st("shed")} />
      <Slip mats={mats} {...st("slip")} />
      <LanternRow mats={mats} {...st("lanterns")} />
      <Square mats={mats} {...st("lights")} />
      <PierHouse mats={mats} {...st("pier")} />
      <Lighthouse mats={mats} on={lit} />
      <Trees mats={mats} lush={restoredBias > 0.35} />
      {look.pumpkins ? <Pumpkins /> : null}
      <Gulls />
      {explore ? <Walker /> : null}
    </>
  );
}

function InvalidateOnProgress() {
  const invalidate = useThree((s) => s.invalidate);
  const coveNode = useGame((s) => s.coveNode);
  const cosmetics = useGame((s) => s.cosmetics);
  const dailyDay = useGame((s) => s.dailyDay);
  useEffect(() => {
    invalidate();
  }, [coveNode, cosmetics, dailyDay, invalidate]);
  return null;
}

export default function HarborCanvas({
  coveNode,
  focus,
  onFocus,
  explore = false,
}: {
  coveNode: number;
  focus: number;
  onFocus: (i: number) => void;
  explore?: boolean;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [8.2, 5.9, 8.6], fov: explore ? 42 : 36, near: 0.1, far: 80 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#7eb8c9");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        gl.shadowMap.enabled = true;
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
      }}
    >
      <Scene coveNode={coveNode} focus={focus} onFocus={onFocus} explore={explore} />
      <InvalidateOnProgress />
    </Canvas>
  );
           }
