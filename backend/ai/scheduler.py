"""
NAVIS - Dynamic AI Satellite Scheduler
Allocates constrained satellite constellation resources (PNT, IMAGING, COMMUNICATION, IDLE)
using multi-criteria explainable scoring.
"""

import math
from typing import Dict, List, Any, Optional, Set, Tuple

from backend.simulation.satellites import Satellite


class AISatelliteScheduler:
    """
    Intelligent constellation resource scheduler.
    Computes dynamic scores for all orbiters based on:
    - Visibility & Elevation angle (30%)
    - Rover Navigation Need / Uncertainty (25%)
    - Imaging / Hazard Reconnaissance Value (20%)
    - Ground Communication / Telemetry Need (15%)
    - Satellite Resource Availability / Power (10%)
    """

    # Weights
    W_VISIBILITY = 0.30
    W_ROVER_NEED = 0.25
    W_IMAGING_VAL = 0.20
    W_COMM_NEED = 0.15
    W_RESOURCE = 0.10

    def __init__(self) -> None:
        self.decisions_log: List[Dict[str, Any]] = []
        self.selected_satellite_id: Optional[str] = None
        self.selected_task: str = "IDLE"
        self.last_reason_summary: str = ""
        self.previous_swarm_assignments: Dict[str, Optional[str]] = {}

    def evaluate_and_schedule(
        self,
        satellites: Dict[str, Satellite],
        rover_telemetry: Dict[str, Any],
        ekf_telemetry: Dict[str, Any],
        hazard_risk_level: float,  # 0.0 to 1.0 (high if hazard in predicted path)
        sim_time: float,
        in_dust_storm: bool = False,
    ) -> Dict[str, Any]:
        """
        Run scoring algorithm across all satellites and assign optimal tasks.
        """
        uncertainty = ekf_telemetry.get("uncertainty_m", 1.0)
        is_fallback = ekf_telemetry.get("fallback_active", False)
        rover_speed = rover_telemetry.get("speed", 0.0)

        # 1. Compute Rover Need Score (0 to 1): High if uncertainty is high, in fallback, or in dust storm
        storm_boost = 0.35 if in_dust_storm else 0.0
        rover_need_score = min(1.0, (uncertainty / 6.0) + (0.4 if is_fallback else 0.0) + storm_boost)

        # 2. Compute Imaging Need Score (0 to 1): High if upcoming hazard risk is high
        imaging_need_score = min(1.0, hazard_risk_level * 0.9 + (0.1 if rover_speed > 1.5 else 0.0))

        # 3. Compute Comm Need Score (0 to 1): Periodic telemetry dump / mission status
        comm_need_score = min(1.0, 0.25 + 0.5 * (1.0 - rover_telemetry.get("battery_pct", 100.0) / 100.0))

        scores: Dict[str, float] = {}
        sub_scores: Dict[str, Dict[str, float]] = {}
        explanations: Dict[str, List[str]] = {}

        for sat_id, sat in satellites.items():
            if sat.is_outage_forced or not sat.is_visible_to_rover:
                sat.score = 0.0
                sat.set_task("IDLE", "Out of visible orbital cone or forced outage")
                scores[sat_id] = 0.0
                continue

            # Normalized visibility component (elevation angle from 15 to 90 deg)
            norm_vis = min(1.0, max(0.0, (sat.elevation_angle_deg - 15.0) / 75.0))

            # Resource availability (battery)
            norm_res = min(1.0, sat.battery_pct / 100.0)

            # Capability specific factors
            has_pnt = "PNT" in sat.capabilities
            has_img = "IMAGING" in sat.capabilities
            has_comm = "COMMUNICATION" in sat.capabilities

            # Determine task relevance for this specific satellite
            pnt_val = rover_need_score if has_pnt else 0.1
            img_val = imaging_need_score if has_img else 0.0
            comm_val = comm_need_score if has_comm else 0.1

            # Compute weighted composite score
            sat_score = (
                self.W_VISIBILITY * norm_vis
                + self.W_ROVER_NEED * pnt_val
                + self.W_IMAGING_VAL * img_val
                + self.W_COMM_NEED * comm_val
                + self.W_RESOURCE * norm_res
            )

            scores[sat_id] = sat_score
            sat.score = sat_score

            sub_scores[sat_id] = {
                "visibility": round(norm_vis, 2),
                "rover_need": round(pnt_val, 2),
                "imaging_val": round(img_val, 2),
                "comm_need": round(comm_val, 2),
                "resources": round(norm_res, 2),
            }

            # Build explainability reasons
            reasons = []
            if norm_vis > 0.6:
                reasons.append(f"High elevation angle ({sat.elevation_angle_deg:.0f}°)")
            if has_img and hazard_risk_level > 0.5:
                reasons.append("Hazard reconnaissance priority")
            if has_pnt and (uncertainty > 2.0 or is_fallback):
                reasons.append("PNT precision recovery needed")
            if norm_res > 0.8:
                reasons.append(f"Optimal battery ({sat.battery_pct:.0f}%)")

            explanations[sat_id] = reasons

        # Multi-task constellation assignment
        # Primary: Assign best satellite to highest need task
        visible_sats = [s for s in satellites.values() if s.is_visible_to_rover and not s.is_outage_forced]
        # Sort by score descending
        visible_sats.sort(key=lambda s: s.score, reverse=True)

        assigned_tasks = {}
        if visible_sats:
            # Decide tasks based on priority
            # Priority 1: If hazard risk > 0.6 and imaging satellite available, assign imaging
            img_sat = next((s for s in visible_sats if "IMAGING" in s.capabilities), None)
            pnt_sat = next((s for s in visible_sats if "PNT" in s.capabilities and s != img_sat), None)

            if in_dust_storm and pnt_sat:
                pnt_sat.set_task("PNT", "Prioritized PNT lock to compensate for VO dust occlusion")
                assigned_tasks[pnt_sat.sat_id] = "PNT"
                self.selected_satellite_id = pnt_sat.sat_id
                self.selected_task = "PNT"
                self.last_reason_summary = f"{pnt_sat.sat_id} locked to PNT (Compensating for active dust storm VO degradation)"
            elif hazard_risk_level > 0.5 and img_sat:
                img_sat.set_task("IMAGING", "Assigned for forward hazard reconnaissance")
                assigned_tasks[img_sat.sat_id] = "IMAGING"
                self.selected_satellite_id = img_sat.sat_id
                self.selected_task = "IMAGING"
                self.last_reason_summary = f"{img_sat.sat_id} selected for orbital hazard imaging (Risk: {hazard_risk_level*100:.0f}%)"
            elif pnt_sat:
                pnt_sat.set_task("PNT", "Assigned for precision localization lock")
                assigned_tasks[pnt_sat.sat_id] = "PNT"
                self.selected_satellite_id = pnt_sat.sat_id
                self.selected_task = "PNT"
                self.last_reason_summary = f"{pnt_sat.sat_id} selected for PNT precision navigation"
            elif visible_sats:
                primary = visible_sats[0]
                task = "PNT" if "PNT" in primary.capabilities else "COMMUNICATION"
                primary.set_task(task, "Selected as highest scoring multi-role asset")
                assigned_tasks[primary.sat_id] = task
                self.selected_satellite_id = primary.sat_id
                self.selected_task = task
                self.last_reason_summary = f"{primary.sat_id} selected for {task}"

            # Secondary assignments for remaining visible satellites
            for s in visible_sats:
                if s.sat_id in assigned_tasks:
                    continue
                if "PNT" in s.capabilities and "PNT" not in assigned_tasks.values():
                    s.set_task("PNT", "Secondary PNT constellation support")
                    assigned_tasks[s.sat_id] = "PNT"
                elif "COMMUNICATION" in s.capabilities and "COMMUNICATION" not in assigned_tasks.values():
                    s.set_task("COMMUNICATION", "Telemetry downlink relay")
                    assigned_tasks[s.sat_id] = "COMMUNICATION"
                else:
                    s.set_task("IDLE", "Standby in orbital pass")
                    assigned_tasks[s.sat_id] = "IDLE"

        return {
            "selected_satellite": self.selected_satellite_id,
            "selected_task": self.selected_task,
            "reason_summary": self.last_reason_summary,
            "scores": scores,
            "sub_scores": sub_scores,
            "explanations": explanations,
            "assigned_tasks": assigned_tasks,
        }

    def evaluate_and_schedule_swarm(
        self,
        satellites: Dict[str, Satellite],
        swarm_rovers: Dict[str, Any],
        sim_time: float,
        dust_storm: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Multi-rover satellite contention scheduling.
        Allocates visible satellites among 3 competing rovers (Alpha, Beta, Gamma)
        based on:
        - Rover Mission Priority (Alpha 1.25, Beta 1.0, Gamma 0.85)
        - Rover EKF Uncertainty & Drift Risk (urgency for PNT lock)
        - Dust Storm VO Degradation (compensate with orbital PNT)
        - Elevation & Geometric Dilution of Precision (GDOP)
        - Satellite capabilities (PNT, IMAGING, COMMUNICATION)
        """
        candidates: List[Tuple[float, str, str, str, float, float]] = []
        # (utility_score, sat_id, rover_id, task, norm_elevation, urgency)

        for sat_id, sat in satellites.items():
            if sat.is_outage_forced:
                sat.score = 0.0
                sat.set_task("IDLE", "Constellation forced outage", None)
                self.previous_swarm_assignments[sat_id] = None
                continue

            for r_id, r_info in swarm_rovers.items():
                r_pos = (float(r_info["rover"].x), float(r_info["rover"].y))
                if not sat.is_visible_to_pos(r_pos):
                    continue

                ground_dist = math.hypot(sat.gx - r_pos[0], sat.gy - r_pos[1])
                elevation = math.degrees(math.atan2(sat.altitude_km * 1000.0, max(1.0, ground_dist)))
                norm_elev = min(1.0, max(0.0, (elevation - 18.0) / 72.0))

                # Rover need & drift urgency
                uncert = float(r_info["latest_uncertainty"])
                in_storm = bool(r_info.get("in_storm", False))
                prio = float(r_info.get("priority", 1.0))

                urgency = min(1.0, (uncert / 4.5) + (0.45 if in_storm else 0.0) + (0.2 if prio > 1.1 else 0.0))

                # PNT Candidate
                if "PNT" in sat.capabilities:
                    pnt_score = 0.35 * norm_elev + 0.40 * urgency + 0.25 * (prio / 1.25)
                    candidates.append((pnt_score, sat_id, r_id, "PNT", norm_elev, urgency))

                # IMAGING Candidate
                if "IMAGING" in sat.capabilities:
                    img_score = 0.35 * norm_elev + 0.35 * (0.6 if in_storm else 0.3) + 0.30 * (prio / 1.25)
                    candidates.append((img_score, sat_id, r_id, "IMAGING", norm_elev, urgency))

                # COMMUNICATION Candidate
                if "COMMUNICATION" in sat.capabilities:
                    comm_score = 0.40 * norm_elev + 0.35 * 0.4 + 0.25 * (prio / 1.25)
                    candidates.append((comm_score, sat_id, r_id, "COMMUNICATION", norm_elev, urgency))

        # Sort candidates descending by utility
        candidates.sort(key=lambda c: c[0], reverse=True)

        assigned_sats: Set[str] = set()
        rover_pnt_assigned: Dict[str, str] = {}
        assigned_tasks: Dict[str, str] = {}
        target_rovers: Dict[str, str] = {}
        reassignment_logs: List[str] = []

        # Pass 1: Ensure fair PNT distribution across high-need rovers
        for score, sat_id, r_id, task, norm_elev, urgency in candidates:
            if sat_id in assigned_sats:
                continue
            if task == "PNT" and r_id in rover_pnt_assigned:
                continue

            assigned_sats.add(sat_id)
            if task == "PNT":
                rover_pnt_assigned[r_id] = sat_id

            sat = satellites[sat_id]
            sat.score = float(round(score, 3))
            assigned_tasks[sat_id] = task
            target_rovers[sat_id] = r_id
            r_callsign = swarm_rovers[r_id].get("callsign", r_id)
            reason = f"Swarm: Allocated to {r_id} ({r_callsign}) for {task} [Prio {swarm_rovers[r_id].get('priority', 1.0):.2f}, Urg {urgency:.2f}]"
            sat.set_task(task, reason, target_rover_id=r_id)

            prev = self.previous_swarm_assignments.get(sat_id)
            if prev and prev != r_id:
                prev_callsign = swarm_rovers.get(prev, {}).get("callsign", prev)
                if urgency > 0.4 or swarm_rovers[r_id].get("in_storm"):
                    msg = f"{sat_id} reassigned from {prev} ({prev_callsign}) → {r_id} ({r_callsign}) [{task}] due to 2σ uncertainty drift spike"
                else:
                    msg = f"{sat_id} dynamic orbital handoff from {prev} ({prev_callsign}) → {r_id} ({r_callsign}) [{task}]"
                reassignment_logs.append(msg)

            self.previous_swarm_assignments[sat_id] = r_id

        # Pass 2: Fill any unassigned visible satellites with remaining best tasks
        for score, sat_id, r_id, task, norm_elev, urgency in candidates:
            if sat_id in assigned_sats:
                continue

            assigned_sats.add(sat_id)
            sat = satellites[sat_id]
            sat.score = float(round(score, 3))
            assigned_tasks[sat_id] = task
            target_rovers[sat_id] = r_id
            r_callsign = swarm_rovers[r_id].get("callsign", r_id)
            reason = f"Swarm Secondary: {r_id} ({r_callsign}) [{task}]"
            sat.set_task(task, reason, target_rover_id=r_id)
            self.previous_swarm_assignments[sat_id] = r_id

        # Idle any remaining satellites
        for sat_id, sat in satellites.items():
            if sat_id not in assigned_sats and not sat.is_outage_forced:
                sat.score = 0.05
                sat.set_task("IDLE", "Standby in orbital pass", target_rover_id=None)
                self.previous_swarm_assignments[sat_id] = None

        summary_reason = f"Multi-Rover Contention: {len(assigned_sats)}/4 orbiters dynamically allocated across 3 rovers"

        return {
            "assigned_tasks": assigned_tasks,
            "target_rovers": target_rovers,
            "reassignment_logs": reassignment_logs,
            "reason_summary": summary_reason,
            "scores": {s_id: s.score for s_id, s in satellites.items()},
        }
