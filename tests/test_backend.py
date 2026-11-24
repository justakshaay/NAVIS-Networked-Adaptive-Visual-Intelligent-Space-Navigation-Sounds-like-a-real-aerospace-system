"""
Unit and Integration verification tests for NAVIS backend.
"""

import sys
import os
import math

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.simulation.terrain import MarsTerrain
from backend.simulation.rover import MarsRover
from backend.simulation.satellites import SatelliteConstellation
from backend.navigation.sensors import SensorSuite
from backend.navigation.ekf import NAVIS_EKF
from backend.navigation.planner import AStarPlanner
from backend.ai.scheduler import AISatelliteScheduler
from backend.ai.trajectory import TrajectoryPredictor
from backend.ai.hazard_detector import VisualHazardDetector
from backend.simulation.modes import BenchmarkEvaluator, NavigationMode
from backend.simulation.engine import SimulationEngine


def test_terrain_and_planner():
    print("Testing MarsTerrain & A* Planner...")
    terrain = MarsTerrain(seed=42)
    assert terrain.grid_res == 60
    assert terrain.cost_grid.shape == (60, 60)
    assert terrain.get_cost(terrain.start_pos[0], terrain.start_pos[1]) == 1.0

    planner = AStarPlanner(terrain)
    path = planner.plan_path(terrain.start_pos, terrain.target_pos)
    assert len(path) >= 2
    assert path[0] == terrain.start_pos
    assert path[-1] == terrain.target_pos
    print(f"[OK] Path found with {len(path)} waypoints.")


def test_ekf_and_sensors():
    print("Testing SensorSuite & NAVIS_EKF...")
    sensors = SensorSuite(seed=42)
    ekf = NAVIS_EKF(start_x=50.0, start_y=50.0)

    # Step with PNT active
    meas_pnt = sensors.sample(
        dt=0.05,
        true_x=50.5,
        true_y=50.5,
        true_vx=1.0,
        true_vy=1.0,
        true_heading=0.78,
        true_speed=1.414,
        true_accel=0.2,
        true_omega=0.0,
        wheel_slip=0.02,
        pnt_available=True,
    )
    est = ekf.step(0.05, meas_pnt)
    assert est["pnt_active"] is True
    assert est["uncertainty_m"] < 1.5
    print(f"[OK] EKF PNT Step: est_x={est['est_x']:.2f}, uncertainty={est['uncertainty_m']:.2f}m")

    # Step with PNT Outage (fallback)
    meas_outage = sensors.sample(
        dt=0.05,
        true_x=51.0,
        true_y=51.0,
        true_vx=1.0,
        true_vy=1.0,
        true_heading=0.78,
        true_speed=1.414,
        true_accel=0.2,
        true_omega=0.0,
        wheel_slip=0.05,
        pnt_available=False,
    )
    est_outage = ekf.step(0.05, meas_outage)
    assert est_outage["fallback_active"] is True
    print(f"[OK] EKF Fallback Step: uncertainty={est_outage['uncertainty_m']:.2f}m")


def test_ai_scheduler_and_trajectory():
    print("Testing AI Scheduler & ML Trajectory Predictor...")
    constellation = SatelliteConstellation()
    constellation.update(0.1, 0.0, (50.0, 50.0))
    scheduler = AISatelliteScheduler()
    sched = scheduler.evaluate_and_schedule(
        constellation.satellites,
        {"speed": 2.5, "battery_pct": 90.0},
        {"uncertainty_m": 0.8, "fallback_active": False},
        hazard_risk_level=0.9,
        sim_time=10.0,
    )
    assert "scores" in sched
    assert sched["selected_satellite"] is not None
    print(f"[OK] AI Scheduler Decision: {sched['selected_satellite']} -> {sched['selected_task']}")

    predictor = TrajectoryPredictor()
    dummy_history = [{"t": i * 0.5, "x": 50.0 + i * 1.5, "y": 50.0 + i * 1.2, "vx": 3.0, "vy": 2.4, "speed": 3.8, "heading": 0.6, "battery": 95} for i in range(10)]
    pred = predictor.predict(
        dummy_history,
        {"x": 65.0, "y": 62.0, "speed": 3.8, "heading_rad": 0.6, "vx": 3.0, "vy": 2.4},
        [(100, 100)],
        current_uncertainty=0.8,
    )
    assert len(pred["predicted_trajectory"]) > 0
    assert pred["confidence_pct"] > 50.0
    print(f"[OK] ML Trajectory Predicted: confidence={pred['confidence_pct']}% with {len(pred['predicted_trajectory'])} steps.")


