"""
NAVIS - Central Simulation & Navigation Engine
Integrates all physics, sensor models, EKF fusion, AI constellation scheduling,
trajectory prediction, hazard detection, A* planning, and WebSocket broadcast loops.
"""

from typing import Dict, List, Any, Optional
import math
from datetime import datetime

from backend.simulation.terrain import MarsTerrain, DustStorm
from backend.simulation.rover import MarsRover
from backend.simulation.satellites import SatelliteConstellation
from backend.simulation.metrics import PerformanceMetrics
from backend.simulation.modes import NavigationMode, ModeConfig
from backend.simulation.scenario import DemoMissionRunner
from backend.navigation.sensors import SensorSuite
from backend.navigation.ekf import NAVIS_EKF
from backend.navigation.planner import AStarPlanner
from backend.ai.scheduler import AISatelliteScheduler
from backend.ai.trajectory import TrajectoryPredictor
from backend.ai.hazard_detector import VisualHazardDetector


class SimulationEngine:
    """
    Core state machine and high-frequency real-time physics and navigation loop.
    """

    def __init__(self, seed: int = 42) -> None:
        self.seed = seed
        self.is_running = False
        self.sim_time = 0.0
        self.speed_multiplier = 1.0
        self.target_fps = 20.0
        self.base_dt = 1.0 / self.target_fps  # 0.05s (20Hz)

        # Active Navigation Mode (MODE_A, MODE_B, MODE_C)
        self.active_mode = NavigationMode.MODE_C

        # Terrain & Atmospheric Subsystems
        self.terrain_preset: str = "procedural"
        self.dust_storm = DustStorm()
        self.was_in_dust_storm: bool = False

        # Subsystems
        self.terrain = MarsTerrain(seed=seed, preset=self.terrain_preset)
        self.rover = MarsRover(
            start_x=self.terrain.start_pos[0],
            start_y=self.terrain.start_pos[1],
            target_x=self.terrain.target_pos[0],
            target_y=self.terrain.target_pos[1],
        )
        self.constellation = SatelliteConstellation(self.terrain.width_m, self.terrain.height_m)
        self.sensors = SensorSuite(seed=seed)
        self.ekf = NAVIS_EKF(start_x=self.terrain.start_pos[0], start_y=self.terrain.start_pos[1])
        self.planner = AStarPlanner(self.terrain)
        self.scheduler = AISatelliteScheduler()
        self.traj_predictor = TrajectoryPredictor()
        self.hazard_detector = VisualHazardDetector(self.terrain)
        self.metrics = PerformanceMetrics()
        self.demo_runner = DemoMissionRunner(self)

        # Shadow Race (Mode A vs Mode C) Subsystem
        self.shadow_race_enabled: bool = False
        self.shadow_rover: Optional[MarsRover] = None
        self.shadow_sensors: Optional[SensorSuite] = None
        self.shadow_ekf: Optional[NAVIS_EKF] = None
        self.shadow_trail: List[List[float]] = []
        self.shadow_hazard_collisions: int = 0
        self.shadow_collided_hazard_ids: set[str] = set()

        # Multi-Rover Swarm Subsystem (Alpha, Beta, Gamma)
        self.swarm_mode_enabled: bool = False
        self.swarm_rovers: Dict[str, Any] = {}

        # AI Decision & Event Log
        self.logs: List[Dict[str, Any]] = []
        self.max_logs = 200

        # Latest computed predictions and states
        self.latest_prediction: Dict[str, Any] = {
            "predicted_trajectory": [],
            "horizon_sec": 30.0,
            "confidence_pct": 94.0,
        }
        self.latest_scheduler_decision: Dict[str, Any] = {}
        self.latest_sensors: Dict[str, Any] = {}
        self.latest_ekf: Dict[str, Any] = {}
        self.latest_hazard_alert: Optional[Dict[str, Any]] = None
        self.last_ai_tick = -1.0

        # Plan initial route
        self._initialize_mission()

    def _initialize_mission(self) -> None:
        """Calculate primary route and initialize telemetry."""
        initial_route = self.planner.plan_path(self.rover.start_pos, self.rover.target_pos)
        self.rover.set_path(initial_route)
        self.planner.current_route = list(initial_route)
        self.planner.old_route = []
        self.metrics.reset(initial_route)
        self.add_log("SYSTEM", "NAVIS Mission Navigation Subsystems Initialized.", "info")

    def add_log(self, category: str, message: str, level: str = "info") -> None:
        """Append an explainable event to the mission log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        sim_timestamp = f"MET +{int(self.sim_time//60):02d}:{int(self.sim_time%60):02d}"
        entry = {
            "id": len(self.logs) + 1,
            "time": timestamp,
            "met": sim_timestamp,
            "category": category,
            "message": message,
            "level": level,  # 'info', 'warning', 'danger', 'success'
        }
        self.logs.append(entry)
        if len(self.logs) > self.max_logs:
            self.logs.pop(0)

    def start(self) -> None:
        self.is_running = True
        self.add_log("CONTROL", "Mission Simulation Running.", "success")

    def pause(self) -> None:
        self.is_running = False
        self.add_log("CONTROL", "Mission Simulation Paused.", "warning")

    @property
    def running(self) -> bool:
        return self.is_running

    @running.setter
    def running(self, value: bool) -> None:
        self.is_running = bool(value)

    def _initialize_shadow_rover(self) -> None:
        """Instantiate or reset parallel dead-reckoning shadow rover."""
        self.shadow_rover = MarsRover(
            start_x=float(self.terrain.start_pos[0]),
            start_y=float(self.terrain.start_pos[1]),
            target_x=float(self.terrain.target_pos[0]),
            target_y=float(self.terrain.target_pos[1]),
        )
        initial_route = self.planner.plan_path(self.terrain.start_pos, self.terrain.target_pos)
        self.shadow_rover.set_path(list(initial_route))
        self.shadow_sensors = SensorSuite(seed=self.seed + 101)
        self.shadow_sensors.reset(self.terrain.start_pos, self.shadow_rover.heading)
        self.shadow_ekf = NAVIS_EKF(
            start_x=float(self.terrain.start_pos[0]),
            start_y=float(self.terrain.start_pos[1]),
            start_heading=float(self.shadow_rover.heading),
        )
        self.shadow_trail = [[float(self.terrain.start_pos[0]), float(self.terrain.start_pos[1])]]
        self.shadow_hazard_collisions = 0
        self.shadow_collided_hazard_ids = set()

    def _initialize_swarm_rovers(self) -> None:
        """Instantiate 3 multi-rover swarm members with distinct paths, roles, and telemetry."""
        # 1. Alpha / Scout (fast, NE target)
        r1_start = (50.0, 50.0)
        r1_target = (540.0, 530.0)
        p1 = self.planner.plan_path(r1_start, r1_target)
        rover1 = MarsRover(r1_start[0], r1_start[1], r1_target[0], r1_target[1], max_speed=2.2, max_accel=0.9)
        rover1.set_path(list(p1))
        s1 = SensorSuite(seed=self.seed + 201)
        s1.reset(r1_start, rover1.heading)
        ekf1 = NAVIS_EKF(r1_start[0], r1_start[1], rover1.heading)

        # 2. Beta / Sampler (medium speed, central terrain)
        r2_start = (60.0, 220.0)
        r2_target = (480.0, 260.0)
        p2 = self.planner.plan_path(r2_start, r2_target)
        rover2 = MarsRover(r2_start[0], r2_start[1], r2_target[0], r2_target[1], max_speed=1.5, max_accel=0.6)
        rover2.set_path(list(p2))
        s2 = SensorSuite(seed=self.seed + 202)
        s2.reset(r2_start, rover2.heading)
        ekf2 = NAVIS_EKF(r2_start[0], r2_start[1], rover2.heading)

        # 3. Gamma / Hauler (heavy payload, SE sector)
        r3_start = (80.0, 420.0)
        r3_target = (520.0, 120.0)
        p3 = self.planner.plan_path(r3_start, r3_target)
        rover3 = MarsRover(r3_start[0], r3_start[1], r3_target[0], r3_target[1], max_speed=1.1, max_accel=0.4)
        rover3.set_path(list(p3))
        s3 = SensorSuite(seed=self.seed + 203)
        s3.reset(r3_start, rover3.heading)
        ekf3 = NAVIS_EKF(r3_start[0], r3_start[1], rover3.heading)

        self.swarm_rovers = {
            "ROVER-1": {
                "rover_id": "ROVER-1",
                "callsign": "Alpha",
                "role": "Scout",
                "color": "#58A6FF",
                "priority": 1.25,
                "rover": rover1,
                "sensors": s1,
                "ekf": ekf1,
                "trail": [[r1_start[0], r1_start[1]]],
                "in_storm": False,
                "latest_uncertainty": 0.5,
                "latest_sensors": {},
                "latest_ekf": {},
                "assigned_satellite_id": None,
                "pnt_denied_ticks": 0,
            },
            "ROVER-2": {
                "rover_id": "ROVER-2",
                "callsign": "Beta",
                "role": "Sampler",
                "color": "#2EA043",
                "priority": 1.0,
                "rover": rover2,
                "sensors": s2,
                "ekf": ekf2,
                "trail": [[r2_start[0], r2_start[1]]],
                "in_storm": False,
                "latest_uncertainty": 0.5,
                "latest_sensors": {},
                "latest_ekf": {},
                "assigned_satellite_id": None,
                "pnt_denied_ticks": 0,
            },
            "ROVER-3": {
                "rover_id": "ROVER-3",
                "callsign": "Gamma",
                "role": "Hauler",
                "color": "#BC8CFF",
                "priority": 0.85,
                "rover": rover3,
                "sensors": s3,
                "ekf": ekf3,
                "trail": [[r3_start[0], r3_start[1]]],
                "in_storm": False,
                "latest_uncertainty": 0.5,
                "latest_sensors": {},
                "latest_ekf": {},
                "assigned_satellite_id": None,
                "pnt_denied_ticks": 0,
            },
        }

    def toggle_shadow_race(self, enabled: bool) -> None:
        """Toggle live Mode A (Dead Reckon) vs Mode C (NAVIS AI) shadow race."""
        self.shadow_race_enabled = bool(enabled)
        if enabled:
            if self.swarm_mode_enabled:
                self.swarm_mode_enabled = False
                self.swarm_rovers = {}
            self.active_mode = NavigationMode.MODE_C
            self.reset()
            self._initialize_shadow_rover()
            self.is_running = True
            self.add_log("RACE", "🏁 SHADOW RACE ENGAGED: Mode A (Dead Reckoning) vs Mode C (NAVIS AI)", "warning")
            self.add_log("CONTROL", "Mission Simulation Running.", "success")
        else:
            self.shadow_rover = None
            self.shadow_sensors = None
            self.shadow_ekf = None
            self.shadow_trail = []
            self.shadow_hazard_collisions = 0
            self.shadow_collided_hazard_ids = set()
            self.add_log("RACE", "Shadow Race mode deactivated.", "info")

    def toggle_swarm_mode(self, enabled: bool) -> None:
        """Toggle multi-rover swarm mode (3 rovers competing for constellation)."""
        self.swarm_mode_enabled = bool(enabled)
        if enabled:
            if self.shadow_race_enabled:
                self.shadow_race_enabled = False
                self.shadow_rover = None
                self.shadow_sensors = None
                self.shadow_ekf = None
                self.shadow_trail = []
            self.active_mode = NavigationMode.MODE_C
            self.reset()
            self._initialize_swarm_rovers()
            self.is_running = True
            self.add_log("SWARM", "🚀 MULTI-ROVER SWARM DEPLOYED: Alpha (Scout), Beta (Sampler), Gamma (Hauler)", "warning")
            self.add_log("SWARM", "Orbital constellation contention scheduling initiated across 3 rovers.", "info")
            self.add_log("CONTROL", "Mission Simulation Running.", "success")
        else:
            self.swarm_rovers = {}
            self.add_log("SWARM", "Multi-rover swarm mode deactivated. Returned to single rover.", "info")

    def reset(self, seed: Optional[int] = None) -> None:
        """Reset whole simulation to starting state."""
        if seed is not None:
            self.seed = seed
        self.is_running = False
        self.sim_time = 0.0
        self.terrain.clear_injected_hazards()
        self.rover.reset(self.terrain.start_pos)
        self.constellation = SatelliteConstellation(self.terrain.width_m, self.terrain.height_m)
        self.sensors.reset(self.terrain.start_pos, self.rover.heading)
        self.ekf.reset(self.terrain.start_pos[0], self.terrain.start_pos[1], self.rover.heading)
        self.hazard_detector = VisualHazardDetector(self.terrain)
        self.demo_runner.stop_demo()
        self._initialize_mission()

        if self.shadow_race_enabled:
            self.active_mode = NavigationMode.MODE_C
            self._initialize_shadow_rover()
        elif self.swarm_mode_enabled:
            self.active_mode = NavigationMode.MODE_C
            self._initialize_swarm_rovers()
        else:
            self.shadow_rover = None
            self.shadow_sensors = None
            self.shadow_ekf = None
            self.shadow_trail = []
            self.swarm_rovers = {}

        self.add_log("CONTROL", "Mission Simulation Reset to Origin.", "info")

    def set_speed(self, multiplier: float) -> None:
        self.speed_multiplier = max(0.25, min(10.0, float(multiplier)))
        self.add_log("CONTROL", f"Simulation speed multiplier set to {self.speed_multiplier}x", "info")

    def set_mode(self, mode: str) -> None:
        if self.shadow_race_enabled:
            self.add_log("MODE", "Shadow Race active: Architecture locked to Mode C vs Mode A comparison.", "info")
            return
        if self.swarm_mode_enabled:
            self.add_log("MODE", "Swarm mode active: Architecture running multi-rover Mode C.", "info")
            return
        if mode in [NavigationMode.MODE_A, NavigationMode.MODE_B, NavigationMode.MODE_C]:
            self.active_mode = mode
            desc = ModeConfig.DESCRIPTIONS[mode]
            self.add_log("MODE", f"Navigation Mode switched to: {desc['name']}", "warning")

    def set_satellite_outage(self, outage: bool) -> None:
        self.constellation.set_global_outage(outage)
        if outage:
            self.add_log("OUTAGE", "Constellation Satellite Outage Injected: PNT lost.", "danger")
        else:
            self.add_log("RESTORE", "Constellation Satellite PNT service restored.", "success")

    def inject_hazard(
        self,
        x: float,
        y: float,
        radius: float = 30.0,
        hazard_type: str = "ROCK_FIELD",
    ) -> Dict[str, Any]:
        """Manually or dynamically inject a hazard to prompt route replanning."""
        hz = self.terrain.inject_hazard(x, y, radius, hazard_type)
        self.add_log("HAZARD", f"Hazard Injected at ({x:.0f}m, {y:.0f}m): {hazard_type}", "danger")

        # If in Mode C, evaluate immediate replan if along path
        if self.active_mode == NavigationMode.MODE_C:
            replan = self.planner.trigger_replan((self.rover.x, self.rover.y), self.rover.target_pos, "USER_INJECTED_HAZARD")
            self.rover.set_path(replan["new_route"])
            self.add_log("PLANNER", "A* replanned route to avoid newly injected hazard ✓", "success")

        return hz

    def set_terrain_preset(self, preset: str) -> None:
        """Switch terrain preset ('procedural' or 'jezero_crater') and reset mission cleanly."""
        if preset not in ["procedural", "jezero_crater"]:
            preset = "procedural"
        self.terrain_preset = preset
        self.terrain = MarsTerrain(
            width_m=600.0,
            height_m=600.0,
            grid_res=60,
            seed=self.seed,
            preset=preset,
        )
        self.planner = AStarPlanner(self.terrain)
        self.hazard_detector = VisualHazardDetector(self.terrain)
        self.reset()
        self.is_running = True
        self.add_log("TERRAIN", f"Martian Surface Preset Switched to: {preset.upper().replace('_', ' ')}", "warning")

    def toggle_dust_storm(self, enabled: Optional[bool] = None) -> None:
        """Activate or deactivate the dynamic moving dust storm fault."""
        if enabled is None:
            self.dust_storm.active = not self.dust_storm.active
        else:
            self.dust_storm.active = bool(enabled)

        if self.dust_storm.active:
            self.dust_storm.spawn_upwind(self.rover.x, self.rover.y, self.rover.heading, distance=65.0)
            self.add_log("STORM", "⚠️ DUST STORM INJECTED: High-velocity particle cloud approaching rover path", "danger")
        else:
            self.dust_storm.rover_in_storm = False
            self.was_in_dust_storm = False
            self.add_log("STORM", "Dust storm deactivated. Atmospheric visibility nominal.", "info")

    def step(self, custom_dt: Optional[float] = None) -> None:
        """
        Execute one physical & algorithmic tick.
        """
        dt = (custom_dt if custom_dt is not None else self.base_dt) * self.speed_multiplier
        self.sim_time += dt

        # Update demo script if active
        if self.demo_runner.is_active:
            self.demo_runner.update(dt)

        rover_pos = (self.rover.x, self.rover.y)

        # Update dynamic dust storm if active
        rover_in_storm = False
        if self.dust_storm.active:
            self.dust_storm.update(dt, self.terrain.width_m, self.terrain.height_m)
            rover_in_storm = self.dust_storm.check_inside(self.rover.x, self.rover.y)
            self.dust_storm.rover_in_storm = rover_in_storm

            if rover_in_storm and not self.was_in_dust_storm:
                self.add_log(
                    "STORM",
                    "⚠️ ROVER ENTERED DUST STORM: Visual Odometry degraded (5x noise), PNT priority elevated",
                    "danger",
                )
            elif not rover_in_storm and self.was_in_dust_storm:
                self.add_log(
                    "STORM",
                    "Rover cleared dust storm perimeter. Visual Odometry tracking nominal ✓",
                    "success",
                )
            self.was_in_dust_storm = rover_in_storm
        else:
            self.dust_storm.rover_in_storm = False
            self.was_in_dust_storm = False

        # Multi-Rover Swarm Simulation Step
        if self.swarm_mode_enabled and self.swarm_rovers:
            try:
                # 1. Update orbital constellation
                self.constellation.update(dt, self.sim_time, rover_pos)

                # 2. Contention Scheduling tick (~0.4s)
                if (self.sim_time - self.last_ai_tick) >= 0.4:
                    self.last_ai_tick = self.sim_time
                    sched_res = self.scheduler.evaluate_and_schedule_swarm(
                        self.constellation.satellites,
                        self.swarm_rovers,
                        sim_time=self.sim_time,
                        dust_storm=self.dust_storm,
                    )
                    self.latest_scheduler_decision = sched_res
                    for log_msg in sched_res.get("reassignment_logs", []):
                        self.add_log("SWARM-AI", log_msg, "warning")

                # 3. Step each rover in the swarm
                for r_id, r_info in self.swarm_rovers.items():
                    r = r_info["rover"]
                    r_cost = float(self.terrain.get_cost(r.x, r.y))
                    r_slope = float(self.terrain.get_slope(r.x, r.y))
                    r_in_storm = self.dust_storm.check_inside(r.x, r.y) if self.dust_storm.active else False
                    r_info["in_storm"] = r_in_storm

                    # Check which satellite is serving this rover for PNT
                    assigned_pnt_sat = None
                    for sat in self.constellation.satellites.values():
                        if (
                            not sat.is_outage_forced
                            and not self.constellation.global_outage
                            and sat.current_task == "PNT"
                            and getattr(sat, "target_rover_id", None) == r_id
                            and sat.is_visible_to_pos((r.x, r.y))
                        ):
                            assigned_pnt_sat = sat
                            break

                    pnt_avail = assigned_pnt_sat is not None
                    r_info["assigned_satellite_id"] = assigned_pnt_sat.sat_id if assigned_pnt_sat else None
                    if not pnt_avail:
                        r_info["pnt_denied_ticks"] += 1
                    else:
                        r_info["pnt_denied_ticks"] = 0

                    # Sample sensors for this rover
                    meas = r_info["sensors"].sample(
                        dt=dt,
                        true_x=float(r.x),
                        true_y=float(r.y),
                        true_vx=float(r.vx),
                        true_vy=float(r.vy),
                        true_heading=float(r.heading),
                        true_speed=float(r.speed),
                        true_accel=float(r.accel),
                        true_omega=float(r.angular_velocity),
                        wheel_slip=float(r.wheel_slip),
                        pnt_available=pnt_avail,
                        in_dust_storm=r_in_storm,
                        dust_storm_intensity=self.dust_storm.intensity if self.dust_storm.active else 0.0,
                    )
                    r_info["latest_sensors"] = meas

                    # EKF step
                    ekf_res = r_info["ekf"].step(dt, meas)
                    r_info["latest_ekf"] = ekf_res
                    r_info["latest_uncertainty"] = ekf_res.get("uncertainty_m", 1.0)

                    # Update kinematics
                    r.update(
                        dt=dt,
                        sim_time=self.sim_time,
                        terrain_cost=r_cost,
                        terrain_slope=r_slope,
                        is_outage=(not pnt_avail),
                        in_dust_storm=r_in_storm,
                    )

                    # Append trail
                    if not r_info["trail"] or math.hypot(r.x - r_info["trail"][-1][0], r.y - r_info["trail"][-1][1]) >= 1.2:
                        r_info["trail"].append([round(float(r.x), 2), round(float(r.y), 2)])
                        if len(r_info["trail"]) > 250:
                            r_info["trail"].pop(0)

                # Keep primary rover telemetry updated for dashboard HUD continuity
                if "ROVER-1" in self.swarm_rovers:
                    r1 = self.swarm_rovers["ROVER-1"]
                    self.rover.x = r1["rover"].x
                    self.rover.y = r1["rover"].y
                    self.rover.vx = r1["rover"].vx
                    self.rover.vy = r1["rover"].vy
                    self.rover.speed = r1["rover"].speed
                    self.rover.heading = r1["rover"].heading
                    self.rover.active_path = r1["rover"].active_path
                    self.latest_ekf = r1["latest_ekf"]
                    self.latest_sensors = r1["latest_sensors"]
            except Exception as e:
                import logging
                logging.getLogger("NAVIS-BACKEND").error(f"Error stepping swarm rovers: {e}", exc_info=True)
        else:
            # 1. Update Satellites
            if self.active_mode == NavigationMode.MODE_A:
                # Rover Only: No satellites
                self.constellation.set_global_outage(True)
                self.constellation.update(dt, self.sim_time, rover_pos)
                pnt_available = False
                imaging_available = False
            elif self.active_mode == NavigationMode.MODE_B:
                # Fixed SAT-01 only
                self.constellation.set_global_outage(False)
                self.constellation.update(dt, self.sim_time, rover_pos)
                sat01 = self.constellation.satellites["SAT-01"]
                sat01.set_task("PNT" if sat01.is_visible_to_rover else "IDLE")
                # Other satellites kept idle
                for sid, s in self.constellation.satellites.items():
                    if sid != "SAT-01":
                        s.set_task("IDLE")
                pnt_available = sat01.is_visible_to_rover and not sat01.is_outage_forced
                imaging_available = False
            else:
                # Mode C: Full Constellation + AI Scheduler
                self.constellation.update(dt, self.sim_time, rover_pos)

                # Run AI Scheduler every ~0.5s of sim time
                if (self.sim_time - self.last_ai_tick) >= 0.4:
                    self.last_ai_tick = self.sim_time

                    hazard_risk = (
                        self.latest_hazard_alert["hazard_risk_level"]
                        if self.latest_hazard_alert
                        else 0.0
                    )
                    self.latest_scheduler_decision = self.scheduler.evaluate_and_schedule(
                        self.constellation.satellites,
                        self.rover.to_dict(),
                        self.latest_ekf,
                        hazard_risk_level=hazard_risk,
                        sim_time=self.sim_time,
                        in_dust_storm=rover_in_storm,
                    )

                pnt_sat = self.constellation.get_pnt_satellite()
                pnt_available = (pnt_sat is not None) and (not self.constellation.global_outage)
                img_sat = self.constellation.get_imaging_satellite()
                imaging_available = (img_sat is not None) and (not self.constellation.global_outage)

            # 2. Sample Sensors
            terrain_cost = self.terrain.get_cost(self.rover.x, self.rover.y)
            terrain_slope = self.terrain.get_slope(self.rover.x, self.rover.y)

            self.latest_sensors = self.sensors.sample(
                dt=dt,
                true_x=self.rover.x,
                true_y=self.rover.y,
                true_vx=self.rover.vx,
                true_vy=self.rover.vy,
                true_heading=self.rover.heading,
                true_speed=self.rover.speed,
                true_accel=self.rover.accel,
                true_omega=self.rover.angular_velocity,
                wheel_slip=self.rover.wheel_slip,
                pnt_available=pnt_available,
                in_dust_storm=rover_in_storm,
                dust_storm_intensity=self.dust_storm.intensity,
            )

            # 3. EKF Sensor Fusion Step
            self.latest_ekf = self.ekf.step(dt, self.latest_sensors)

            # 4. Step Rover Kinematics
            self.rover.update(
                dt=dt,
                sim_time=self.sim_time,
                terrain_cost=terrain_cost,
                terrain_slope=terrain_slope,
                is_outage=(not pnt_available),
                in_dust_storm=rover_in_storm,
            )

            # 5. AI Trajectory Prediction & Hazard Reconnaissance (Mode C)
            if self.active_mode == NavigationMode.MODE_C:
                self.latest_prediction = self.traj_predictor.predict(
                    rover_history=self.rover.history,
                    current_state=self.rover.to_dict(),
                    active_planned_path=self.rover.active_path,
                    current_uncertainty=self.latest_ekf.get("uncertainty_m", 1.0),
                    terrain_cost=terrain_cost,
                )

                # Hazard Scanning
                hz_scan = self.hazard_detector.scan_environment(
                    rover_pos=(self.rover.x, self.rover.y),
                    rover_heading=self.rover.heading,
                    predicted_trajectory=self.latest_prediction["predicted_trajectory"],
                    planned_path=self.rover.active_path,
                    imaging_sat_active=imaging_available,
                    sim_time=self.sim_time,
                )
                self.latest_hazard_alert = hz_scan

                if hz_scan["needs_replan"]:
                    alert = hz_scan["active_alert"]
                    self.add_log(
                        "HAZARD",
                        f"⚠️ {alert['type']} identified by {alert['source']} at {alert['distance_m']}m ahead (Conf: {alert['confidence_pct']}%)",
                        "danger",
                    )
                    replan_res = self.planner.trigger_replan(
                        (self.rover.x, self.rover.y),
                        self.rover.target_pos,
                        reason=f"Detected {alert['type']}",
                    )
                    self.rover.set_path(replan_res["new_route"])
                    self.add_log("PLANNER", "Dynamic route replanning complete. Executing safe bypass ✓", "success")

            # 6. Step Shadow Rover (Mode A Dead Reckoning) if Shadow Race is Active
            if self.shadow_race_enabled and self.shadow_rover and self.shadow_ekf and self.shadow_sensors:
                try:
                    s_cost = float(self.terrain.get_cost(self.shadow_rover.x, self.shadow_rover.y))
                    s_slope = float(self.terrain.get_slope(self.shadow_rover.x, self.shadow_rover.y))
                    shadow_in_storm = self.dust_storm.check_inside(self.shadow_rover.x, self.shadow_rover.y)

                    # Sample sensors for shadow rover with PNT completely denied (Mode A)
                    shadow_meas = self.shadow_sensors.sample(
                        dt=dt,
                        true_x=float(self.shadow_rover.x),
                        true_y=float(self.shadow_rover.y),
                        true_vx=float(self.shadow_rover.vx),
                        true_vy=float(self.shadow_rover.vy),
                        true_heading=float(self.shadow_rover.heading),
                        true_speed=float(self.shadow_rover.speed),
                        true_accel=float(self.shadow_rover.accel),
                        true_omega=float(self.shadow_rover.angular_velocity),
                        wheel_slip=float(self.shadow_rover.wheel_slip),
                        pnt_available=False,
                        in_dust_storm=shadow_in_storm,
                        dust_storm_intensity=self.dust_storm.intensity,
                    )

                    # EKF step for shadow rover (dead reckoning only)
                    self.shadow_ekf.step(dt, shadow_meas)

                    # Update shadow rover kinematics towards original waypoints without replanning
                    self.shadow_rover.update(
                        dt=dt,
                        sim_time=self.sim_time,
                        terrain_cost=s_cost,
                        terrain_slope=s_slope,
                        is_outage=True,
                        in_dust_storm=shadow_in_storm,
                    )

                    # Append to trail
                    if not self.shadow_trail or math.hypot(self.shadow_rover.x - self.shadow_trail[-1][0], self.shadow_rover.y - self.shadow_trail[-1][1]) >= 1.2:
                        self.shadow_trail.append([round(float(self.shadow_rover.x), 2), round(float(self.shadow_rover.y), 2)])
                        if len(self.shadow_trail) > 250:
                            self.shadow_trail.pop(0)

                    # Check collisions with craters
                    for cr in self.terrain.craters:
                        cr_id = f"cr_{int(cr['x'])}_{int(cr['y'])}"
                        if cr_id not in self.shadow_collided_hazard_ids:
                            if math.hypot(self.shadow_rover.x - cr["x"], self.shadow_rover.y - cr["y"]) <= cr["radius"] * 0.85:
                                self.shadow_collided_hazard_ids.add(cr_id)
                                self.shadow_hazard_collisions += 1
                                self.add_log("RACE", f"💥 SHADOW ROVER (Mode A) drifted into CRATER PIT at ({cr['x']:.0f}, {cr['y']:.0f})", "danger")

                    # Check collisions with injected hazards
                    for hz in self.terrain.injected_hazards:
                        hz_id = hz["id"]
                        if hz_id not in self.shadow_collided_hazard_ids:
                            if math.hypot(self.shadow_rover.x - hz["x"], self.shadow_rover.y - hz["y"]) <= hz["radius"] * 0.85:
                                self.shadow_collided_hazard_ids.add(hz_id)
                                self.shadow_hazard_collisions += 1
                                self.add_log("RACE", f"💥 SHADOW ROVER (Mode A) collided with {hz.get('type', 'HAZARD')} at ({hz['x']:.0f}, {hz['y']:.0f})", "danger")
                except Exception as e:
                    import logging
                    logging.getLogger("NAVIS-BACKEND").error(f"Error stepping shadow rover: {e}", exc_info=True)

        # 7. Update Performance Metrics
        est_pos = (self.latest_ekf.get("est_x", self.rover.x), self.latest_ekf.get("est_y", self.rover.y))
        self.metrics.update(
            sim_time=self.sim_time,
            true_pos=(self.rover.x, self.rover.y),
            est_pos=est_pos,
            uncertainty_m=self.latest_ekf.get("uncertainty_m", 1.0),
            rover_speed=self.rover.speed,
            satellites=self.constellation.to_list(),
        )

    def get_full_state(self) -> Dict[str, Any]:
        """Compile comprehensive state payload for API and WebSocket streaming."""
        est_pos = (self.latest_ekf.get("est_x", self.rover.x), self.latest_ekf.get("est_y", self.rover.y))
        err = math.hypot(self.rover.x - est_pos[0], self.rover.y - est_pos[1])

        shadow_data = None
        if self.shadow_race_enabled and self.shadow_rover and self.shadow_ekf:
            try:
                s_ekf_x = float(self.shadow_ekf.x[0])
                s_ekf_y = float(self.shadow_ekf.x[1])
                s_err = math.hypot(self.shadow_rover.x - s_ekf_x, self.shadow_rover.y - s_ekf_y)
                s_goal_dist = math.hypot(
                    self.shadow_rover.x - self.shadow_rover.target_pos[0],
                    self.shadow_rover.y - self.shadow_rover.target_pos[1],
                )
                shadow_data = {
                    "true_pos": [round(float(self.shadow_rover.x), 2), round(float(self.shadow_rover.y), 2)],
                    "ekf_pos": [round(float(s_ekf_x), 2), round(float(s_ekf_y), 2)],
                    "heading": round(float(self.shadow_rover.heading), 3),
                    "speed": round(float(self.shadow_rover.speed), 2),
                    "localization_error": round(float(s_err), 2),
                    "trail": self.shadow_trail[-100:],
                    "hazard_collisions": int(self.shadow_hazard_collisions),
                    "distance_to_goal": round(float(s_goal_dist), 2),
                    "mission_status": str(self.shadow_rover.mission_status),
                }
            except Exception as e:
                import logging
                logging.getLogger("NAVIS-BACKEND").error(f"Error compiling shadow rover telemetry: {e}", exc_info=True)

        swarm_data = []
        if self.swarm_mode_enabled and self.swarm_rovers:
            try:
                for r_id, r_info in self.swarm_rovers.items():
                    r = r_info["rover"]
                    ekf_x = float(r_info["ekf"].x[0])
                    ekf_y = float(r_info["ekf"].x[1])
                    r_err = math.hypot(r.x - ekf_x, r.y - ekf_y)
                    swarm_data.append({
                        "rover_id": r_info["rover_id"],
                        "callsign": r_info["callsign"],
                        "role": r_info["role"],
                        "color": r_info["color"],
                        "priority": float(r_info["priority"]),
                        "true_pos": [round(float(r.x), 2), round(float(r.y), 2)],
                        "ekf_pos": [round(float(ekf_x), 2), round(float(ekf_y), 2)],
                        "heading": round(float(r.heading), 3),
                        "speed": round(float(r.speed), 2),
                        "battery_pct": round(float(r.battery_pct), 1),
                        "uncertainty_m": round(float(r_info["latest_uncertainty"]), 2),
                        "localization_error": round(float(r_err), 2),
                        "in_storm": bool(r_info["in_storm"]),
                        "assigned_satellite_id": r_info["assigned_satellite_id"],
                        "path": [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in r.active_path],
                        "trail": r_info["trail"][-100:],
                        "mission_status": str(r.mission_status),
                    })
            except Exception as e:
                import logging
                logging.getLogger("NAVIS-BACKEND").error(f"Error compiling swarm telemetry: {e}", exc_info=True)

        return {
            "sim_time": round(self.sim_time, 2),
            "is_running": self.is_running,
            "speed_multiplier": self.speed_multiplier,
            "active_mode": self.active_mode,
            "shadow_race_enabled": self.shadow_race_enabled,
            "shadow_rover": shadow_data,
            "swarm_mode_enabled": self.swarm_mode_enabled,
            "swarm_rovers": swarm_data,
            "terrain_preset": self.terrain_preset,
            "dust_storm": self.dust_storm.to_dict(),
            "mode_meta": ModeConfig.DESCRIPTIONS[self.active_mode],
            "rover": self.rover.to_dict(),
            "satellites": self.constellation.to_list(),
            "ekf": self.latest_ekf,
            "sensors": self.latest_sensors,
            "metrics": {
                **self.metrics.update(
                    self.sim_time,
                    (self.rover.x, self.rover.y),
                    est_pos,
                    self.latest_ekf.get("uncertainty_m", 1.0),
                    self.rover.speed,
                    self.constellation.to_list(),
                ),
                "position_error_instant_m": round(err, 2),
            },
            "trajectory_prediction": self.latest_prediction,
            "ai_scheduler": self.latest_scheduler_decision,
            "hazard_alert": self.latest_hazard_alert,
            "routes": {
                "active_path": self.rover.active_path,
                "current_planned": self.planner.current_route,
                "old_avoided_path": self.planner.old_route,
                "breadcrumb_history": [
                    {"x": round(p["x"], 1), "y": round(p["y"], 1)}
                    for p in self.rover.history
                ],
            },
            "demo_mission": self.demo_runner.get_status(),
            "logs": self.logs[-40:],  # last 40 entries
            "terrain_summary": {
                "preset": self.terrain_preset,
                "width_m": float(self.terrain.width_m),
                "height_m": float(self.terrain.height_m),
                "start_pos": [float(self.terrain.start_pos[0]), float(self.terrain.start_pos[1])],
                "target_pos": [float(self.terrain.target_pos[0]), float(self.terrain.target_pos[1])],
                "injected_hazards": self.terrain.injected_hazards,
                "craters": self.terrain.craters,
                "rock_fields": self.terrain.rock_fields,
                "elevation_grid": self.terrain.elevation_grid[::2, ::2].round(1).tolist(),
            },
        }
