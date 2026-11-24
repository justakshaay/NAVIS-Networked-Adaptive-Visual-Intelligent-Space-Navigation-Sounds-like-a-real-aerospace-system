"""
End-to-End WebSocket and API Simulation Verification for NAVIS
"""

import asyncio
import json
import websockets
import urllib.request


async def test_e2e_websocket():
    uri = "ws://127.0.0.1:8000/ws/simulation"
    print(f"Connecting to NAVIS WebSocket: {uri}...")

    async with websockets.connect(uri) as ws:
        # 1. Receive initial full state
        initial_msg = await ws.recv()
        state = json.loads(initial_msg)
        print(f"[OK] Connected! Mode: {state['active_mode']}, Sim Time: {state['sim_time']}s")
        print(f"[OK] Rover Start: ({state['rover']['x']}, {state['rover']['y']})")
        print(f"[OK] Satellites Count: {len(state['satellites'])}")
        assert len(state['satellites']) == 4

        # 2. Send 'start' and 'speed 2.0x'
        await ws.send(json.dumps({"action": "start"}))
        await ws.send(json.dumps({"action": "speed", "multiplier": 2.0}))
        print("[OK] Sent start & speed 2.0x commands.")

        # Receive 10 frames of motion
        for _ in range(10):
            msg = await ws.recv()
            state = json.loads(msg)

        print(f"[OK] Rover in motion: x={state['rover']['x']:.2f}, y={state['rover']['y']:.2f}, speed={state['rover']['speed']:.2f} m/s")
        assert state['rover']['speed'] > 0.0

        # 3. Simulate Satellite Outage
        await ws.send(json.dumps({"action": "outage"}))
        print("[OK] Injected Satellite Outage...")

        for _ in range(10):
            msg = await ws.recv()
            state = json.loads(msg)

        print(f"[OK] Outage active: fallback_active={state['ekf']['fallback_active']}, uncertainty={state['ekf']['uncertainty_m']:.2f}m")
        assert state['ekf']['fallback_active'] is True

        # 4. Restore Satellite
        await ws.send(json.dumps({"action": "restore"}))
        print("[OK] Restored Satellite...")

        for _ in range(10):
            msg = await ws.recv()
            state = json.loads(msg)

        print(f"[OK] PNT Restored: fallback_active={state['ekf']['fallback_active']}, uncertainty={state['ekf']['uncertainty_m']:.2f}m")
        assert state['ekf']['fallback_active'] is False

        # 5. Inject Hazard
        await ws.send(json.dumps({
            "action": "inject_hazard",
            "x": 240.0,
            "y": 230.0,
            "radius": 30.0,
            "type": "ROCK_FIELD"
        }))
        print("[OK] Injected dynamic Rock Field hazard at (240, 230)...")

        for _ in range(10):
            msg = await ws.recv()
            state = json.loads(msg)

        print(f"[OK] Replanned route waypoints: {len(state['routes']['current_planned'])}")
        assert len(state['routes']['current_planned']) > 0

        # 6. Trigger Demo Mission
        await ws.send(json.dumps({"action": "demo"}))
        print("[OK] Started automated Demo Mission...")

        for _ in range(15):
            msg = await ws.recv()
            state = json.loads(msg)

        demo_status = state['demo_mission']
        print(f"[OK] Demo Mission Active: {demo_status['is_active']}, Stage: {demo_status['current_stage_idx']+1}/{len(demo_status['stages'])}")
        assert demo_status['is_active'] is True

        # 7. Test Shadow Race (Mode A vs Mode C)
        await ws.send(json.dumps({"action": "toggle_shadow_race", "enabled": True}))
        print("[OK] Toggled Shadow Race ON via WebSocket...")

        # Receive 40 frames (~2 seconds of motion at 20Hz)
        for _ in range(40):
            msg = await ws.recv()
            state = json.loads(msg)

        assert state.get("shadow_race_enabled") is True
        assert state.get("is_running") is True, f"Simulation should be running automatically, got is_running={state.get('is_running')}"
        assert state.get("shadow_rover") is not None
        shadow = state["shadow_rover"]
        
        primary_x = state["rover"]["x"]
        primary_y = state["rover"]["y"]
        shadow_x = shadow["true_pos"][0]
        shadow_y = shadow["true_pos"][1]

        print(f"[OK] Mode C Primary Rover pos: ({primary_x:.2f}, {primary_y:.2f})")
        print(f"[OK] Mode A Shadow Rover pos:  ({shadow_x:.2f}, {shadow_y:.2f}), Error: {shadow['localization_error']:.2f}m")

        # Assert BOTH rovers actually moved away from origin (50.0, 50.0)
        assert (primary_x != 50.0 or primary_y != 50.0), f"Primary rover did not move: ({primary_x}, {primary_y})"
        assert (shadow_x != 50.0 or shadow_y != 50.0), f"Shadow rover did not move: ({shadow_x}, {shadow_y})"
        print("[OK] Verified BOTH rovers are actively moving in real-time across the terrain!")

        # Disable shadow race and reset
        await ws.send(json.dumps({"action": "toggle_shadow_race", "enabled": False}))
        print("[OK] Toggled Shadow Race OFF.")

        # 8. Test Jezero Crater Terrain Preset & Dynamic Dust Storm
        await ws.send(json.dumps({"action": "set_terrain", "preset": "jezero_crater"}))
        print("[OK] Switched Terrain Preset to 'jezero_crater' via WebSocket...")

        for _ in range(10):
            msg = await ws.recv()
            state = json.loads(msg)

        assert state.get("terrain_preset") == "jezero_crater"
        print(f"[OK] Verified active terrain preset: {state['terrain_preset']}")

        # Trigger Dust Storm Fault
        await ws.send(json.dumps({"action": "toggle_dust_storm", "enabled": True}))
        print("[OK] Injected Dynamic Moving Dust Storm via WebSocket...")

        for _ in range(20):
            msg = await ws.recv()
            state = json.loads(msg)

        assert state.get("dust_storm") is not None
        assert state["dust_storm"]["active"] is True
        print(f"[OK] Dust storm telemetry: active={state['dust_storm']['active']}, at ({state['dust_storm']['x']:.1f}, {state['dust_storm']['y']:.1f})")

        # Clear Dust Storm and restore procedural
        await ws.send(json.dumps({"action": "toggle_dust_storm", "enabled": False}))
        await ws.send(json.dumps({"action": "set_terrain", "preset": "procedural"}))
        print("[OK] Cleared dust storm and restored procedural terrain.")

        # 9. Test Multi-Rover Swarm Mode & Satellite Contention
        await ws.send(json.dumps({"action": "toggle_swarm_mode", "enabled": True}))
        print("[OK] Toggled Swarm Mode ON via WebSocket...")

        for _ in range(30):
            msg = await ws.recv()
            state = json.loads(msg)

        assert state.get("swarm_mode_enabled") is True
        assert state.get("is_running") is True
        assert "swarm_rovers" in state
        assert len(state["swarm_rovers"]) == 3
        print(f"[OK] Swarm telemetry received: {len(state['swarm_rovers'])} rovers live!")
        for sr in state["swarm_rovers"]:
            print(f"     - {sr['rover_id']} ({sr['callsign']} / {sr['role']}): pos=({sr['true_pos'][0]:.1f}, {sr['true_pos'][1]:.1f}), sat={sr['assigned_satellite_id']}")

        await ws.send(json.dumps({"action": "toggle_swarm_mode", "enabled": False}))
        print("[OK] Toggled Swarm Mode OFF.")

        # 10. Test Reset to Origin
        await ws.send(json.dumps({"action": "reset"}))
        for _ in range(5):
            msg = await ws.recv()
            state = json.loads(msg)

        assert state["sim_time"] == 0.0 or state["sim_time"] < 1.0
        assert state["shadow_rover"] is None
        assert len(state["swarm_rovers"]) == 0
        print("[OK] Reset verified: telemetry state cleanly returned to origin.")

    print("\n[SUCCESS] E2E WEBSOCKET & SIMULATION CONTROLS FULLY VERIFIED!")


if __name__ == "__main__":
    asyncio.run(test_e2e_websocket())
