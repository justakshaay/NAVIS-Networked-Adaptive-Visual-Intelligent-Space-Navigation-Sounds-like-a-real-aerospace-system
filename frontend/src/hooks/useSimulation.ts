import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationFullState, BenchmarkComparisonResult } from '../types/simulation';

export interface TimelineEventMarker {
  id: string;
  type: 'HAZARD' | 'OUTAGE' | 'STORM' | 'REPLAN' | 'SWARM';
  label: string;
  sim_time: number;
  frameIndex: number;
  color: string;
}

export function useSimulation() {
  const [liveState, setLiveState] = useState<SimulationFullState | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkComparisonResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);

  // Black-Box Telemetry Ring Buffer (up to 1,200 frames / 60 seconds at 20Hz)
  const telemetryBufferRef = useRef<SimulationFullState[]>([]);
  const [bufferLength, setBufferLength] = useState<number>(0);
  const [events, setEvents] = useState<TimelineEventMarker[]>([]);

  // Scrub & Replay State
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [lastCommand, setLastCommand] = useState<string>('Standby');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef<number>(1500);
  const isUnmountedRef = useRef<boolean>(false);

  // Dynamic API & WS Base Resolution (supports separate Vercel frontend + Render backend via VITE_API_URL / VITE_WS_URL)
  const rawApiEnv = (import.meta.env.VITE_API_URL || '').trim();
  const apiBase = (
    rawApiEnv ||
    (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://127.0.0.1:8000' : '')
  ).replace(/\/+$/, '');

  // Process incoming simulation snapshot
  const processNewSnapshot = useCallback((data: SimulationFullState) => {
    setLiveState(data);

    const buf = telemetryBufferRef.current;
    const prev = buf.length > 0 ? buf[buf.length - 1] : null;

    // Detect simulation reset (sim_time jumped backwards or reset to 0)
    if (prev && (data.sim_time < prev.sim_time || (data.sim_time === 0 && prev.sim_time > 0))) {
      buf.length = 0;
      setEvents([]);
      setIsReplaying(false);
      setReplayIndex(0);
      setIsReplayPlaying(false);
    }

    buf.push(data);
    if (buf.length > 1200) {
      buf.shift();
    }
    setBufferLength(buf.length);

    // Event detection markers
    if (prev) {
      // 1. Hazard Injected
      const prevHz = prev.terrain_summary?.injected_hazards?.length ?? 0;
      const currHz = data.terrain_summary?.injected_hazards?.length ?? 0;
      if (currHz > prevHz) {
        setEvents((evts) => [
          ...evts.slice(-30),
          {
            id: `hz-${Date.now()}`,
            type: 'HAZARD',
            label: 'HAZARD INJECTED',
            sim_time: data.sim_time,
            frameIndex: buf.length - 1,
            color: '#D29922',
          },
        ]);
      }

      // 2. Outage Injected
      const prevOutage = prev.satellites.some((s) => s.is_outage);
      const currOutage = data.satellites.some((s) => s.is_outage);
      if (currOutage && !prevOutage) {
        setEvents((evts) => [
          ...evts.slice(-30),
          {
            id: `out-${Date.now()}`,
            type: 'OUTAGE',
            label: 'SATELLITE OUTAGE',
            sim_time: data.sim_time,
            frameIndex: buf.length - 1,
            color: '#F85149',
          },
        ]);
      }

      // 3. Dust Storm Hit
      const prevStorm = prev.dust_storm?.active ?? false;
      const currStorm = data.dust_storm?.active ?? false;
      if (currStorm && !prevStorm) {
        setEvents((evts) => [
          ...evts.slice(-30),
          {
            id: `stm-${Date.now()}`,
            type: 'STORM',
            label: 'DUST STORM HIT',
            sim_time: data.sim_time,
            frameIndex: buf.length - 1,
            color: '#F59E0B',
          },
        ]);
      }

      // 4. Swarm Deployed
      const prevSwarm = prev.swarm_mode_enabled ?? false;
      const currSwarm = data.swarm_mode_enabled ?? false;
      if (currSwarm && !prevSwarm) {
        setEvents((evts) => [
          ...evts.slice(-30),
          {
            id: `swm-${Date.now()}`,
            type: 'SWARM',
            label: 'SWARM DEPLOYED',
            sim_time: data.sim_time,
            frameIndex: buf.length - 1,
            color: '#BC8CFF',
          },
        ]);
      }
    }
  }, []);

  // Resolve WebSocket URL cleanly for Vercel+Render, single-origin Docker, and local dev
  const resolveWsUrl = useCallback(() => {
    const rawWsEnv = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '');
    if (rawWsEnv) {
      const normalized = rawWsEnv
        .replace(/^https:\/\//i, 'wss://')
        .replace(/^http:\/\//i, 'ws://');
      return normalized.endsWith('/ws/simulation') ? normalized : `${normalized}/ws/simulation`;
    }
    if (apiBase) {
      return `${apiBase.replace(/^http/i, 'ws')}/ws/simulation`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/simulation`;
  }, [apiBase]);

  // Connect to WebSocket with capped exponential backoff (1.5s -> 3s -> 5s)
  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const wsUrl = resolveWsUrl();

    const scheduleReconnect = () => {
      if (isUnmountedRef.current) return;
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = delay < 3000 ? 3000 : 5000;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWs();
      }, delay);
    };

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 1500;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: SimulationFullState = JSON.parse(event.data);
          processNewSnapshot(data);
        } catch (err) {
          console.error('Error parsing simulation WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        setConnected(false);
        ws.close();
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      scheduleReconnect();
    }
  }, [resolveWsUrl, processNewSnapshot]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWs();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  // Fallback REST polling if WS is disconnected
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/simulation/state`);
        if (res.ok) {
          const data = await res.json();
          processNewSnapshot(data);
        }
      } catch {
        // server might still be booting
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [connected, apiBase, processNewSnapshot]);

  // Replay playback timer
  useEffect(() => {
    if (!isReplaying || !isReplayPlaying) return;
    const interval = setInterval(() => {
      setReplayIndex((idx) => {
        if (idx >= telemetryBufferRef.current.length - 1) {
          setIsReplayPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, 50); // 20 Hz step
    return () => clearInterval(interval);
  }, [isReplaying, isReplayPlaying]);

  // Scrub and Replay controls
  const scrubTo = useCallback((index: number) => {
    setIsReplaying(true);
    setReplayIndex(Math.max(0, Math.min(telemetryBufferRef.current.length - 1, index)));
  }, []);

  const returnToLive = useCallback(() => {
    setIsReplaying(false);
    setIsReplayPlaying(false);
  }, []);

  const toggleReplayPlay = useCallback(() => {
    setIsReplayPlaying((p) => !p);
  }, []);

  // Effective state: historical frame when replaying, live frame otherwise
  const state: SimulationFullState | null = isReplaying
    ? telemetryBufferRef.current[replayIndex] || liveState
    : liveState;

  // Send Command Helper
  const sendCommand = useCallback((cmd: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    } else {
      // Fallback REST POST
      const actionMap: Record<string, string> = {
        start: '/api/simulation/start',
        pause: '/api/simulation/pause',
        reset: '/api/simulation/reset',
        outage: '/api/satellite/outage',
        restore: '/api/satellite/restore',
        demo: '/api/demo/run',
      };
      if (actionMap[cmd.action]) {
        fetch(`${apiBase}${actionMap[cmd.action]}`, { method: 'POST' });
      }
    }
  }, [apiBase]);

  const startMission = useCallback(() => sendCommand({ action: 'start' }), [sendCommand]);
  const pauseMission = useCallback(() => sendCommand({ action: 'pause' }), [sendCommand]);
  const resetMission = useCallback((seed?: number) => {
    const validSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : undefined;

    // Immediately clear ReplayBar buffer & exit scrubbing so UI reflects reset right away
    telemetryBufferRef.current = [];
    setBufferLength(0);
    setEvents([]);
    setIsReplaying(false);
    setReplayIndex(0);
    setIsReplayPlaying(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(validSeed !== undefined ? { action: 'reset', seed: validSeed } : { action: 'reset' })
      );
    } else {
      const url = validSeed !== undefined ? `${apiBase}/api/simulation/reset?seed=${validSeed}` : `${apiBase}/api/simulation/reset`;
      fetch(url, { method: 'POST' })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);
  const setSpeed = useCallback((multiplier: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'speed', multiplier }));
    } else {
      fetch(`${apiBase}/api/simulation/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      }).catch(() => {});
    }
  }, [apiBase]);

  const setMode = useCallback((mode: 'MODE_A' | 'MODE_B' | 'MODE_C') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'mode', mode }));
    } else {
      fetch(`${apiBase}/api/simulation/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      }).catch(() => {});
    }
  }, [apiBase]);

  const simulateOutage = useCallback(() => {
    setLastCommand('Sat Outage triggered');
    sendCommand({ action: 'outage' });
  }, [sendCommand]);

  const restoreSatellite = useCallback(() => {
    setLastCommand('Sat Link restored');
    sendCommand({ action: 'restore' });
  }, [sendCommand]);

  const setTarget = useCallback((x: number, y: number) => {
    const tx = Math.round(x);
    const ty = Math.round(y);
    setLastCommand(`Target (${tx}, ${ty}) · A* replan`);

    // Optimistically update target marker immediately
    setLiveState((prev) => {
      if (!prev || !prev.terrain_summary) return prev;
      return {
        ...prev,
        terrain_summary: {
          ...prev.terrain_summary,
          target_pos: [x, y],
        },
      };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'set_target', x, y }));
    } else {
      fetch(`${apiBase}/api/simulation/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);

  const injectHazard = useCallback((x: number, y: number, radius?: number, type = 'ROCK_FIELD') => {
    const defaultRadii: Record<string, number> = {
      ROCK_FIELD: 28.0,
      CRATER: 35.0,
      SAND_TRAP: 32.0,
    };
    const resolvedRadius = radius ?? defaultRadii[type] ?? 28.0;
    setLastCommand(`${type} (${Math.round(x)}, ${Math.round(y)}) · A* replan`);
    // Optimistically render the injected hazard immediately before WebSocket confirmation arrives
    setLiveState((prev) => {
      if (!prev || !prev.terrain_summary) return prev;
      const optimisticHazard = {
        id: `HZ-OPT-${Date.now()}`,
        x,
        y,
        radius: resolvedRadius,
        type,
      };
      return {
        ...prev,
        terrain_summary: {
          ...prev.terrain_summary,
          injected_hazards: [...(prev.terrain_summary.injected_hazards || []), optimisticHazard],
        },
      };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'inject_hazard', x, y, radius: resolvedRadius, type }));
    } else {
      fetch(`${apiBase}/api/hazard/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, radius: resolvedRadius, hazard_type: type }),
      })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);

  const clearHazards = useCallback(() => {
    setLastCommand('Obstacles cleared · A* replan');
    setLiveState((prev) => {
      if (!prev || !prev.terrain_summary) return prev;
      return {
        ...prev,
        terrain_summary: {
          ...prev.terrain_summary,
          injected_hazards: [],
        },
      };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear_hazards' }));
    } else {
      fetch(`${apiBase}/api/simulation/clear_hazards`, { method: 'POST' })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);

  const generateNewMap = useCallback((seed?: number) => {
    const validSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : undefined;
    telemetryBufferRef.current = [];
    setBufferLength(0);
    setEvents([]);
    setIsReplaying(false);
    setReplayIndex(0);
    setIsReplayPlaying(false);
    setLastCommand('Generating new map...');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(validSeed !== undefined ? { action: 'generate_map', seed: validSeed } : { action: 'generate_map' })
      );
    } else {
      fetch(`${apiBase}/api/simulation/generate_map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: validSeed ?? null }),
      })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);

  const runDemo = useCallback(() => sendCommand({ action: 'demo' }), [sendCommand]);

  const toggleShadowRace = useCallback((enabled: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'toggle_shadow_race', enabled }));
    } else {
      fetch(`${apiBase}/api/simulation/shadow_race`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }).catch(() => {});
    }
  }, [apiBase]);

  const toggleSwarmMode = useCallback((enabled: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'toggle_swarm_mode', enabled }));
    } else {
      fetch(`${apiBase}/api/simulation/swarm_mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }).catch(() => {});
    }
  }, [apiBase]);

  const setTerrainPreset = useCallback((preset: 'procedural' | 'jezero_crater') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'set_terrain', preset }));
    } else {
      fetch(`${apiBase}/api/simulation/terrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })
        .then(() => fetch(`${apiBase}/api/simulation/state`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) processNewSnapshot(data);
        })
        .catch(() => {});
    }
  }, [apiBase, processNewSnapshot]);

  const toggleDustStorm = useCallback((enabled: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'toggle_dust_storm', enabled }));
    } else {
      fetch(`${apiBase}/api/simulation/dust_storm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }).catch(() => {});
    }
  }, [apiBase]);

  const runBenchmark = useCallback(async (seed = 42) => {
    setIsBenchmarking(true);
    try {
      const res = await fetch(`${apiBase}/api/benchmark/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed }),
      });
      if (res.ok) {
        const data: BenchmarkComparisonResult = await res.json();
        setBenchmarkResult(data);
      }
    } catch (e) {
      console.error('Failed to run benchmark:', e);
    } finally {
      setIsBenchmarking(false);
    }
  }, [apiBase]);

  return {
    state,
    liveState,
    connected,
    benchmarkResult,
    isBenchmarking,
    isReplaying,
    replayIndex,
    bufferLength,
    events,
    isReplayPlaying,
    telemetryBuffer: telemetryBufferRef.current,
    scrubTo,
    returnToLive,
    toggleReplayPlay,
    startMission,
    pauseMission,
    resetMission,
    setSpeed,
    setMode,
    simulateOutage,
    restoreSatellite,
    injectHazard,
    runDemo,
    toggleShadowRace,
    toggleSwarmMode,
    setTerrainPreset,
    toggleDustStorm,
    setTarget,
    clearHazards,
    generateNewMap,
    lastCommand: state?.last_command || lastCommand,
    runBenchmark,
    clearBenchmark: () => setBenchmarkResult(null),
  };
}
