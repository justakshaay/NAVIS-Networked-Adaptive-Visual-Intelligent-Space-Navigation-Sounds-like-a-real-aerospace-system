import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Camera, Eye, Radio, Compass, AlertOctagon, Wind, Layers, Maximize2 } from 'lucide-react';
import { SimulationFullState, SatelliteState, RoverState, SwarmRoverState } from '../types/simulation';
import { HazardPalette, HazardType } from './HazardPalette';

interface Mars3DViewProps {
  state: SimulationFullState | null;
  onInjectHazard?: (x: number, y: number, radius?: number, type?: string) => void;
  onSetTarget?: (x: number, y: number) => void;
  lastCommand?: string;
  isHazardModeActive?: boolean;
  selectedHazardType?: HazardType;
  onSelectHazardType?: (type: HazardType) => void;
  onClearHazards?: () => void;
  onCancelHazardMode?: () => void;
}

// ==========================================
// Heightmap & Terrain Surface Component
// ==========================================
interface TerrainMeshProps {
  terrainSummary: SimulationFullState['terrain_summary'];
  terrainPreset: 'procedural' | 'jezero_crater';
  terrainVersion: number;
  getElevation: (x: number, y: number) => number;
  isHazardModeActive?: boolean;
  onTerrainClick?: (wx: number, wz: number) => void;
}

const MartianTerrain: React.FC<TerrainMeshProps> = ({
  terrainSummary,
  terrainPreset,
  terrainVersion,
  getElevation,
  isHazardModeActive = false,
  onTerrainClick,
}) => {
  const width = terrainSummary?.width_m || 600;
  const height = terrainSummary?.height_m || 600;
  const grid = terrainSummary?.elevation_grid;

  const { geometry, wireGeometry } = useMemo(() => {
    const res = grid && grid.length > 2 ? grid.length : 30;
    const geom = new THREE.PlaneGeometry(width, height, res - 1, res - 1);
    geom.rotateX(-Math.PI / 2); // Orient horizontal in X-Z plane

    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Distinct color ramps per terrain preset
    const isJezero = terrainPreset === 'jezero_crater';
    const colorLow = new THREE.Color(isJezero ? '#10171D' : '#140E0C');
    const colorMid = new THREE.Color(isJezero ? '#332219' : '#281B16');
    const colorHigh = new THREE.Color(isJezero ? '#6B3B24' : '#4E2E22');
    const tempColor = new THREE.Color();

    let minElev = 9999;
    let maxElev = -9999;

    for (let i = 0; i < pos.count; i++) {
      // Plane is centered around (0, 0), map to world (0..width, 0..height)
      const wx = pos.getX(i) + width / 2;
      const wz = pos.getZ(i) + height / 2;
      const elev = getElevation(wx, wz);
      pos.setY(i, elev);

      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }

    const elevRange = Math.max(1, maxElev - minElev);

    for (let i = 0; i < pos.count; i++) {
      const elev = pos.getY(i);
      const norm = (elev - minElev) / elevRange;

      if (norm < 0.4) {
        tempColor.copy(colorLow).lerp(colorMid, norm / 0.4);
      } else {
        tempColor.copy(colorMid).lerp(colorHigh, (norm - 0.4) / 0.6);
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const wire = geom.clone();

    return { geometry: geom, wireGeometry: wire };
  }, [width, height, terrainPreset, terrainVersion, grid?.length]);

  const boundaryBox = useMemo(() => new THREE.BoxGeometry(width, 1, height), [width, height]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      wireGeometry.dispose();
    };
  }, [geometry, wireGeometry]);

  useEffect(() => {
    return () => {
      boundaryBox.dispose();
    };
  }, [boundaryBox]);

  return (
    <group position={[width / 2, 0, height / 2]}>
      {/* Matte Martian Regolith Surface */}
      <mesh
        geometry={geometry}
        receiveShadow
        onClick={(e) => {
          if (!onTerrainClick || e.delta > 5) return;
          e.stopPropagation();
          const wx = Math.max(10, Math.min(width - 10, e.point.x));
          const wz = Math.max(10, Math.min(height - 10, e.point.z));
          onTerrainClick(wx, wz);
        }}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.92}
          metalness={0.08}
          flatShading={false}
        />
      </mesh>

      {/* Subtle Topographic Wireframe Overlay */}
      <mesh geometry={wireGeometry} position={[0, 0.15, 0]}>
        <meshBasicMaterial
          color="#3A251C"
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>

      {/* Perimeter Hairline Boundary Frame */}
      <lineSegments position={[0, 0.2, 0]}>
        <edgesGeometry args={[boundaryBox]} />
        <lineBasicMaterial color="#21262D" />
      </lineSegments>
    </group>
  );
};

