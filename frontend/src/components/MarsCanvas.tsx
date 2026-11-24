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
import { HazardPalette, HazardType } from './HazardPalette';

interface MarsCanvasProps {
  state: SimulationFullState | null;
  onInjectHazard: (x: number, y: number, radius?: number, type?: string) => void;
  onSetTarget?: (x: number, y: number) => void;
  lastCommand?: string;
  isHazardModeActive?: boolean;
  selectedHazardType?: HazardType;
  onSelectHazardType?: (type: HazardType) => void;
  onClearHazards?: () => void;
  onCancelHazardMode?: () => void;
}

export const MarsCanvas: React.FC<MarsCanvasProps> = ({
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport Transform States (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [targetRipple, setTargetRipple] = useState<{ x: number; y: number; ts: number } | null>(null);
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

  // Sample elevation (m) & terrain slope (deg) via bilinear interpolation on DEM grid
  const sampleElevationAndSlope = (
    grid: number[][] | undefined,
    wx: number,
    wy: number,
    wWidth = 600,
    wHeight = 600
  ): { elev: number; slopeDeg: number } | null => {
    if (!grid || grid.length < 2 || !grid[0] || grid[0].length < 2) return null;
    const rows = grid.length;
    const cols = grid[0].length;
    const sampleGrid = (gx: number, gy: number): number => {
      const cx = Math.max(0, Math.min(cols - 1, gx));
      const cy = Math.max(0, Math.min(rows - 1, gy));
      const x0 = Math.floor(cx);
      const y0 = Math.floor(cy);
      const x1 = Math.min(cols - 1, x0 + 1);
      const y1 = Math.min(rows - 1, y0 + 1);
      const tx = cx - x0;
      const ty = cy - y0;
      const v00 = grid[y0][x0];
      const v10 = grid[y0][x1];
      const v01 = grid[y1][x0];
      const v11 = grid[y1][x1];
      return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    };

    const gx = (wx / Math.max(1, wWidth)) * (cols - 1);
    const gy = (wy / Math.max(1, wHeight)) * (rows - 1);
    const elev = sampleGrid(gx, gy);

    const step = 0.5;
    const gxL = Math.max(0, gx - step);
    const gxR = Math.min(cols - 1, gx + step);
    const gyU = Math.max(0, gy - step);
    const gyD = Math.min(rows - 1, gy + step);
    const dxMeters = Math.max(0.5, ((gxR - gxL) / Math.max(1, cols - 1)) * wWidth);
    const dyMeters = Math.max(0.5, ((gyD - gyU) / Math.max(1, rows - 1)) * wHeight);
    const dzdx = (sampleGrid(gxR, gy) - sampleGrid(gxL, gy)) / dxMeters;
    const dzdy = (sampleGrid(gx, gyD) - sampleGrid(gx, gyU)) / dyMeters;
    const slopeDeg = Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI);
    return { elev, slopeDeg };
  };

  const hoverTelemetry = useMemo(() => {
    if (!hoverCoord) return null;
    const worldW = state?.terrain_summary?.width_m || 600;
    const worldH = state?.terrain_summary?.height_m || 600;
    const sampled = sampleElevationAndSlope(elevationGrid, hoverCoord.x, hoverCoord.y, worldW, worldH);
    return {
      x: hoverCoord.x,
      y: hoverCoord.y,
      elev: sampled ? sampled.elev : null,
      slopeDeg: sampled ? sampled.slopeDeg : null,
    };
  }, [hoverCoord, elevationGrid, state?.terrain_summary?.width_m, state?.terrain_summary?.height_m]);

  // Cached offscreen terrain hillshade + iso-elevation contour layer (invalidates on preset / seed / contours toggle)
  const terrainLayerCanvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const offscreen = document.createElement('canvas');
    const size = 320;
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    const isJezero = terrainPreset === 'jezero_crater';

    if (elevationGrid && elevationGrid.length > 1 && elevationGrid[0]?.length > 1) {
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

      const sampleDem = (u: number, v: number): number => {
        const cx = Math.max(0, Math.min(cols - 1, u * (cols - 1)));
        const cy = Math.max(0, Math.min(rows - 1, v * (rows - 1)));
        const x0 = Math.floor(cx);
        const y0 = Math.floor(cy);
        const x1 = Math.min(cols - 1, x0 + 1);
        const y1 = Math.min(rows - 1, y0 + 1);
        const tx = cx - x0;
        const ty = cy - y0;
        return (
          (elevationGrid[y0][x0] * (1 - tx) + elevationGrid[y0][x1] * tx) * (1 - ty) +
          (elevationGrid[y1][x0] * (1 - tx) + elevationGrid[y1][x1] * tx) * ty
        );
      };

      // Directional hillshading light vector (NW sun azimuth)
      const lx = -0.62;
      const ly = -0.56;
      const lz = 0.55;
      const metersPerPx = 600 / size;
      const reliefExaggeration = 2.6;

      const img = octx.createImageData(size, size);
      const eps = 1 / size;

      for (let py = 0; py < size; py++) {
        const vCoord = py / (size - 1);
        const vU = Math.max(0, vCoord - eps);
        const vD = Math.min(1, vCoord + eps);
        for (let px = 0; px < size; px++) {
          const uCoord = px / (size - 1);
          const uL = Math.max(0, uCoord - eps);
          const uR = Math.min(1, uCoord + eps);

          const elev = sampleDem(uCoord, vCoord);
          const norm = Math.max(0, Math.min(1, (elev - minE) / range));

          // Surface normal via central differences for crisp slope shading
          const dzdx = ((sampleDem(uR, vCoord) - sampleDem(uL, vCoord)) / (2 * metersPerPx)) * reliefExaggeration;
          const dzdy = ((sampleDem(uCoord, vD) - sampleDem(uCoord, vU)) / (2 * metersPerPx)) * reliefExaggeration;
          const invLen = 1 / Math.hypot(-dzdx, -dzdy, 1);
          const shadeDot = Math.max(0, (-dzdx * lx + -dzdy * ly + lz) * invLen);
          const hillshade = 0.62 + shadeDot * 0.62; // range ~[0.62, 1.24]

          let red = 18;
          let green = 14;
          let blue = 13;
          if (isJezero) {
            // Jezero Crater: Deep slate-basalt lakebed -> ochre delta -> warm regolith rim
            if (norm < 0.35) {
              const t = norm / 0.35;
              red = 12 + t * 15;
              green = 16 + t * 14;
              blue = 22 + t * 9;
            } else if (norm < 0.68) {
              const t = (norm - 0.35) / 0.33;
              red = 27 + t * 38;
              green = 30 + t * 16;
              blue = 31 - t * 8;
            } else {
              const t = (norm - 0.68) / 0.32;
              red = 65 + t * 38;
              green = 46 + t * 18;
              blue = 23 + t * 10;
            }
          } else {
            // Procedural terrain: Matte volcanic basalt -> rust highlands
            if (norm < 0.5) {
              const t = norm / 0.5;
              red = 14 + t * 20;
              green = 11 + t * 13;
              blue = 11 + t * 9;
            } else {
              const t = (norm - 0.5) / 0.5;
              red = 34 + t * 28;
              green = 24 + t * 15;
              blue = 20 + t * 10;
            }
          }

          const idx = (py * size + px) * 4;
          img.data[idx] = Math.min(255, Math.max(0, Math.round(red * hillshade)));
          img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(green * hillshade)));
          img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(blue * hillshade)));
          img.data[idx + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);

      // Iso-elevation contour lines via marching squares directly from DEM
      if (layerContours) {
        const res = 110;
        const field = new Float32Array((res + 1) * (res + 1));
        for (let gy = 0; gy <= res; gy++) {
          const vc = gy / res;
          for (let gx = 0; gx <= res; gx++) {
            field[gy * (res + 1) + gx] = sampleDem(gx / res, vc);
          }
        }

        const levels = 11;
        const stepPx = size / res;
        const interp = (a: number, b: number, level: number): number => {
          const denom = b - a;
          if (Math.abs(denom) < 1e-5) return 0.5;
          return Math.max(0, Math.min(1, (level - a) / denom));
        };

        for (let l = 1; l < levels; l++) {
          const level = minE + (range * l) / levels;
          const isIndexContour = l % 3 === 0;
          octx.strokeStyle = isIndexContour
            ? isJezero
              ? 'rgba(229, 169, 60, 0.28)'
              : 'rgba(210, 153, 34, 0.22)'
            : isJezero
              ? 'rgba(210, 153, 34, 0.12)'
              : 'rgba(180, 130, 90, 0.11)';
          octx.lineWidth = isIndexContour ? 1.1 : 0.7;
          octx.beginPath();

          for (let gy = 0; gy < res; gy++) {
            for (let gx = 0; gx < res; gx++) {
              const v0 = field[gy * (res + 1) + gx];
              const v1 = field[gy * (res + 1) + gx + 1];
              const v2 = field[(gy + 1) * (res + 1) + gx + 1];
              const v3 = field[(gy + 1) * (res + 1) + gx];
              const mask =
                (v0 >= level ? 8 : 0) |
                (v1 >= level ? 4 : 0) |
                (v2 >= level ? 2 : 0) |
                (v3 >= level ? 1 : 0);
              if (mask === 0 || mask === 15) continue;

              const x = gx * stepPx;
              const y = gy * stepPx;
              const top = [x + interp(v0, v1, level) * stepPx, y];
              const right = [x + stepPx, y + interp(v1, v2, level) * stepPx];
              const bottom = [x + interp(v3, v2, level) * stepPx, y + stepPx];
              const left = [x, y + interp(v0, v3, level) * stepPx];

              const seg = (pA: number[], pB: number[]) => {
                octx.moveTo(pA[0], pA[1]);
                octx.lineTo(pB[0], pB[1]);
              };

              switch (mask) {
                case 1:
                case 14:
                  seg(left, bottom);
                  break;
                case 2:
                case 13:
                  seg(bottom, right);
                  break;
                case 3:
                case 12:
                  seg(left, right);
                  break;
                case 4:
                case 11:
                  seg(top, right);
                  break;
                case 5:
                  seg(left, top);
                  seg(bottom, right);
                  break;
                case 6:
                case 9:
                  seg(top, bottom);
                  break;
                case 7:
                case 8:
                  seg(left, top);
                  break;
                case 10:
                  seg(top, right);
                  seg(left, bottom);
                  break;
              }
            }
          }
          octx.stroke();
        }
      }
    } else {
      octx.fillStyle = isJezero ? '#10161C' : '#120E0D';
      octx.fillRect(0, 0, size, size);
    }

    return offscreen;
  }, [terrainPreset, terrainVersion, elevationGrid?.length, elevationGrid?.[0]?.[0], layerContours]);

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

    // Tactical Coordinate Grid: 50m minor + 100m major lines with crisp border ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.8;
    for (let gx = 50; gx < worldW; gx += 100) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(gx), toCanvasY(0));
      ctx.lineTo(toCanvasX(gx), toCanvasY(worldH));
      ctx.stroke();
    }
    for (let gy = 50; gy < worldH; gy += 100) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), toCanvasY(gy));
      ctx.lineTo(toCanvasX(worldW), toCanvasY(gy));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 100; gx < worldW; gx += 100) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(gx), toCanvasY(0));
      ctx.lineTo(toCanvasX(gx), toCanvasY(worldH));
      ctx.stroke();
    }
    for (let gy = 100; gy < worldH; gy += 100) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), toCanvasY(gy));
      ctx.lineTo(toCanvasX(worldW), toCanvasY(gy));
      ctx.stroke();
    }

    // World Boundary Frame & Edge Coordinate Ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(toCanvasX(0), toCanvasY(0), worldW * scale, worldH * scale);

    ctx.fillStyle = 'rgba(161, 161, 170, 0.65)';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    for (let gx = 100; gx < worldW; gx += 100) {
      const cx = toCanvasX(gx);
      ctx.beginPath();
      ctx.moveTo(cx, toCanvasY(0));
      ctx.lineTo(cx, toCanvasY(0) + 5);
      ctx.stroke();
      ctx.fillText(`${gx}`, cx + 3, toCanvasY(0) + 10);
    }
    for (let gy = 100; gy < worldH; gy += 100) {
      const cy = toCanvasY(gy);
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), cy);
      ctx.lineTo(toCanvasX(0) + 5, cy);
      ctx.stroke();
      ctx.fillText(`${gy}`, toCanvasX(0) + 7, cy + 3);
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

    // 4. Injected / Detected Obstacles (ROCK_FIELD, CRATER, SAND_TRAP)
    if (state.terrain_summary.injected_hazards) {
      for (const hz of state.terrain_summary.injected_hazards) {
        ctx.save();
        const hx = toCanvasX(hz.x);
        const hy = toCanvasY(hz.y);
        const hrad = toWorldDist(hz.radius);
        const hzType = hz.type || 'ROCK_FIELD';

        if (hzType === 'CRATER') {
          // Shaded outer rim + darker recessed inner basin ring
          const rimGrad = ctx.createRadialGradient(
            hx - hrad * 0.18,
            hy - hrad * 0.18,
            hrad * 0.2,
            hx,
            hy,
            hrad * 1.05
          );
          rimGrad.addColorStop(0, '#050507');
          rimGrad.addColorStop(0.58, 'rgba(14, 14, 18, 0.94)');
          rimGrad.addColorStop(0.84, 'rgba(92, 92, 102, 0.42)');
          rimGrad.addColorStop(1, 'rgba(63, 63, 70, 0)');
          ctx.fillStyle = rimGrad;
          ctx.beginPath();
          ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
          ctx.fill();

          // Outer crater rim highlight arc (NW lit) & shadow arc (SE)
          ctx.strokeStyle = 'rgba(161, 161, 170, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(hx, hy, hrad * 0.96, Math.PI * 0.85, Math.PI * 1.85);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(24, 24, 27, 0.9)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(hx, hy, hrad * 0.96, -Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();

          // Recessed inner basin ring + caution ring
          ctx.strokeStyle = 'rgba(248, 81, 73, 0.48)';
          ctx.lineWidth = 1.1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(hx, hy, hrad * 0.56, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#E4E4E7';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('! CRATER', hx, hy - hrad - 5);
        } else if (hzType === 'SAND_TRAP') {
          // Warm amber dashed perimeter + parallel dune ripple lines clipped inside
          const sandGrad = ctx.createRadialGradient(hx, hy, 2, hx, hy, hrad);
          sandGrad.addColorStop(0, 'rgba(217, 119, 6, 0.28)');
          sandGrad.addColorStop(0.8, 'rgba(217, 119, 6, 0.12)');
          sandGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
          ctx.fillStyle = sandGrad;
          ctx.beginPath();
          ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(hx, hy, hrad * 0.88, 0, Math.PI * 2);
          ctx.clip();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.48)';
          ctx.lineWidth = 1.1;
          const rippleSpacing = Math.max(4, hrad * 0.28);
          for (let dy = -hrad * 0.72; dy <= hrad * 0.72; dy += rippleSpacing) {
            ctx.beginPath();
            ctx.moveTo(hx - hrad, hy + dy);
            ctx.quadraticCurveTo(hx - hrad * 0.35, hy + dy - rippleSpacing * 0.35, hx, hy + dy);
            ctx.quadraticCurveTo(hx + hrad * 0.35, hy + dy + rippleSpacing * 0.35, hx + hrad, hy + dy);
            ctx.stroke();
          }
          ctx.restore();

          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#F59E0B';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('! SAND TRAP', hx, hy - hrad - 5);
        } else {
          // ROCK_FIELD: Subtle caution fill + clustered angular rock silhouettes
          const hzGrad = ctx.createRadialGradient(hx, hy, 2, hx, hy, hrad);
          hzGrad.addColorStop(0, 'rgba(248, 81, 73, 0.24)');
          hzGrad.addColorStop(0.75, 'rgba(248, 81, 73, 0.08)');
          hzGrad.addColorStop(1, 'rgba(248, 81, 73, 0)');
          ctx.fillStyle = hzGrad;
          ctx.beginPath();
          ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
          ctx.fill();

          const rockOffsets = [
            { dx: -0.32, dy: -0.22, s: 0.24, rot: 0.2 },
            { dx: 0.28, dy: -0.26, s: 0.2, rot: 1.1 },
            { dx: 0.04, dy: 0.06, s: 0.27, rot: 2.3 },
            { dx: -0.3, dy: 0.3, s: 0.19, rot: 0.7 },
            { dx: 0.34, dy: 0.24, s: 0.22, rot: 1.8 },
          ];
          for (const rk of rockOffsets) {
            const rxp = hx + rk.dx * hrad;
            const ryp = hy + rk.dy * hrad;
            const rs = Math.max(3, rk.s * hrad);
            ctx.beginPath();
            const verts = 5;
            for (let v = 0; v < verts; v++) {
              const a = rk.rot + (v * Math.PI * 2) / verts;
              const rMult = v % 2 === 0 ? 1.0 : 0.72;
              const vx = rxp + Math.cos(a) * rs * rMult;
              const vy = ryp + Math.sin(a) * rs * rMult;
              if (v === 0) ctx.moveTo(vx, vy);
              else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            ctx.fillStyle = '#451A1A';
            ctx.fill();
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          ctx.strokeStyle = 'rgba(248, 81, 73, 0.78)';
          ctx.lineWidth = 1.3;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(hx, hy, hrad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#F85149';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`! ${hzType}`, hx, hy - hrad - 5);
        }
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

    // Target (Animated Aerospace Reticle with Dynamic Coordinates)
    ctx.save();
    const tx = toCanvasX(targetPos[0]);
    const ty = toCanvasY(targetPos[1]);
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.0045);

    ctx.strokeStyle = `rgba(46, 160, 67, ${0.22 + pulse * 0.32})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(tx, ty, 13 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#2EA043';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(tx, ty, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx - 14, ty);
    ctx.lineTo(tx - 5, ty);
    ctx.moveTo(tx + 5, ty);
    ctx.lineTo(tx + 14, ty);
    ctx.moveTo(tx, ty - 14);
    ctx.lineTo(tx, ty - 5);
    ctx.moveTo(tx, ty + 5);
    ctx.lineTo(tx, ty + 14);
    ctx.stroke();

    ctx.fillStyle = '#2EA043';
    ctx.beginPath();
    ctx.arc(tx, ty, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4ADE80';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`TARGET (${Math.round(targetPos[0])}, ${Math.round(targetPos[1])})`, tx, ty - 19);
    ctx.restore();

    // 6. Trajectories
    // 6a. Historical Breadcrumb Track (Dashed Traversed Trail)
    if (state.routes.breadcrumb_history && state.routes.breadcrumb_history.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toCanvasX(state.routes.breadcrumb_history[0].x), toCanvasY(state.routes.breadcrumb_history[0].y));
      for (let i = 1; i < state.routes.breadcrumb_history.length; i++) {
        ctx.lineTo(toCanvasX(state.routes.breadcrumb_history[i].x), toCanvasY(state.routes.breadcrumb_history[i].y));
      }
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
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

    // 6c. Active Planned Safe Route (Crisp Glowing Telemetry Path + Waypoints)
    if (state.routes.current_planned && state.routes.current_planned.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toCanvasX(state.routes.current_planned[0][0]), toCanvasY(state.routes.current_planned[0][1]));
      for (let i = 1; i < state.routes.current_planned.length; i++) {
        ctx.lineTo(toCanvasX(state.routes.current_planned[i][0]), toCanvasY(state.routes.current_planned[i][1]));
      }
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.24)';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.strokeStyle = '#58A6FF';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = 1; i < state.routes.current_planned.length; i++) {
        const pt = state.routes.current_planned[i];
        const px = toCanvasX(pt[0]);
        const py = toCanvasY(pt[1]);
        ctx.fillStyle = '#09090B';
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E6EDF3';
        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, Math.PI * 2);
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

    // 7a. Forward Sensor / LiDAR Scan Cone
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(heading);
    const fovLen = toWorldDist(50);
    const fovAngle = Math.PI * 0.4;

    const fovGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, fovLen);
    fovGrad.addColorStop(0, 'rgba(88, 166, 255, 0.22)');
    fovGrad.addColorStop(0.65, 'rgba(88, 166, 255, 0.08)');
    fovGrad.addColorStop(1, 'rgba(88, 166, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, fovLen, -fovAngle / 2, fovAngle / 2);
    ctx.closePath();
    ctx.fillStyle = fovGrad;
    ctx.fill();

    // Crisp outer scan wedge + range arcs
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.34)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88, 166, 255, 0.22)';
    ctx.setLineDash([2, 3]);
    for (const rFrac of [0.5, 0.82]) {
      ctx.beginPath();
      ctx.arc(0, 0, fovLen * rFrac, -fovAngle / 2, fovAngle / 2);
      ctx.stroke();
    }
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
      // Peer-to-peer Swarm Mesh Comms Links
      if (state.swarm_links && state.swarm_links.length > 0) {
        for (const link of state.swarm_links) {
          const ax = toCanvasX(link.from_pos[0]);
          const ay = toCanvasY(link.from_pos[1]);
          const bx = toCanvasX(link.to_pos[0]);
          const by = toCanvasY(link.to_pos[1]);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.stroke();

          ctx.fillStyle = 'rgba(161, 161, 170, 0.75)';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${link.distance_m}m`, (ax + bx) / 2, (ay + by) / 2 - 4);
          ctx.restore();
        }
      }

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

        // Swarm Rover Label & Unit Badge (R1, R2, R3)
        ctx.save();
        const tag = sr.unit_tag ? `${sr.unit_tag} · ` : '';
        ctx.fillStyle = srColor;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${tag}${sr.callsign.toUpperCase()} [${sr.role.toUpperCase()}]`, srX, srY - 14);

        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#A1A1AA';
        const satTag = sr.assigned_satellite_id ? `SAT: ${sr.assigned_satellite_id}` : 'MESH DR';
        ctx.fillText(`±${sr.uncertainty_m.toFixed(1)}m | ${sr.speed.toFixed(1)}m/s | ${satTag}`, srX, srY + 18);
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(heading);

      // Six rocker-bogie wheel pods
      ctx.fillStyle = '#09090B';
      ctx.strokeStyle = '#52525B';
      ctx.lineWidth = 0.9;
      const wheelPositions = [
        [-6.5, -8.5], [0, -8.5], [6.5, -8.5],
        [-6.5, 6.5], [0, 6.5], [6.5, 6.5],
      ];
      for (const [wx, wy] of wheelPositions) {
        ctx.fillRect(wx - 2.3, wy, 4.6, 2);
        ctx.strokeRect(wx - 2.3, wy, 4.6, 2);
      }

      // Aerospace directional chevron chassis
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -6.5);
      ctx.lineTo(-3.5, 0);
      ctx.lineTo(-6, 6.5);
      ctx.closePath();
      ctx.fillStyle = '#18181B';
      ctx.fill();
      ctx.strokeStyle = '#58A6FF';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Nose mast & status core LED
      ctx.fillStyle = '#F85149';
      ctx.beginPath();
      ctx.arc(8.5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = state.ekf?.fallback_active ? '#F85149' : '#2EA043';
      ctx.beginPath();
      ctx.arc(-0.5, 0, 2.2, 0, Math.PI * 2);
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

    // 10. Subtle Target Retask Crosshair Ripple
    if (targetRipple) {
      const rx = toCanvasX(targetRipple.x);
      const ry = toCanvasY(targetRipple.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 244, 245, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(rx, ry, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx - 18, ry);
      ctx.lineTo(rx - 6, ry);
      ctx.moveTo(rx + 6, ry);
      ctx.lineTo(rx + 18, ry);
      ctx.moveTo(rx, ry - 18);
      ctx.lineTo(rx, ry - 6);
      ctx.moveTo(rx, ry + 6);
      ctx.lineTo(rx, ry + 18);
      ctx.stroke();
      ctx.restore();
    }

    // 11. Screen-Space Tactical North Indicator (Bottom-Left above LIVE pill) & Scale Bar (Bottom-Right above hint pill)
    // 11a. Minimal Monochrome North ('N') Compass Indicator
    const compX = 28;
    const compY = Math.max(90, viewH - 104);
    ctx.save();
    ctx.fillStyle = 'rgba(12, 12, 14, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(compX, compY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // North arrow pointer
    ctx.fillStyle = '#F4F4F5';
    ctx.beginPath();
    ctx.moveTo(compX, compY - 9);
    ctx.lineTo(compX - 3.5, compY - 1);
    ctx.lineTo(compX, compY - 2.8);
    ctx.lineTo(compX + 3.5, compY - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#A1A1AA';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', compX, compY + 7.5);
    ctx.restore();

    // 11b. Crisp Aerospace Scale Bar
    const scaleBarMeters = scale * 100 > 130 ? 50 : scale * 100 < 55 ? 200 : 100;
    const barWidthPx = scaleBarMeters * scale;
    const sbRight = viewW - 14;
    const sbLeft = sbRight - barWidthPx;
    const sbY = Math.max(95, viewH - 94);

    ctx.save();
    ctx.strokeStyle = 'rgba(228, 228, 231, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sbLeft, sbY - 5);
    ctx.lineTo(sbLeft, sbY);
    ctx.lineTo(sbRight, sbY);
    ctx.lineTo(sbRight, sbY - 5);
    ctx.moveTo(sbLeft + barWidthPx / 2, sbY - 3);
    ctx.lineTo(sbLeft + barWidthPx / 2, sbY);
    ctx.stroke();

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${scaleBarMeters}m`, sbRight, sbY - 7);
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
    targetRipple,
  ]);

  // Auto-clear target ripple after brief visual pulse
  useEffect(() => {
    if (!targetRipple) return;
    const timer = window.setTimeout(() => setTargetRipple(null), 700);
    return () => clearTimeout(timer);
  }, [targetRipple]);

  // Pan, Zoom & Click-to-Set-Target Event Handlers
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

      onInjectHazard(worldX, worldY, undefined, selectedHazardType);
      return;
    }

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
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

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    if (
      !isHazardModeActive &&
      onSetTarget &&
      pointerDownPosRef.current &&
      state &&
      canvasRef.current
    ) {
      const moveDist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      if (moveDist <= 4) {
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

        if (worldX >= 0 && worldX <= worldW && worldY >= 0 && worldY <= worldH) {
          setTargetRipple({ x: worldX, y: worldY, ts: Date.now() });
          onSetTarget(worldX, worldY);
        }
      }
    }
    pointerDownPosRef.current = null;
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
          onMouseLeave={() => {
            setIsDragging(false);
            setHoverCoord(null);
            pointerDownPosRef.current = null;
          }}
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
          {hoverTelemetry && (
            <>
              <span className="text-[#222226]">·</span>
              <span className="text-[#A1A1AA] tabular-nums">
                ({hoverTelemetry.x}, {hoverTelemetry.y})m
                {hoverTelemetry.elev !== null && hoverTelemetry.slopeDeg !== null && (
                  <span className="text-[#71717A]">
                    {' '}
                    · Z {hoverTelemetry.elev >= 0 ? '+' : ''}
                    {hoverTelemetry.elev.toFixed(1)}m · {hoverTelemetry.slopeDeg.toFixed(1)}°
                  </span>
                )}
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

        {/* Live Engine & Command Indicator + Retask Hint (Bottom-Left above dock) */}
        <div className="absolute bottom-14 left-3 z-20 flex items-center gap-2 px-2.5 py-1 bg-[#0C0C0E]/80 backdrop-blur-md border border-[#222226] rounded-md font-mono text-[10px] text-[#A1A1AA] pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#F4F4F5] font-medium">LIVE</span>
          <span className="text-[#222226]">·</span>
          <span>WS 20Hz</span>
          <span className="text-[#222226]">·</span>
          <span className="text-[#F4F4F5] truncate max-w-[210px]">{lastCommand}</span>
        </div>

        <div className="absolute bottom-14 right-3 z-20 hidden sm:block px-2.5 py-1 bg-[#0C0C0E]/75 backdrop-blur-md border border-[#222226] rounded-md text-[10px] text-[#71717A] pointer-events-none">
          Click map to retask rover
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
      </div>
    </div>
  );
};
