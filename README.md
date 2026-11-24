# NAVIS — Networked Adaptive Visual Intelligent Space Navigation

Autonomous planetary rover GN&C (Guidance, Navigation & Control) mission-control and simulation platform for GPS-denied environments. NAVIS pairs a 20Hz Python/FastAPI physics and 8-state Extended Kalman Filter (EKF) backend with synchronized 2D tactical and 3D orbital viewports.

## Live Demo

- **Frontend (Vercel)**: https://navis-networked-adaptive-visual-int.vercel.app
- **Backend (Render)**: https://navis-networked-adaptive-visual.onrender.com

> **Note:** The free Render backend instance sleeps during inactivity and may take **~30–50s** to wake on a cold start. The UI displays a live connection status indicator and reconnects automatically via capped exponential backoff once the backend is ready.

---

## Key Features

- **2D Orbital Tactical Map (`frontend/src/components/MarsCanvas.tsx`)**
  - Offscreen-cached Martian hypsometric terrain supporting both the **Jezero Crater** preset and the seeded **Procedural Map Generator**.
  - High-contrast NW directional hillshading with marching-squares iso-elevation contours computed from the live DEM heightmap.
  - 50m/100m tactical coordinate grid with edge ticks, dynamic zoom-aware scale bar, and monochrome North (`N`) indicator.
  - Live cursor hover `(X, Y, Z, Slope)` terrain telemetry, forward LiDAR scan cone, directional rover chevron, animated target reticle, and click-to-retask navigation.

- **3D Martian Visualization (`frontend/src/components/Mars3DView.tsx`)**
  - Interactive Three.js / React Three Fiber (`@react-three/fiber`, `@react-three/drei`) 3D terrain heightmap mesh.
  - Balanced 3-point + Martian hemisphere lighting rig with `ACESFilmicToneMapping` and `2048×2048` directional shadow maps.
  - Unrestricted 360° `OrbitControls` with ground-plane panning, zoom limits, and one-click smooth **Reset View**.

- **Coordinated Multi-Agent Swarm Mode (`backend/simulation/engine.py`)**
  - 3-unit staggered wedge formation (`R1 LEAD`, `R2 FLANK-L`, `R3 FLANK-R`) with inter-rover separation and obstacle collision avoidance.
  - Peer-to-peer local mesh comms links (`240m` range) rendered in both 2D and 3D viewports, maintaining local coordination even during orbital blackouts.
  - Shared hazard intelligence that propagates newly encountered obstacles across the swarm so all units proactively replan.

- **Interactive Hazard Injection & GNC Capabilities**
  - Multi-type obstacle placement palette (**Rock Field**, **Crater**, **Sand Trap**) working seamlessly in both 2D and 3D views with real-time A* replanning and **Clear Hazards** reset.
  - 8-state EKF sensor fusion (Satellite PNT, 6-DOF IMU, slip-compensated Wheel Odometry, Visual Odometry) with 2σ covariance ellipses, **Shadow Race** (Mode A dead reckoning vs. Mode C NAVIS AI), moving **Dust Storms**, orbital blackout testing, and 1,200-frame black-box telemetry replay.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Three.js (`@react-three/fiber`, `@react-three/drei`), HTML5 Canvas, Tailwind CSS |
| **Backend** | Python, FastAPI, Uvicorn, WebSockets (20Hz real-time telemetry) |
| **Deployment** | Vercel (Frontend) + Render Docker Web Service (Backend) |

---

## Local Setup & Verification

### 1. Run the Backend
```bash
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Verification Commands
Run the backend unit tests, live WebSocket E2E test (against a running local backend on port `8000`), and frontend production build check:
```bash
# Backend core math & subsystem tests
python tests/test_backend.py

# Live 20Hz WebSocket E2E simulation test (with backend running)
python tests/test_e2e_ws.py

# Frontend TypeScript check & production build
cd frontend
npm run build
```

---

## Production Environment Variables (Frontend)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of the deployed FastAPI backend (trailing slash optional) | `https://navis-networked-adaptive-visual.onrender.com` |
| `VITE_WS_URL` | Optional explicit WebSocket endpoint (`wss://` auto-derived from `VITE_API_URL` if omitted) | `wss://navis-networked-adaptive-visual.onrender.com/ws/simulation` |