def test_simulation_engine_and_benchmark():
    print("Testing Central SimulationEngine & BenchmarkEvaluator...")
    engine = SimulationEngine(seed=42)
    engine.start()
    for _ in range(10):
        engine.step(0.05)
    state = engine.get_full_state()
    assert state["rover"]["x"] > 50.0
    assert "metrics" in state
    print(f"[OK] Simulation Step 10: Rover at ({state['rover']['x']:.2f}, {state['rover']['y']:.2f})")

    # Fast benchmark run
    bench = BenchmarkEvaluator.run_benchmark_comparison(terrain_seed=42)
    assert "MODE_A" in bench["comparison_matrix"]
    assert "MODE_B" in bench["comparison_matrix"]
    assert "MODE_C" in bench["comparison_matrix"]
    print(f"[OK] Benchmark Evaluation complete: Best Mode = {bench['best_mode']}")


def test_jezero_crater_and_dust_storm():
    print("Testing Jezero Crater Terrain Preset & Dynamic Dust Storm...")
    engine = SimulationEngine(seed=42)
    engine.set_terrain_preset("jezero_crater")
    assert engine.terrain_preset == "jezero_crater"
    assert engine.terrain.preset == "jezero_crater"
    assert len(engine.planner.current_route) >= 2
    print(f"[OK] Jezero Crater Terrain generated with {len(engine.planner.current_route)} waypoints.")

    # Test Dust Storm Fault
    engine.toggle_dust_storm(True)
    assert engine.dust_storm.active is True
    engine.is_running = True
    for _ in range(15):
        engine.step(0.05)
    state = engine.get_full_state()
    assert "dust_storm" in state
    assert state["dust_storm"]["active"] is True
    print(f"[OK] Dust storm drifting at ({state['dust_storm']['x']:.1f}, {state['dust_storm']['y']:.1f}), in_storm={state['dust_storm']['rover_in_storm']}")

    engine.toggle_dust_storm(False)
    assert engine.dust_storm.active is False
    print("[OK] Dust storm fault injection & clearing verified.")


def test_swarm_mode():
    print("Testing Multi-Rover Swarm & Satellite Contention...")
    engine = SimulationEngine(seed=42)
    engine.toggle_swarm_mode(True)
    assert engine.swarm_mode_enabled is True
    assert len(engine.swarm_rovers) == 3
    assert "ROVER-1" in engine.swarm_rovers
    assert "ROVER-2" in engine.swarm_rovers
    assert "ROVER-3" in engine.swarm_rovers

    # Step simulation forward 20 ticks
    for _ in range(20):
        engine.step(0.05)

    state = engine.get_full_state()
    assert state["swarm_mode_enabled"] is True
    assert len(state["swarm_rovers"]) == 3
    assigned_rovers = [s.get("target_rover_id") for s in state["satellites"] if s.get("target_rover_id")]
    print(f"[OK] Swarm running: 3 rovers active. Satellite assignments: {assigned_rovers}")

    engine.toggle_swarm_mode(False)
    assert engine.swarm_mode_enabled is False
    print("[OK] Multi-rover swarm mode toggle & stepping verified.")


def test_hazard_escape_no_deadlock():
    print("Testing Hazard Injection Directly On/Ahead of Rover (No Deadlock)...")
    engine = SimulationEngine(seed=42)
    engine.start()
    for _ in range(10):
        engine.step(0.05)

    # Inject hazard directly on top of the rover
    rx, ry = engine.rover.x, engine.rover.y
    engine.inject_hazard(rx, ry, radius=28.0, hazard_type="ROCK_FIELD")

    # Step forward 60 ticks (3.0s) and confirm rover escapes and keeps advancing
    for _ in range(60):
        engine.step(0.05)

    dist_moved = math.hypot(engine.rover.x - rx, engine.rover.y - ry)
    assert engine.rover.speed > 0.2, f"Rover stalled inside hazard: speed={engine.rover.speed}"
    assert dist_moved > 2.0, f"Rover stuck inside hazard: moved only {dist_moved:.2f}m"
    print(f"[OK] Rover escaped direct hazard: moved {dist_moved:.2f}m, speed={engine.rover.speed:.2f}m/s")


if __name__ == "__main__":
    test_terrain_and_planner()
    test_ekf_and_sensors()
    test_ai_scheduler_and_trajectory()
    test_simulation_engine_and_benchmark()
    test_jezero_crater_and_dust_storm()
    test_swarm_mode()
    test_hazard_escape_no_deadlock()
    print("\nALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!")