// ==========================================
// 3D Rover Model Component
// ==========================================
interface Rover3DProps {
  x: number;
  y: number;
  heading: number;
  elevation: number;
  color: string;
  callsign: string;
  role: string;
  uncertainty: number;
  speed: number;
  isGhost?: boolean;
  assignedSatellite?: string | null;
  hideLabel?: boolean;
}

const Rover3D: React.FC<Rover3DProps> = ({
  x,
  y,
  heading,
  elevation,
  color,
  callsign,
  role,
  uncertainty,
  speed,
  isGhost = false,
  assignedSatellite,
  hideLabel = false,
}) => {
  const meshRef = useRef<THREE.Group>(null);

  // Position: x -> X, elevation -> Y, y -> Z
  // Heading: in NAVIS, 0 rad is +X, math.atan2(vy, vx). In Three.js X-Z plane, forward is -heading.
  const angle = -heading + Math.PI / 2;

  return (
    <group position={[x, elevation + 1.2, y]} rotation={[0, angle, 0]} ref={meshRef}>
      {/* Rover Main Chassis */}
      <mesh castShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[4.2, 1.8, 6.0]} />
        <meshStandardMaterial
          color={isGhost ? '#F85149' : '#161B22'}
          roughness={0.4}
          metalness={0.6}
          transparent={isGhost}
          opacity={isGhost ? 0.45 : 1.0}
          wireframe={isGhost}
        />
      </mesh>

      {/* Solar Panel Deck (Top) */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[4.8, 0.2, 6.4]} />
        <meshStandardMaterial
          color="#0F172A"
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Directional Sensor Mast */}
      <mesh position={[0, 2.8, 2.0]}>
        <cylinderGeometry args={[0.15, 0.2, 2.0, 8]} />
        <meshStandardMaterial color="#30363D" metalness={0.8} />
      </mesh>
      {/* Stereo Camera Head */}
      <mesh position={[0, 3.8, 2.0]}>
        <boxGeometry args={[1.2, 0.5, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Status Mast Light */}
      <mesh position={[0, 4.2, 2.0]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial color={isGhost ? '#F85149' : color} />
      </mesh>

      {/* 6 Rocker-Bogie Wheels */}
      {[-2.4, 2.4].map((wx, i) =>
        [-2.0, 0, 2.0].map((wz, j) => (
          <mesh
            key={`${i}-${j}`}
            position={[wx, 0, wz]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.7, 0.7, 0.8, 12]} />
            <meshStandardMaterial color="#080A0D" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* 3D Floating Tactical Label (hidden in Chase Cam so it never covers the rover) */}
      {!hideLabel && (
        <Html
          position={[0, 7.5, 0]}
          center
          distanceFactor={220}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none select-none font-mono text-[10px] text-center whitespace-nowrap bg-[#0C0C0E]/90 backdrop-blur-md border border-[#222226] rounded px-2 py-0.5">
            <div className="font-semibold flex items-center justify-center gap-1" style={{ color }}>
              <span>{callsign.toUpperCase()}</span>
              <span className="text-[8px] text-[#71717A]">[{role.toUpperCase()}]</span>
            </div>
            <div className="text-[8px] text-[#A1A1AA] tabular-nums">
              ±{uncertainty.toFixed(1)}m | {speed.toFixed(1)}m/s
              {assignedSatellite && (
                <span className="ml-1 text-emerald-400">({assignedSatellite})</span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// ==========================================
// 3D Orbital Satellite & RF Beam Component
// ==========================================
interface Satellite3DProps {
  sat: SatelliteState;
  targetPos: [number, number, number];
  isContended?: boolean;
}

const Satellite3D: React.FC<Satellite3DProps> = ({ sat, targetPos }) => {
  // Map ground track gx, gy into 3D space with scaled orbital altitude
  const orbitHeight = 190 + (sat.altitude_km - 250) * 0.45;
  const satX = sat.gx;
  const satZ = sat.gy;

  const beamColor = useMemo(() => {
    if (sat.is_outage) return '#F85149';
    if (sat.current_task === 'PNT') return '#58A6FF';
    if (sat.current_task === 'IMAGING') return '#BC8CFF';
    if (sat.current_task === 'COMMUNICATION') return '#2EA043';
    return '#8B949E';
  }, [sat.is_outage, sat.current_task]);

  const hasBeam = sat.is_visible && sat.current_task !== 'IDLE';

  return (
    <group>
      {/* Satellite Body & Solar Panels */}
      <group position={[satX, orbitHeight, satZ]}>
        {/* Main Equipment Bus */}
        <mesh>
          <boxGeometry args={[4.5, 3.0, 3.0]} />
          <meshStandardMaterial
            color="#D1D5DB"
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>

        {/* Solar Panel Array Wings (Left & Right) */}
        <mesh position={[-5.5, 0, 0]}>
          <boxGeometry args={[6.5, 0.2, 3.2]} />
          <meshStandardMaterial
            color="#1E3A8A"
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[5.5, 0, 0]}>
          <boxGeometry args={[6.5, 0.2, 3.2]} />
          <meshStandardMaterial
            color="#1E3A8A"
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>

        {/* Antenna Feed Horn pointing nadir (downward) */}
        <mesh position={[0, -1.8, 0]}>
          <coneGeometry args={[1.0, 1.2, 12]} />
          <meshStandardMaterial color={beamColor} />
        </mesh>

        {/* Orbiting Satellite Identifier Tag */}
        <Html
          position={[0, 4.0, 0]}
          center
          distanceFactor={320}
          zIndexRange={[20, 0]}
        >
          <div className="pointer-events-none select-none font-mono text-[9px] text-center bg-[#0F1217]/95 border border-[#21262D] rounded-[2px] px-1.5 py-0.5 whitespace-nowrap shadow-panel">
            <div className="font-bold text-[#E6EDF3]">{sat.sat_id}</div>
            <div
              className="text-[8px] font-semibold"
              style={{ color: beamColor }}
            >
              {sat.is_outage ? 'OUTAGE' : sat.is_visible ? sat.current_task : 'ORBIT PASS'}
            </div>
            {sat.target_rover_id && sat.is_visible && (
              <div className="text-[7px] text-[#8B949E]">
                → {sat.target_rover_id}
              </div>
            )}
          </div>
        </Html>
      </group>

      {/* Downward Ground Footprint Target Disc */}
      {sat.is_visible && (
        <mesh position={[satX, 0.3, satZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sat.fov_radius_m * 0.96, sat.fov_radius_m, 48]} />
          <meshBasicMaterial
            color={beamColor}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Live Glowing Optical / RF Communication Beam */}
      {hasBeam && (
        <Line
          points={[
            [satX, orbitHeight - 1.5, satZ],
            targetPos,
          ]}
          color={beamColor}
          lineWidth={sat.current_task === 'PNT' ? 2.0 : 1.5}
          dashed={sat.current_task === 'COMMUNICATION'}
          dashScale={12}
          dashSize={4}
          gapSize={2}
          transparent
          opacity={0.75}
        />
      )}

      {/* Outage Warning Beam */}
      {sat.is_outage && (
        <Line
          points={[
            [satX, orbitHeight - 1.5, satZ],
            targetPos,
          ]}
          color="#F85149"
          lineWidth={1}
          dashed
          dashScale={10}
          dashSize={3}
          gapSize={3}
          transparent
          opacity={0.4}
        />
      )}
    </group>
  );
};

// ==========================================
// Main 3D Interactive Scene Container
// ==========================================
export const Mars3DView: React.FC<Mars3DViewProps> = ({
  state,
  onInjectHazard,
  onSetTarget,
  lastCommand = 'Standby',
  isHazardModeActive = false,
  selectedHazardType = 'ROCK_FIELD',
  onSelectHazardType,
  onClearHazards,
  onCancelHazardMode,
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [cameraMode, setCameraMode] = useState<'ORBITAL' | 'FOLLOW' | 'TOP_DOWN'>('ORBITAL');

  const width = state?.terrain_summary.width_m || 600;
  const height = state?.terrain_summary.height_m || 600;
  const terrainPreset = state?.terrain_preset || state?.terrain_summary?.preset || 'procedural';
  const terrainVersion = state?.terrain_summary?.terrain_version ?? 1;
  const elevationGridRef = useRef<number[][] | undefined>(state?.terrain_summary?.elevation_grid);
  elevationGridRef.current = state?.terrain_summary?.elevation_grid;

  // Bilinear Elevation Sampler Function (stable across 20Hz ticks; refreshes on preset/version change)
  const getElevation = useMemo(() => {
    const grid = elevationGridRef.current;
    if (!grid || grid.length < 2) {
      return (_x: number, _z: number) => 0.0;
    }
    const rows = grid.length;
    const cols = grid[0].length;

    return (x: number, z: number): number => {
      const currentGrid = elevationGridRef.current || grid;
      const u = Math.max(0, Math.min(1, x / width)) * (cols - 1);
      const v = Math.max(0, Math.min(1, z / height)) * (rows - 1);

      const x0 = Math.floor(u);
      const x1 = Math.min(cols - 1, x0 + 1);
      const z0 = Math.floor(v);
      const z1 = Math.min(rows - 1, z0 + 1);

      const fx = u - x0;
      const fz = v - z0;

      const h00 = currentGrid[z0][x0];
      const h10 = currentGrid[z0][x1];
      const h01 = currentGrid[z1][x0];
      const h11 = currentGrid[z1][x1];

      const top = h00 * (1 - fx) + h10 * fx;
      const bottom = h01 * (1 - fx) + h11 * fx;
      return top * (1 - fz) + bottom * fz;
    };
  }, [terrainPreset, terrainVersion, width, height, state?.terrain_summary?.elevation_grid?.length]);

  // Lead Rover Coordinates for Camera & RF Beams
  const leadRoverPos: [number, number, number] = useMemo(() => {
    if (!state?.rover) return [300, 5, 300];
    const rx = state.rover.x ?? 300;
    const rz = state.rover.y ?? 300;
    return [rx, getElevation(rx, rz) + 1.2, rz];
  }, [state?.rover?.x, state?.rover?.y, getElevation]);

  // Camera preset handler
  const setPreset = (mode: 'ORBITAL' | 'FOLLOW' | 'TOP_DOWN') => {
    setCameraMode(mode);
    const controls = controlsRef.current;
    if (!controls) return;

    if (mode === 'ORBITAL') {
      controls.target.set(width / 2, 10, height / 2);
      controls.object.position.set(width / 2, 420, height * 1.2);
    } else if (mode === 'TOP_DOWN') {
      controls.target.set(width / 2, 0, height / 2);
      controls.object.position.set(width / 2, 720, height / 2 + 1);
    } else if (mode === 'FOLLOW') {
      const heading = state?.rover?.heading_rad || 0;
      // Aim slightly ahead & above the rover so the rover sits cleanly in the lower-center third
      controls.target.set(
        leadRoverPos[0] + Math.cos(heading) * 16,
        leadRoverPos[1] + 6,
        leadRoverPos[2] + Math.sin(heading) * 16
      );
      controls.object.position.set(
        leadRoverPos[0] - Math.cos(heading) * 65,
        leadRoverPos[1] + 34,
        leadRoverPos[2] - Math.sin(heading) * 65
      );
    }
  };

  // Follow camera tick
  const CameraFollowController: React.FC = () => {
    useFrame(() => {
      if (cameraMode === 'FOLLOW' && controlsRef.current && state) {
        const controls = controlsRef.current;
        const heading = state?.rover?.heading_rad || 0;
        controls.target.lerp(
          new THREE.Vector3(
            leadRoverPos[0] + Math.cos(heading) * 16,
            leadRoverPos[1] + 6,
            leadRoverPos[2] + Math.sin(heading) * 16
          ),
          0.08
        );
      }
    });
    return null;
  };

  // Trajectory Lines for primary rover
  const breadcrumbPoints: [number, number, number][] = useMemo(() => {
    const hist = state?.routes?.breadcrumb_history || [];
    if (hist.length < 2) return [];
    return hist.map((p) => [p.x, getElevation(p.x, p.y) + 0.4, p.y]);
  }, [state?.routes?.breadcrumb_history, getElevation]);

  const plannedRoutePoints: [number, number, number][] = useMemo(() => {
    const pts = state?.routes?.current_planned || [];
    if (pts.length < 2) return [];
    return pts.map((p) => [p[0], getElevation(p[0], p[1]) + 0.3, p[1]]);
  }, [state?.routes?.current_planned, getElevation]);

  const mlPredictionPoints: [number, number, number][] = useMemo(() => {
    const pts = state?.trajectory_prediction?.predicted_trajectory || [];
    if (pts.length < 2) return [];
    return pts.map((p) => [p.x, getElevation(p.x, p.y) + 0.5, p.y]);
  }, [state?.trajectory_prediction?.predicted_trajectory, getElevation]);

  // Target rover position lookup for satellites
  const getRoverPosForSat = (sat: SatelliteState): [number, number, number] => {
    if (state?.swarm_mode_enabled && state.swarm_rovers && sat.target_rover_id) {
      const tr = state.swarm_rovers.find((r) => r.rover_id === sat.target_rover_id);
      if (tr) {
        return [tr.true_pos[0], getElevation(tr.true_pos[0], tr.true_pos[1]) + 1.2, tr.true_pos[1]];
      }
    }
    return leadRoverPos;
  };

  return (
    <div
      className={`w-full h-full relative bg-[#09090B] overflow-hidden select-none font-mono ${
        isHazardModeActive ? 'cursor-crosshair' : 'cursor-default'
      }`}
    >
      {/* 3D Canvas Viewport */}
      <Canvas
        camera={{ position: [width / 2, 420, height * 1.2], fov: 45, near: 1, far: 4000 }}
        shadows
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#080A0D']} />

        {/* Aerospace Deep Space Ambient & Directional Sun Lighting */}
        <ambientLight intensity={0.65} color="#1E232B" />
        <directionalLight
          position={[450, 360, 180]}
          intensity={1.3}
          color="#FFE9D8"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={10}
          shadow-camera-far={1200}
          shadow-camera-left={-width}
          shadow-camera-right={width}
          shadow-camera-top={height}
          shadow-camera-bottom={-height}
        />
        <directionalLight position={[-200, 150, -200]} intensity={0.25} color="#3B82F6" />

        {/* Starfield */}
        <Stars radius={1200} depth={200} count={3500} factor={4} saturation={0} fade speed={0.5} />

        <CameraFollowController />

        {/* Orbit Controls with Damping */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={20}
          maxDistance={1800}
        />

        {/* 1. Martian Displaced Terrain Surface */}
        {state && (
          <MartianTerrain
            key={`${state.terrain_preset || 'procedural'}-${state.terrain_summary?.terrain_version ?? 1}`}
            terrainSummary={state.terrain_summary}
            terrainPreset={state.terrain_preset || 'procedural'}
            terrainVersion={state.terrain_summary?.terrain_version ?? 1}
            getElevation={getElevation}
            isHazardModeActive={isHazardModeActive}
            onTerrainClick={(wx, wz) => {
              if (isHazardModeActive) {
                onInjectHazard?.(wx, wz, undefined, selectedHazardType);
              } else {
                onSetTarget?.(wx, wz);
              }
            }}
          />
        )}

        {/* 2. Primary Rover (Mode C NAVIS) or Swarm Rovers */}
        {state?.rover && !state.swarm_mode_enabled && (
          <Rover3D
            x={state.rover.x ?? 50}
            y={state.rover.y ?? 50}
            heading={state.rover.heading_rad ?? 0}
            elevation={getElevation(state.rover.x ?? 50, state.rover.y ?? 50)}
            color="#58A6FF"
            callsign="NAVIS-01"
            role="Explorer"
            uncertainty={state.ekf?.uncertainty_m ?? 0.5}
            speed={state.rover.speed ?? 0}
            assignedSatellite={state.ai_scheduler?.selected_satellite ?? null}
            hideLabel={cameraMode === 'FOLLOW'}
          />
        )}

        {/* 3. Shadow Rover (Mode A Dead Reckoning) if Shadow Race Active */}
        {state?.shadow_race_enabled && state.shadow_rover && (
          <Rover3D
            x={state.shadow_rover.true_pos[0]}
            y={state.shadow_rover.true_pos[1]}
            heading={state.shadow_rover.heading}
            elevation={getElevation(state.shadow_rover.true_pos[0], state.shadow_rover.true_pos[1])}
            color="#F85149"
            callsign="SHADOW"
            role="Mode A DR"
            uncertainty={state.shadow_rover.localization_error}
            speed={state.shadow_rover.speed}
            isGhost
            hideLabel={cameraMode === 'FOLLOW'}
          />
        )}

        {/* 4. Swarm Rovers (Alpha, Beta, Gamma) if Swarm Active */}
        {state?.swarm_mode_enabled && state.swarm_rovers && (
          <>
            {state.swarm_rovers.map((sr) => (
              <Rover3D
                key={sr.rover_id}
                x={sr.true_pos[0]}
                y={sr.true_pos[1]}
                heading={sr.heading}
                elevation={getElevation(sr.true_pos[0], sr.true_pos[1])}
                color={sr.color}
                callsign={sr.callsign}
                role={sr.role}
                uncertainty={sr.uncertainty_m}
                speed={sr.speed}
                assignedSatellite={sr.assigned_satellite_id}
                hideLabel={cameraMode === 'FOLLOW'}
              />
            ))}
          </>
        )}

        {/* 5. Trajectory Lines & Paths */}
        {breadcrumbPoints.length > 1 && (
          <Line
            points={breadcrumbPoints}
            color="#58A6FF"
            lineWidth={2}
            transparent
            opacity={0.65}
          />
        )}

        {plannedRoutePoints.length > 1 && (
          <Line
            points={plannedRoutePoints}
            color="#58A6FF"
            lineWidth={1.5}
            dashed
            dashScale={8}
            dashSize={3}
            gapSize={2}
            transparent
            opacity={0.4}
          />
        )}

        {mlPredictionPoints.length > 1 && (
          <Line
            points={mlPredictionPoints}
            color="#D29922"
            lineWidth={2}
            transparent
            opacity={0.8}
          />
        )}

        {/* 6. Dynamic Injected Obstacles (ROCK_FIELD, CRATER, SAND_TRAP) */}
        {state?.terrain_summary?.injected_hazards?.map((hz, idx) => {
          const hzElev = getElevation(hz.x, hz.y);
          const hzType = hz.type || 'ROCK_FIELD';
          return (
            <group
              key={`${idx}-${hzType}-${Math.round(hz.x)}-${Math.round(hz.y)}`}
              position={[hz.x, hzElev, hz.y]}
            >
              {hzType === 'CRATER' ? (
                <>
                  {/* Dark sunken crater pit + raised outer rim torus */}
                  <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[hz.radius * 0.85, 32]} />
                    <meshStandardMaterial color="#09090B" roughness={0.95} />
                  </mesh>
                  <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[hz.radius * 0.88, 2.2, 10, 32]} />
                    <meshStandardMaterial color="#3F3F46" roughness={0.9} />
                  </mesh>
                  <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[hz.radius * 0.94, hz.radius, 32]} />
                    <meshBasicMaterial color="#F85149" transparent opacity={0.45} side={THREE.DoubleSide} />
                  </mesh>
                </>
              ) : hzType === 'SAND_TRAP' ? (
                <>
                  {/* Amber/ochre soft regolith dune patch */}
                  <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[hz.radius * 0.9, 32]} />
                    <meshStandardMaterial color="#B45309" transparent opacity={0.55} roughness={0.95} />
                  </mesh>
                  <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[hz.radius * 0.92, hz.radius, 32]} />
                    <meshBasicMaterial color="#F59E0B" transparent opacity={0.75} side={THREE.DoubleSide} />
                  </mesh>
                </>
              ) : (
                <>
                  {/* ROCK_FIELD boulder cluster */}
                  {[
                    [0, 3.2, 0, 0.36],
                    [hz.radius * 0.38, 2.2, hz.radius * 0.2, 0.24],
                    [-hz.radius * 0.35, 2.4, -hz.radius * 0.25, 0.26],
                    [-hz.radius * 0.2, 1.8, hz.radius * 0.38, 0.2],
                  ].map(([bx, by, bz, br], bIdx) => (
                    <mesh key={bIdx} position={[bx, by, bz]}>
                      <dodecahedronGeometry args={[hz.radius * br, 0]} />
                      <meshStandardMaterial color="#991B1B" roughness={0.85} />
                    </mesh>
                  ))}
                  <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[hz.radius * 0.9, hz.radius, 32]} />
                    <meshBasicMaterial color="#F85149" transparent opacity={0.65} side={THREE.DoubleSide} />
                  </mesh>
                </>
              )}
            </group>
          );
        })}

        {/* 7. Dynamic Moving Dust Storm Zone */}
        {state?.dust_storm?.active && (
          <group position={[state.dust_storm.x, 25, state.dust_storm.y]}>
            {/* Amber swirl dome */}
            <mesh>
              <sphereGeometry args={[state.dust_storm.radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial
                color="#D97706"
                transparent
                opacity={0.3}
                roughness={0.9}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[state.dust_storm.radius * 0.95, state.dust_storm.radius, 36]} />
              <meshBasicMaterial color="#F59E0B" transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* 8. Science Target Beacon */}
        {state?.terrain_summary?.target_pos && (
          <group position={[state.terrain_summary.target_pos[0], getElevation(state.terrain_summary.target_pos[0], state.terrain_summary.target_pos[1]), state.terrain_summary.target_pos[1]]}>
            <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[8, 12, 32]} />
              <meshBasicMaterial color="#2EA043" side={THREE.DoubleSide} />
            </mesh>
            {/* Target Laser Beacon beam pointing to sky */}
            <mesh position={[0, 100, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 200, 8]} />
              <meshBasicMaterial color="#2EA043" transparent opacity={0.4} />
            </mesh>
          </group>
        )}

        {/* 9. Orbital Constellation & RF Beams */}
        {state?.satellites?.map((sat) => (
          <Satellite3D
            key={sat.sat_id}
            sat={sat}
            targetPos={getRoverPosForSat(sat)}
          />
        ))}
      </Canvas>

      {/* Top-Left Minimal 3D Telemetry Readout */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2.5 px-3 py-1.5 bg-[#0C0C0E]/80 backdrop-blur-md border border-[#222226] rounded-md font-mono text-[11px] text-[#A1A1AA] pointer-events-none">
        <span className="text-[#F4F4F5] font-medium">
          {cameraMode === 'FOLLOW' ? 'Chase Cam' : cameraMode === 'TOP_DOWN' ? 'Nadir' : 'Orbital'}
        </span>
        <span className="text-[#222226]">·</span>
        <span>
          2σ <span className="text-[#F4F4F5] tabular-nums">±{(state?.ekf?.uncertainty_m ?? 0.5).toFixed(2)}m</span>
        </span>
        <span className="text-[#222226]">·</span>
        <span>
          <span className="text-[#F4F4F5] tabular-nums">{(state?.rover?.speed ?? 0).toFixed(1)}</span> m/s
        </span>
      </div>

      {/* Floating 3D Camera Controls Toolbar (Top-Right) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 bg-[#0C0C0E]/85 backdrop-blur-md border border-[#222226] rounded-md p-0.5 text-xs">
        <button
          onClick={() => setPreset('ORBITAL')}
          className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
            cameraMode === 'ORBITAL'
              ? 'bg-[#F4F4F5] text-[#09090B]'
              : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
          }`}
          title="High-angle 3D orbital view"
        >
          Orbital
        </button>
        <button
          onClick={() => setPreset('FOLLOW')}
          className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
            cameraMode === 'FOLLOW'
              ? 'bg-[#F4F4F5] text-[#09090B]'
              : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
          }`}
          title="Chase camera behind lead rover"
        >
          Chase Cam
        </button>
        <button
          onClick={() => setPreset('TOP_DOWN')}
          className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
            cameraMode === 'TOP_DOWN'
              ? 'bg-[#F4F4F5] text-[#09090B]'
              : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
          }`}
          title="Nadir 90-degree view"
        >
          Nadir
        </button>
      </div>

      {/* Active Hurdle Placement Palette */}
      {isHazardModeActive && onSelectHazardType && (
        <HazardPalette
          selectedType={selectedHazardType}
          onSelectType={onSelectHazardType}
          onClearAll={onClearHazards}
          onDone={onCancelHazardMode}
        />
      )}

      {/* Live Engine & Command Indicator (Bottom-Left above dock) */}
      <div className="absolute bottom-14 left-3 z-20 flex items-center gap-2 px-2.5 py-1 bg-[#0C0C0E]/80 backdrop-blur-md border border-[#222226] rounded-md font-mono text-[10px] text-[#A1A1AA] pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[#F4F4F5] font-medium">LIVE</span>
        <span className="text-[#222226]">·</span>
        <span>WS 20Hz</span>
        <span className="text-[#222226]">·</span>
        <span className="text-[#F4F4F5] truncate max-w-[210px]">{lastCommand}</span>
      </div>

      {/* Floating 3D Instructions Badge (Bottom-Right) */}
      <div className="absolute bottom-14 right-3 z-10 pointer-events-none hidden md:block">
        <div className="text-[10px] font-mono text-[#71717A] bg-[#0C0C0E]/80 border border-[#222226] px-2.5 py-1 rounded-md backdrop-blur-sm">
          <span>Click terrain to retask · Drag: Rotate · Scroll: Zoom</span>
        </div>
      </div>
    </div>
  );
};

export default Mars3DView;
