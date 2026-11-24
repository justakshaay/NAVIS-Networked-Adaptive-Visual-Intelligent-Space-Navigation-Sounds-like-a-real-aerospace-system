import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  AlertOctagon,
  Navigation,
  Layers,
  ChevronDown,
  ChevronUp,
  Radio,
  Activity,
  Cpu,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SimulationFullState } from '../types/simulation';

interface MarsCanvasProps {
  state: SimulationFullState | null;
  onInjectHazard: (x: number, y: number, radius?: number, type?: string) => void;
  isHazardModeActive?: boolean;
  onCancelHazardMode?: () => void;
}

export const MarsCanvas: React.FC<MarsCanvasProps> = ({
  state,
  onInjectHazard,
  isHazardModeActive = false,
  onCancelHazardMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport Transform States (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [followRover, setFollowRover] = useState<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Layer Toggles
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [layerContours, setLayerContours] = useState<boolean>(true);
  const [layerEKF, setLayerEKF] = useState<boolean>(true);
  const [layerPrediction, setLayerPrediction] = useState<boolean>(true);
  const [layerSatellites, setLayerSatellites] = useState<boolean>(true);

  // ResizeObserver for clean dynamic resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Auto-follow rover if toggled
  useEffect(() => {
    if (followRover && state && canvasRef.current) {
      const widthM = state.terrain_summary.width_m || 600;
      const scale = (Math.min(canvasDimensions.width, canvasDimensions.height) / widthM) * zoom;

      const rx = state.rover.x * scale;
      const ry = state.rover.y * scale;

      setPan({
        x: canvasDimensions.width / 2 - rx,
        y: canvasDimensions.height / 2 - ry,
      });
    }
  }, [followRover, state?.rover.x, state?.rover.y, zoom, canvasDimensions]);

  const terrainPreset = state?.terrain_preset || state?.terrain_summary?.preset || 'procedural';
  const terrainVersion = state?.terrain_summary?.terrain_version ?? 1;
  const elevationGrid = state?.terrain_summary?.elevation_grid;

  // Cached offscreen terrain elevation & contour layer (invalidates on terrain_preset / terrain_version / layerContours)
  const terrainLayerCanvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const offscreen = document.createElement('canvas');
    const size = 300;
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    const isJezero = terrainPreset === 'jezero_crater';

    // Render elevation grid into smooth offscreen heatmap
    if (elevationGrid && elevationGrid.length > 1) {
      const rows = elevationGrid.length;
      const cols = elevationGrid[0].length;
      let minE = Infinity;
      let maxE = -Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = elevationGrid[r][c];
          if (v < minE) minE = v;
          if (v > maxE) maxE = v;
        }
      }
      const range = Math.max(1, maxE - minE);

      const small = document.createElement('canvas');
      small.width = cols;
      small.height = rows;
      const sctx = small.getContext('2d');
      if (sctx) {
        const img = sctx.createImageData(cols, rows);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const norm = Math.max(0, Math.min(1, (elevationGrid[r][c] - minE) / range));
            let red = 18;
            let green = 14;
            let blue = 13;
            if (isJezero) {
              // Jezero Crater: Deep slate-basalt lakebed -> amber-ochre delta -> rust-ochre crater rim
              if (norm < 0.35) {
                const t = norm / 0.35;
                red = Math.round(11 + t * 14);
                green = Math.round(16 + t * 14);
                blue = Math.round(22 + t * 10);
              } else if (norm < 0.68) {
                const t = (norm - 0.35) / 0.33;
                red = Math.round(25 + t * 38);
                green = Math.round(30 + t * 15);
                blue = Math.round(32 - t * 8);
              } else {
                const t = (norm - 0.68) / 0.32;
                red = Math.round(63 + t * 36);
                green = Math.round(45 + t * 16);
                blue = Math.round(24 + t * 10);
              }
            } else {
              // Procedural: Matte obsidian-rust basalt
              if (norm < 0.5) {
                const t = norm / 0.5;
                red = Math.round(14 + t * 18);
                green = Math.round(11 + t * 12);
                blue = Math.round(10 + t * 10);
              } else {
                const t = (norm - 0.5) / 0.5;
                red = Math.round(32 + t * 20);
                green = Math.round(23 + t * 11);
                blue = Math.round(20 + t * 8);
              }
            }
            const idx = (r * cols + c) * 4;
            img.data[idx] = red;
            img.data[idx + 1] = green;
            img.data[idx + 2] = blue;
            img.data[idx + 3] = 255;
          }
        }
        sctx.putImageData(img, 0, 0);
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(small, 0, 0, size, size);
      }
    } else {
      octx.fillStyle = isJezero ? '#10161C' : '#120E0D';
      octx.fillRect(0, 0, size, size);
    }

    // Distinct Topographic Contours per preset
    if (layerContours) {
      const scalePt = size / 600;
      if (isJezero) {
        // 1. Raised Western Crater Rim Ridge contours (X < 140m)
        octx.strokeStyle = 'rgba(210, 153, 34, 0.24)';
        octx.lineWidth = 1.2;
        for (const xRim of [35, 65, 95, 125]) {
          octx.beginPath();
          octx.moveTo(xRim * scalePt, 0);
          octx.bezierCurveTo(
            (xRim + 14) * scalePt, size * 0.3,
            (xRim - 10) * scalePt, size * 0.7,
            (xRim + 8) * scalePt, size
          );
          octx.stroke();
        }

        // 2. Branching River-Delta Escarpment Fan (X = 80..310m)
        octx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
        octx.lineWidth = 1.1;
        for (const fanR of [70, 115, 160, 205, 240]) {
          octx.beginPath();
          octx.arc(75 * scalePt, 255 * scalePt, fanR * scalePt, -0.62, 0.72);
          octx.stroke();
        }

        // 3. Paleochannel distributary lines across delta
        octx.strokeStyle = 'rgba(88, 166, 255, 0.12)';
        octx.setLineDash([4, 4]);
        octx.beginPath();
        octx.moveTo(75 * scalePt, 255 * scalePt);
        octx.quadraticCurveTo(190 * scalePt, 235 * scalePt, 305 * scalePt, 195 * scalePt);
        octx.moveTo(75 * scalePt, 255 * scalePt);
        octx.quadraticCurveTo(200 * scalePt, 275 * scalePt, 310 * scalePt, 315 * scalePt);
        octx.moveTo(75 * scalePt, 255 * scalePt);
        octx.quadraticCurveTo(175 * scalePt, 310 * scalePt, 265 * scalePt, 365 * scalePt);
        octx.stroke();
        octx.setLineDash([]);

        // 4. Ancient Lakebed Basin subtle contours (X > 320m)
        octx.strokeStyle = 'rgba(139, 148, 158, 0.14)';
        octx.lineWidth = 0.8;
        for (const rad of [60, 110, 160]) {
          octx.beginPath();
          octx.ellipse(455 * scalePt, 310 * scalePt, rad * scalePt, rad * 0.8 * scalePt, 0.2, 0, Math.PI * 2);
          octx.stroke();
        }
      } else {
        // Procedural sector contour rings
        octx.strokeStyle = '#2A1F1B';
        octx.lineWidth = 0.8;
        const centerDips = [
          { x: 180, y: 160, r: 120 },
          { x: 380, y: 320, r: 160 },
          { x: 490, y: 180, r: 90 },
          { x: 250, y: 440, r: 130 },
        ];
        for (const ridge of centerDips) {
          for (let rStep = 30; rStep < ridge.r; rStep += 35) {
            octx.beginPath();
            octx.ellipse(
              ridge.x * scalePt,
              ridge.y * scalePt,
              rStep * scalePt,
              rStep * 0.75 * scalePt,
              Math.PI / 6,
              0,
              Math.PI * 2
            );
            octx.stroke();
          }
        }
      }
    }

    return offscreen;
  }, [terrainPreset, terrainVersion, elevationGrid?.length, layerContours]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const viewW = canvasDimensions.width;
    const viewH = canvasDimensions.height;

    if (canvas.width !== viewW * dpr || canvas.height !== viewH * dpr) {
      canvas.width = viewW * dpr;
      canvas.height = viewH * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Matte Obsidian Base Background
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, viewW, viewH);

    // Coordinate Scale & Offsets
    const worldW = state.terrain_summary.width_m || 600;
    const worldH = state.terrain_summary.height_m || 600;
    const baseScale = Math.min(viewW, viewH) / worldW;
    const scale = baseScale * zoom;

    const offsetX = pan.x + (viewW - worldW * scale) / 2;
    const offsetY = pan.y + (viewH - worldH * scale) / 2;

    const toCanvasX = (wx: number) => offsetX + wx * scale;
    const toCanvasY = (wy: number) => offsetY + wy * scale;
    const toWorldDist = (m: number) => m * scale;

    // 1. Draw Mars Surface Base
    ctx.save();
    ctx.beginPath();
    ctx.rect(toCanvasX(0), toCanvasY(0), toWorldDist(worldW), toWorldDist(worldH));
    ctx.fillStyle = terrainPreset === 'jezero_crater' ? '#10161C' : '#120E0D';
    ctx.fill();
    ctx.strokeStyle = terrainPreset === 'jezero_crater' ? '#3B2C1A' : '#21262D';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();

    // Draw Cached Topographic Elevation & Contour Layer
    if (terrainLayerCanvas) {
      ctx.drawImage(
        terrainLayerCanvas,
        toCanvasX(0),
        toCanvasY(0),
        toWorldDist(worldW),
        toWorldDist(worldH)
      );
    }

    // Subtle Map Sector Label
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    if (terrainPreset === 'jezero_crater') {
      ctx.fillStyle = 'rgba(210, 153, 34, 0.75)';
      ctx.fillText('JEZERO CRATER — DELTA SECTOR', toCanvasX(14), toCanvasY(22));
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(139, 148, 158, 0.55)';
      ctx.fillText('WESTERN RIM', toCanvasX(16), toCanvasY(582));
      ctx.fillText('DELTA ESCARPMENT', toCanvasX(165), toCanvasY(582));
      ctx.fillText('ANCIENT LAKEBED BASIN', toCanvasX(395), toCanvasY(582));
    } else {
      ctx.fillStyle = 'rgba(139, 148, 158, 0.6)';
      ctx.fillText('PROCEDURAL — SECTOR 7', toCanvasX(14), toCanvasY(22));
    }
    ctx.restore();

    // Fine Coordinate Gridlines (every 50 meters)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= worldW; gx += 50) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(gx), toCanvasY(0));
      ctx.lineTo(toCanvasX(gx), toCanvasY(worldH));
      ctx.stroke();
    }
    for (let gy = 0; gy <= worldH; gy += 50) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), toCanvasY(gy));
      ctx.lineTo(toCanvasX(worldW), toCanvasY(gy));
      ctx.stroke();
    }

    // Grid Coordinates Reference Marks
    ctx.fillStyle = '#6E7681';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    for (let gx = 100; gx < worldW; gx += 100) {
      ctx.fillText(`${gx}m`, toCanvasX(gx) + 3, toCanvasY(12));
    }

    // 2. Natural Rock Fields
    if (state.terrain_summary.rock_fields) {
      for (const rf of state.terrain_summary.rock_fields) {
        ctx.save();
        const cx = toCanvasX(rf.x);
        const cy = toCanvasY(rf.y);
        const rad = toWorldDist(rf.radius);

        const rockGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
        rockGrad.addColorStop(0, 'rgba(140, 67, 24, 0.22)');
        rockGrad.addColorStop(0.8, 'rgba(140, 67, 24, 0.08)');
        rockGrad.addColorStop(1, 'rgba(140, 67, 24, 0)');
        ctx.fillStyle = rockGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8C4318';
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          const rSub = rad * 0.55;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * rSub, cy + Math.sin(angle) * rSub, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 3. Craters
    if (state.terrain_summary.craters) {
      for (const cr of state.terrain_summary.craters) {
        ctx.save();
        const cx = toCanvasX(cr.x);
        const cy = toCanvasY(cr.y);
        const rad = toWorldDist(cr.radius);

        const crGrad = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
        crGrad.addColorStop(0, '#060404');
        crGrad.addColorStop(0.7, '#100806');
        crGrad.addColorStop(1, '#20120D');
        ctx.fillStyle = crGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#381E15';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(248, 81, 73, 0.2)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. Injected / Detected Obstacles
    if (state.terrain_summary.injected_hazards) {
      for (const hz of state.terrain_summary.injected_hazards) {
        ctx.save();
        const hx = toCanvasX(hz.x);
        const hy = toCanvasY(hz.y);
        const hrad = toWorldDist(hz.radius);

        const hzGrad = ctx.createRadialGradient(hx, hy, 2, hx, hy, hrad);
        hzGrad.addColorStop(0, 'rgba(248, 81, 73, 0.35)');
        hzGrad.addColorStop(0.7, 'rgba(248, 81, 73, 0.12)');
        hzGrad.addColorStop(1, 'rgba(248, 81, 73, 0)');
        ctx.fillStyle = hzGrad;
        ctx.beginPath();
        ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F85149';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F85149';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`! ${hz.type || 'HAZARD'}`, hx, hy - hrad - 4);
        ctx.restore();
      }
    }

    // 4b. Dynamic Moving Martian Dust Storm Front
    if (state.dust_storm && state.dust_storm.active) {
      const storm = state.dust_storm;
      const stormX = toCanvasX(storm.x);
      const stormY = toCanvasY(storm.y);
      const stormRad = toWorldDist(storm.radius);

      ctx.save();
      // Translucent atmospheric body with soft radial falloff
      const stormGrad = ctx.createRadialGradient(stormX, stormY, stormRad * 0.1, stormX, stormY, stormRad);
      stormGrad.addColorStop(0, 'rgba(217, 119, 6, 0.28)');
      stormGrad.addColorStop(0.65, 'rgba(217, 119, 6, 0.15)');
      stormGrad.addColorStop(1, 'rgba(217, 119, 6, 0.0)');
      ctx.fillStyle = stormGrad;
      ctx.beginPath();
      ctx.arc(stormX, stormY, stormRad, 0, Math.PI * 2);
      ctx.fill();

      // Dashed wind-front perimeter
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(stormX, stormY, stormRad, 0, Math.PI * 2);
      ctx.stroke();

      // Internal drifting dust streaks
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      for (let i = -2; i <= 2; i++) {
        const offset = i * (stormRad * 0.25);
        ctx.beginPath();
        ctx.moveTo(stormX - stormRad * 0.6, stormY + offset);
        ctx.lineTo(stormX + stormRad * 0.6, stormY + offset + (storm.vy / Math.max(0.1, Math.abs(storm.vx))) * 12);
        ctx.stroke();
      }

      // Storm Front Monospace Label
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `DUST STORM (r=${Math.round(storm.radius)}m | VO DEGRADED)`,
        stormX,
        stormY - stormRad - 6
      );
      ctx.restore();
    }

    // 5. Origin and Science Target Markers
    const startPos = state.terrain_summary.start_pos || [50, 50];
    const targetPos = state.terrain_summary.target_pos || [540, 530];

    // Origin
    ctx.save();
    const sx = toCanvasX(startPos[0]);
    const sy = toCanvasY(startPos[1]);
    ctx.strokeStyle = '#8B949E';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 5, sy - 5, 10, 10);
    ctx.fillStyle = '#8B949E';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ORIGIN', sx, sy + 16);
    ctx.restore();

    // Target (Nominal Reticle)
    ctx.save();
    const tx = toCanvasX(targetPos[0]);
    const ty = toCanvasY(targetPos[1]);

    ctx.strokeStyle = '#2EA043';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx - 14, ty);
    ctx.lineTo(tx + 14, ty);
    ctx.moveTo(tx, ty - 14);
    ctx.lineTo(tx, ty + 14);
    ctx.stroke();

    ctx.fillStyle = '#2EA043';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET (540, 530)', tx, ty - 16);
    ctx.restore();

    // 6. Trajectories
    // 6a. Historical Breadcrumb Track
    if (state.routes.breadcrumb_history && state.routes.breadcrumb_history.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toCanvasX(state.routes.breadcrumb_history[0].x), toCanvasY(state.routes.breadcrumb_history[0].y));
      for (let i = 1; i < state.routes.breadcrumb_history.length; i++) {
        ctx.lineTo(toCanvasX(state.routes.breadcrumb_history[i].x), toCanvasY(state.routes.breadcrumb_history[i].y));
      }
      ctx.strokeStyle = '#30363D';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 6b. Old Avoided Route (Dashed Critical Red)
    if (state.routes.old_avoided_path && state.routes.old_avoided_path.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toCanvasX(state.routes.old_avoided_path[0][0]), toCanvasY(state.routes.old_avoided_path[0][1]));
      for (let i = 1; i < state.routes.old_avoided_path.length; i++) {
        ctx.lineTo(toCanvasX(state.routes.old_avoided_path[i][0]), toCanvasY(state.routes.old_avoided_path[i][1]));
      }
      ctx.strokeStyle = '#F85149';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      ctx.fillStyle = '#F85149';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (let i = 1; i < state.routes.old_avoided_path.length - 1; i += 3) {
        const px = toCanvasX(state.routes.old_avoided_path[i][0]);
        const py = toCanvasY(state.routes.old_avoided_path[i][1]);
        ctx.fillText('x', px, py + 3);
      }
      ctx.restore();
    }

    // 6c. Active Planned Safe Route (Telemetry Accent Solid Line)
    if (state.routes.current_planned && state.routes.current_planned.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toCanvasX(state.routes.current_planned[0][0]), toCanvasY(state.routes.current_planned[0][1]));
      for (let i = 1; i < state.routes.current_planned.length; i++) {
        ctx.lineTo(toCanvasX(state.routes.current_planned[i][0]), toCanvasY(state.routes.current_planned[i][1]));
      }
      ctx.strokeStyle = '#58A6FF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#E6EDF3';
      for (const pt of state.routes.current_planned) {
        ctx.beginPath();
        ctx.arc(toCanvasX(pt[0]), toCanvasY(pt[1]), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6d. ML Predicted Trajectory (Warning Amber Horizon Curve)
    if (
      layerPrediction &&
      state.trajectory_prediction &&
      state.trajectory_prediction.predicted_trajectory &&
      state.trajectory_prediction.predicted_trajectory.length > 1
    ) {
      const pred = state.trajectory_prediction.predicted_trajectory;
      ctx.save();

      // Lateral variance corridor
      ctx.beginPath();
      for (let i = 0; i < pred.length; i++) {
        const lateralVar = toWorldDist(1.2 + i * 0.12);
        const px = toCanvasX(pred[i].x);
        const py = toCanvasY(pred[i].y);
        if (i === 0) ctx.moveTo(px + lateralVar, py);
        else ctx.lineTo(px + lateralVar, py);
      }
      for (let i = pred.length - 1; i >= 0; i--) {
        const lateralVar = toWorldDist(1.2 + i * 0.12);
        const px = toCanvasX(pred[i].x);
        const py = toCanvasY(pred[i].y);
        ctx.lineTo(px - lateralVar, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(210, 153, 34, 0.08)';
      ctx.fill();

      // Predicted path line
      ctx.beginPath();
      ctx.moveTo(toCanvasX(pred[0].x), toCanvasY(pred[0].y));
      for (let i = 1; i < pred.length; i++) {
        ctx.lineTo(toCanvasX(pred[i].x), toCanvasY(pred[i].y));
      }
      ctx.strokeStyle = '#D29922';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const lastPt = pred[pred.length - 1];
      ctx.fillStyle = '#D29922';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `+30s ML (${state.trajectory_prediction.confidence_pct}%)`,
        toCanvasX(lastPt.x),
        toCanvasY(lastPt.y) - 6
      );
      ctx.restore();
    }

    // 7. Rover, Forward Camera FOV, and EKF Uncertainty Ellipse
    const rx = toCanvasX(state.rover.x);
    const ry = toCanvasY(state.rover.y);
    const heading = state.rover.heading_rad;

    // 7a. Camera Forward FOV Cone
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(heading);
    const fovLen = toWorldDist(45);
    const fovAngle = Math.PI * 0.38;

    const fovGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, fovLen);
    fovGrad.addColorStop(0, 'rgba(88, 166, 255, 0.15)');
    fovGrad.addColorStop(0.8, 'rgba(88, 166, 255, 0.03)');
    fovGrad.addColorStop(1, 'rgba(88, 166, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, fovLen, -fovAngle / 2, fovAngle / 2);
    ctx.closePath();
    ctx.fillStyle = fovGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 7b. EKF Covariance Uncertainty Ellipse (2σ)
    if (layerEKF && state.ekf && state.ekf.covariance_ellipse) {
      const ell = state.ekf.covariance_ellipse;
      const semiMajor = toWorldDist(ell.semi_major_m);
      const semiMinor = toWorldDist(ell.semi_minor_m);
      const angle = ell.angle_rad;

      ctx.save();
      ctx.translate(toCanvasX(state.ekf.est_x), toCanvasY(state.ekf.est_y));
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, semiMajor), Math.max(3, semiMinor), 0, 0, Math.PI * 2);
      ctx.fillStyle = state.ekf.fallback_active ? 'rgba(248, 81, 73, 0.1)' : 'rgba(88, 166, 255, 0.08)';
      ctx.fill();

      ctx.strokeStyle = state.ekf.fallback_active ? '#F85149' : '#58A6FF';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      ctx.fillStyle = state.ekf?.fallback_active ? '#F85149' : '#8B949E';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`2σ: ±${state.ekf?.uncertainty_m ?? 0.5}m`, 0, -semiMinor - 4);
      ctx.restore();
    }

    // 7c. Rover Chassis (Swarm or Single)
    if (state.swarm_mode_enabled && state.swarm_rovers && state.swarm_rovers.length > 0) {
      for (const sr of state.swarm_rovers) {
        const srX = toCanvasX(sr.true_pos[0]);
        const srY = toCanvasY(sr.true_pos[1]);
        const srEkfX = toCanvasX(sr.ekf_pos[0]);
        const srEkfY = toCanvasY(sr.ekf_pos[1]);
        const srHeading = sr.heading;
        const srColor = sr.color || '#58A6FF';

        // Swarm Rover Trail
        if (sr.trail && sr.trail.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(toCanvasX(sr.trail[0][0]), toCanvasY(sr.trail[0][1]));
          for (let i = 1; i < sr.trail.length; i++) {
            ctx.lineTo(toCanvasX(sr.trail[i][0]), toCanvasY(sr.trail[i][1]));
          }
          ctx.strokeStyle = srColor;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.restore();
        }

        // Swarm Rover Planned Path
        if (sr.path && sr.path.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(toCanvasX(sr.path[0][0]), toCanvasY(sr.path[0][1]));
          for (let i = 1; i < sr.path.length; i++) {
            ctx.lineTo(toCanvasX(sr.path[i][0]), toCanvasY(sr.path[i][1]));
          }
          ctx.strokeStyle = srColor;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 4]);
          ctx.stroke();
          ctx.restore();
        }

        // Swarm Rover EKF 2σ Uncertainty Ring
        if (layerEKF) {
          ctx.save();
          const uncRadius = Math.max(3, toWorldDist(sr.uncertainty_m));
          ctx.beginPath();
          ctx.arc(srEkfX, srEkfY, uncRadius, 0, Math.PI * 2);
          ctx.strokeStyle = srColor;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.restore();
        }

        // Swarm Rover Chassis
        ctx.save();
        ctx.translate(srX, srY);
        ctx.rotate(srHeading);

        ctx.fillStyle = '#161B22';
        ctx.fillRect(-8, -6, 16, 12);
        ctx.strokeStyle = srColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -6, 16, 12);

        // Wheels
        ctx.fillStyle = '#080A0D';
        ctx.strokeStyle = '#30363D';
        ctx.lineWidth = 1;
        const wheelPositions = [
          [-6, -8], [0, -8], [6, -8],
          [-6, 6], [0, 6], [6, 6],
        ];
        for (const [wx, wy] of wheelPositions) {
          ctx.fillRect(wx - 2.5, wy, 5, 2);
          ctx.strokeRect(wx - 2.5, wy, 5, 2);
        }

        // Direction Pointer
        ctx.fillStyle = srColor;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -3);
        ctx.lineTo(5, 3);
        ctx.closePath();
        ctx.fill();

        // Center Core Light
        ctx.fillStyle = sr.in_storm ? '#D29922' : sr.assigned_satellite_id ? '#2EA043' : '#F85149';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Swarm Rover Label & Readout
        ctx.save();
        ctx.fillStyle = srColor;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${sr.callsign.toUpperCase()} [${sr.role.toUpperCase()}]`, srX, srY - 14);

        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#8B949E';
        const satTag = sr.assigned_satellite_id ? `SAT: ${sr.assigned_satellite_id}` : 'DR ONLY';
        ctx.fillText(`±${sr.uncertainty_m.toFixed(1)}m | ${sr.speed.toFixed(1)}m/s | ${satTag}`, srX, srY + 18);
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(heading);

      ctx.fillStyle = '#161B22';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.strokeStyle = '#58A6FF';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -6, 16, 12);

      ctx.fillStyle = '#080A0D';
      ctx.strokeStyle = '#30363D';
      ctx.lineWidth = 1;
      const wheelPositions = [
        [-6, -8], [0, -8], [6, -8],
        [-6, 6], [0, 6], [6, 6],
      ];
      for (const [wx, wy] of wheelPositions) {
        ctx.fillRect(wx - 2.5, wy, 5, 2);
        ctx.strokeRect(wx - 2.5, wy, 5, 2);
      }

      // Direction Mast
      ctx.fillStyle = '#F85149';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(5, -3);
      ctx.lineTo(5, 3);
      ctx.closePath();
      ctx.fill();

      // Center Core Light
      ctx.fillStyle = state.ekf?.fallback_active ? '#F85149' : '#2EA043';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 7d. Shadow Rover (Mode A Dead Reckoning Ghost) if Shadow Race is Active
    if (state.shadow_race_enabled && state.shadow_rover) {
      const sr = state.shadow_rover;
      const s_true_x = toCanvasX(sr.true_pos[0]);
      const s_true_y = toCanvasY(sr.true_pos[1]);
      const s_ekf_x = toCanvasX(sr.ekf_pos[0]);
      const s_ekf_y = toCanvasY(sr.ekf_pos[1]);
      const s_heading = sr.heading;

      // Shadow Rover Trail (Crimson dashed)
      if (sr.trail && sr.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(toCanvasX(sr.trail[0][0]), toCanvasY(sr.trail[0][1]));
        for (let i = 1; i < sr.trail.length; i++) {
          ctx.lineTo(toCanvasX(sr.trail[i][0]), toCanvasY(sr.trail[i][1]));
        }
        ctx.strokeStyle = 'rgba(248, 81, 73, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }

      // Drift Tether Line (between true physical position and dead-reckoning EKF position)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s_true_x, s_true_y);
      ctx.lineTo(s_ekf_x, s_ekf_y);
      ctx.strokeStyle = 'rgba(248, 81, 73, 0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();

      // Dead Reckoning EKF Estimated Position Halo
      ctx.beginPath();
      ctx.arc(s_ekf_x, s_ekf_y, 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(248, 81, 73, 0.6)';
      ctx.stroke();

      ctx.fillStyle = '#F85149';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`EST: ±${sr.localization_error.toFixed(1)}m`, s_ekf_x, s_ekf_y + 11);
      ctx.restore();

      // Translucent Ghost Silhouette at True Physical Position
      ctx.save();
      ctx.translate(s_true_x, s_true_y);
      ctx.rotate(s_heading);

      ctx.fillStyle = 'rgba(248, 81, 73, 0.25)';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.strokeStyle = '#F85149';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(-8, -6, 16, 12);

      // Direction Pointer
      ctx.fillStyle = '#F85149';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(5, -3);
      ctx.lineTo(5, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Mode A Ghost Identifier Label
      ctx.save();
      ctx.fillStyle = '#F85149';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SHADOW: MODE A (DR)', s_true_x, s_true_y - 10);
      ctx.restore();
    }

    // 8. Constellation & Link Beams
    if (layerSatellites && state.satellites) {
      for (const sat of state.satellites) {
        const satX = toCanvasX(sat.gx);
        const satY = toCanvasY(sat.gy);
        const fovRadius = toWorldDist(sat.fov_radius_m);

        // Ground Footprint Cone
        ctx.save();
        ctx.beginPath();
        ctx.arc(satX, satY, fovRadius, 0, Math.PI * 2);
        ctx.strokeStyle = sat.is_visible
          ? sat.current_task === 'PNT'
            ? 'rgba(88, 166, 255, 0.2)'
            : sat.current_task === 'IMAGING'
            ? 'rgba(188, 140, 255, 0.2)'
            : 'rgba(46, 160, 67, 0.2)'
          : 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();

        if (sat.is_visible && sat.current_task !== 'IDLE') {
          ctx.fillStyle =
            sat.current_task === 'PNT'
              ? 'rgba(88, 166, 255, 0.02)'
              : sat.current_task === 'IMAGING'
              ? 'rgba(188, 140, 255, 0.02)'
              : 'rgba(46, 160, 67, 0.02)';
          ctx.fill();
        }
        ctx.restore();

        // Active Communication Beam
        if (sat.is_visible && !sat.is_outage && sat.current_task !== 'IDLE') {
          let beamTargetX = rx;
          let beamTargetY = ry;
          if (state.swarm_mode_enabled && state.swarm_rovers && sat.target_rover_id) {
            const targetRover = state.swarm_rovers.find((r) => r.rover_id === sat.target_rover_id);
            if (targetRover) {
              beamTargetX = toCanvasX(targetRover.true_pos[0]);
              beamTargetY = toCanvasY(targetRover.true_pos[1]);
            }
          }

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(satX, satY);
          ctx.lineTo(beamTargetX, beamTargetY);

          if (sat.current_task === 'PNT') {
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.7)';
            ctx.lineWidth = 1.5;
          } else if (sat.current_task === 'IMAGING') {
            ctx.strokeStyle = 'rgba(188, 140, 255, 0.7)';
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = 'rgba(46, 160, 67, 0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Outage Beam (dashed red)
        if (sat.is_outage) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(satX, satY);
          ctx.lineTo(rx, ry);
          ctx.strokeStyle = 'rgba(248, 81, 73, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.restore();
        }

        // Satellite Marker
        ctx.save();
        ctx.translate(satX, satY);

        ctx.fillStyle = '#161B22';
        ctx.fillRect(-12, -2.5, 7, 5);
        ctx.fillRect(5, -2.5, 7, 5);
        ctx.strokeStyle = '#30363D';
        ctx.lineWidth = 1;
        ctx.strokeRect(-12, -2.5, 7, 5);
        ctx.strokeRect(5, -2.5, 7, 5);

        const satColor = sat.is_outage
          ? '#F85149'
          : sat.is_visible
          ? sat.current_task === 'PNT'
            ? '#58A6FF'
            : sat.current_task === 'IMAGING'
            ? '#BC8CFF'
            : '#2EA043'
          : '#6E7681';

        ctx.fillStyle = '#080A0D';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeStyle = satColor;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-4, -4, 8, 8);

        ctx.fillStyle = satColor;
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = satColor;
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sat.sat_id, 0, -8);

        ctx.fillStyle = '#8B949E';
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillText(sat.current_task, 0, 14);

        ctx.restore();
      }
    }

    // 9. Coordinate Crosshair on Hover
    if (hoverCoord) {
      const hx = toCanvasX(hoverCoord.x);
      const hy = toCanvasY(hoverCoord.y);
      ctx.save();
      ctx.strokeStyle = isHazardModeActive ? '#D29922' : '#58A6FF';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(hx - 8, hy - 8, 16, 16);
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy);
      ctx.lineTo(hx + 12, hy);
      ctx.moveTo(hx, hy - 12);
      ctx.lineTo(hx, hy + 12);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Scale Bar in Meters (Bottom-Left)
    const scaleBarMeters = scale * 100 > 120 ? 50 : 100;
    const barWidthPx = scaleBarMeters * scale;
    const sbX = toCanvasX(15);
    const sbY = toCanvasY(worldH - 15);

    ctx.save();
    ctx.strokeStyle = '#8B949E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY - 4);
    ctx.lineTo(sbX, sbY);
    ctx.lineTo(sbX + barWidthPx, sbY);
    ctx.lineTo(sbX + barWidthPx, sbY - 4);
    ctx.stroke();

    ctx.fillStyle = '#8B949E';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${scaleBarMeters}m SCALE`, sbX + barWidthPx / 2, sbY - 6);
    ctx.restore();

    ctx.restore(); // Clip
    ctx.restore(); // DPR
  }, [
    state,
    terrainPreset,
    terrainVersion,
    terrainLayerCanvas,
    zoom,
    pan,
    hoverCoord,
    canvasDimensions,
    layerContours,
    layerEKF,
    layerPrediction,
    layerSatellites,
    isHazardModeActive,
  ]);

  // Pan & Zoom Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isHazardModeActive && state && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const worldW = state.terrain_summary.width_m || 600;
      const worldH = state.terrain_summary.height_m || 600;
      const baseScale = Math.min(rect.width, rect.height) / worldW;
      const scale = baseScale * zoom;
      const offsetX = pan.x + (rect.width - worldW * scale) / 2;
      const offsetY = pan.y + (rect.height - worldH * scale) / 2;

      const worldX = (clickX - offsetX) / scale;
      const worldY = (clickY - offsetY) / scale;

      onInjectHazard(worldX, worldY, 28.0, 'ROCK_FIELD');
      if (onCancelHazardMode) onCancelHazardMode();
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setFollowRover(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (state && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldW = state.terrain_summary.width_m || 600;
      const worldH = state.terrain_summary.height_m || 600;
      const baseScale = Math.min(rect.width, rect.height) / worldW;
      const scale = baseScale * zoom;
      const offsetX = pan.x + (rect.width - worldW * scale) / 2;
      const offsetY = pan.y + (rect.height - worldH * scale) / 2;

      const wx = (mouseX - offsetX) / scale;
      const wy = (mouseY - offsetY) / scale;

      if (wx >= 0 && wx <= worldW && wy >= 0 && wy <= worldH) {
        setHoverCoord({ x: Math.round(wx), y: Math.round(wy) });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.6, Math.min(4.0, prev * zoomFactor)));
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setFollowRover(false);
  };

  // Hero KPI Calculations for Floating Tactical HUD
  const posError = state?.metrics?.position_error_instant_m ?? state?.metrics?.current_position_error_m ?? 0.0;
  const posErrorColor = posError < 1.5 ? 'text-[#2EA043]' : posError <= 4.0 ? 'text-[#D29922]' : 'text-[#F85149]';

  const visibleSats = useMemo(() => {
    return state?.satellites?.filter((s) => s.is_visible && !s.is_outage).length ?? 0;
  }, [state?.satellites]);

  const isBlackout = state?.ekf?.fallback_active || visibleSats === 0;

  // Live AI Activity Ticker Message
  const tickerText = useMemo(() => {
    if (!state) return 'INITIALIZING GNC SUBSYSTEMS...';

    if (state.hazard_alert?.active_alert || state.rover?.mission_status === 'HAZARD_AVOIDANCE') {
      const type = state.hazard_alert?.active_alert?.type || 'OBSTACLE';
      return `⚠️ AVOIDANCE: A* pathplanner recalculating around ${type}`;
    }

    if (state.ai_scheduler?.selected_satellite) {
      const satId = state.ai_scheduler.selected_satellite;
      const task = state.ai_scheduler.selected_task || 'PNT';
      const reason = state.ai_scheduler.reason_summary || 'Tasked based on multi-objective visibility & need';
      return `🛰️ AI SCHEDULER: ${satId} assigned to ${task} • ${reason}`;
    }

    if (state.ekf?.fallback_active) {
      return '⚠️ OUTAGE FALLBACK: Dead reckoning via IMU, VO & slip-compensated wheel odometry';
    }

    return '⚡ NAVIS GNC RUNNING: 20Hz continuous multi-sensor EKF state estimation';
  }, [state]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#09090B] overflow-hidden select-none">
      {/* Main Canvas Container */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full min-h-0 bg-[#09090B] ${
          isHazardModeActive ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* Slim Minimal Translucent Top-Left Readout */}
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2.5 px-3 py-1.5 bg-[#0C0C0E]/80 backdrop-blur-md border border-[#222226] rounded-md font-mono text-[11px] text-[#A1A1AA]">
          <span>
            Err <span className="text-[#F4F4F5] font-medium tabular-nums">{posError.toFixed(2)}m</span>
          </span>
          <span className="text-[#222226]">·</span>
          <span>
            2σ <span className="text-[#F4F4F5] font-medium tabular-nums">±{(state?.ekf?.uncertainty_m ?? 0.5).toFixed(2)}m</span>
          </span>
          <span className="text-[#222226]">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isBlackout ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[#F4F4F5] font-medium tabular-nums">
              {isBlackout ? 'Blackout' : `${visibleSats}/4 Lock`}
            </span>
          </span>
          {state?.dust_storm?.rover_in_storm && (
            <>
              <span className="text-[#222226]">·</span>
              <span className="flex items-center gap-1.5 text-[#F4F4F5]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>VO Degraded</span>
              </span>
            </>
          )}
          {state?.shadow_race_enabled && state?.shadow_rover && (
            <>
              <span className="text-[#222226]">·</span>
              <span className="text-[#A1A1AA]">
                Shadow <span className="text-[#F4F4F5] tabular-nums">{(state.shadow_rover?.localization_error ?? 0).toFixed(1)}m</span>
              </span>
            </>
          )}
          {hoverCoord && (
            <>
              <span className="text-[#222226]">·</span>
              <span className="text-[#71717A] tabular-nums">
                {hoverCoord.x}, {hoverCoord.y}m
              </span>
            </>
          )}
        </div>

        {/* Top-Right Layers & Zoom Controls */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <button
            onClick={() => setIsLayersOpen((o) => !o)}
            className={`btn-control bg-[#0C0C0E]/80 backdrop-blur-md text-xs ${
              isLayersOpen ? 'bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]' : ''
            }`}
            title="Toggle Map Layers"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
            {isLayersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[#0C0C0E]/80 backdrop-blur-md border border-[#222226]">
            <button
              onClick={() => setZoom((z) => Math.min(4.0, z * 1.2))}
              className="p-1.5 rounded-[4px] hover:bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z * 0.8))}
              className="p-1.5 rounded-[4px] hover:bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded-[4px] hover:bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setFollowRover((f) => !f)}
              className={`p-1.5 rounded-[4px] transition-colors ${
                followRover
                  ? 'bg-[#F4F4F5] text-[#09090B]'
                  : 'hover:bg-[#141417] text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
              title="Follow Rover"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Layers Popover */}
        {isLayersOpen && (
          <div className="absolute top-12 right-3 z-30 w-60 bg-[#0C0C0E] border border-[#222226] rounded-md p-3 text-xs shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#1E1E22] pb-2 text-[11px] text-[#71717A] uppercase tracking-wider font-medium">
              <span>Layers</span>
              <button
                onClick={() => setIsLayersOpen(false)}
                className="text-[#71717A] hover:text-[#F4F4F5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[#F4F4F5]">
              <label className="flex items-center justify-between cursor-pointer hover:bg-[#141417] px-1.5 py-1 rounded-[4px]">
                <span>Elevation Contours</span>
                <input
                  type="checkbox"
                  checked={layerContours}
                  onChange={(e) => setLayerContours(e.target.checked)}
                  className="accent-[#F4F4F5] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:bg-[#141417] px-1.5 py-1 rounded-[4px]">
                <span>EKF 2σ Ellipse</span>
                <input
                  type="checkbox"
                  checked={layerEKF}
                  onChange={(e) => setLayerEKF(e.target.checked)}
                  className="accent-[#F4F4F5] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:bg-[#141417] px-1.5 py-1 rounded-[4px]">
                <span>ML Trajectory</span>
                <input
                  type="checkbox"
                  checked={layerPrediction}
                  onChange={(e) => setLayerPrediction(e.target.checked)}
                  className="accent-[#F4F4F5] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:bg-[#141417] px-1.5 py-1 rounded-[4px]">
                <span>Satellite FOV Cones</span>
                <input
                  type="checkbox"
                  checked={layerSatellites}
                  onChange={(e) => setLayerSatellites(e.target.checked)}
                  className="accent-[#F4F4F5] cursor-pointer"
                />
              </label>
            </div>

            <div className="border-t border-[#1E1E22] pt-2 space-y-1 text-[11px] text-[#71717A]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#58A6FF] inline-block" />
                <span>Planned Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#D29922] inline-block" />
                <span>ML Trajectory (+30s)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2EA043] inline-block" />
                <span>Science Target</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Hazard Placement Notice */}
        {isHazardModeActive && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-md bg-[#0C0C0E] border border-[#3F3F46] text-[#F4F4F5] text-xs font-medium flex items-center gap-2.5 shadow-xl">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Click anywhere on the map to place a hazard</span>
            {onCancelHazardMode && (
              <button
                onClick={onCancelHazardMode}
                className="ml-1 px-2 py-0.5 rounded-[4px] bg-[#141417] border border-[#222226] text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5]"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
