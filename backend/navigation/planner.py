"""
NAVIS - A* Path Planning & Dynamic Route Replanning
Computes optimal, safe paths on continuous Mars terrain grid with terrain cost weighting.
Supports dynamic replanning when hazards are injected or detected by imaging satellites.
"""

from typing import List, Tuple, Dict, Any, Optional
import heapq
import math
import numpy as np


class AStarPlanner:
    """
    8-Directional A* Path Planner with terrain cost field and path smoothing.
    """

    def __init__(self, terrain):
        self.terrain = terrain
        self.old_route: List[Tuple[float, float]] = []
        self.current_route: List[Tuple[float, float]] = []
        self.replanned_count = 0
        self.last_replan_reason = ""

    def _build_padded_cost_grid(self, cost_grid: np.ndarray) -> np.ndarray:
        """Inflate hazard cells by a 1-cell safety margin via vectorized 3x3 dilation."""
        hazard_mask = cost_grid >= self.terrain.COST_HAZARD
        if not np.any(hazard_mask):
            return cost_grid

        h, w = hazard_mask.shape
        padded_mask = np.zeros((h + 2, w + 2), dtype=bool)
        padded_mask[1:-1, 1:-1] = hazard_mask
        dilated = (
            padded_mask[:-2, :-2]
            | padded_mask[:-2, 1:-1]
            | padded_mask[:-2, 2:]
            | padded_mask[1:-1, :-2]
            | padded_mask[1:-1, 1:-1]
            | padded_mask[1:-1, 2:]
            | padded_mask[2:, :-2]
            | padded_mask[2:, 1:-1]
            | padded_mask[2:, 2:]
        )

        padded = cost_grid.copy()
        margin_cost = self.terrain.COST_HAZARD * 0.6
        padded[dilated & (padded < margin_cost)] = margin_cost
        return padded

    def _find_nearest_free_cell(
        self,
        start_gx: int,
        start_gy: int,
        start_world: Tuple[float, float],
        cost_grid: np.ndarray,
    ) -> Optional[Tuple[int, int]]:
        """Find nearest non-hazard grid cell, preferring the outward normal from enclosing hazards."""
        grid_res = self.terrain.grid_res
        # Check if inside an injected hazard to bias toward outward radial normal
        outward_dx, outward_dy = 0.0, 0.0
        for hz in getattr(self.terrain, "injected_hazards", []):
            dx = start_world[0] - hz["x"]
            dy = start_world[1] - hz["y"]
            dist = math.hypot(dx, dy)
            if dist <= hz["radius"] + self.terrain.cell_size:
                if dist < 1e-3:
                    outward_dx, outward_dy = 1.0, 0.0
                else:
                    outward_dx, outward_dy = dx / dist, dy / dist
                break

        best_cell: Optional[Tuple[int, int]] = None
        best_score = float("inf")
        for r in range(1, 10):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    nx, ny = start_gx + dx, start_gy + dy
                    if 0 <= nx < grid_res and 0 <= ny < grid_res:
                        if float(cost_grid[ny, nx]) < self.terrain.COST_HAZARD:
                            step_norm = math.hypot(dx, dy)
                            align_bonus = 0.0
                            if outward_dx != 0.0 or outward_dy != 0.0:
                                dot = (dx / step_norm) * outward_dx + (dy / step_norm) * outward_dy
                                align_bonus = -dot * 1.5
                            score = step_norm + align_bonus
                            if score < best_score:
                                best_score = score
                                best_cell = (nx, ny)
            if best_cell is not None:
                return best_cell
        return None

    def plan_path(
        self,
        start_world: Tuple[float, float],
        goal_world: Tuple[float, float],
        cost_grid: Optional[np.ndarray] = None,
    ) -> List[Tuple[float, float]]:
        """
        Execute A* pathfinding on discrete grid and convert to smooth world waypoints.
        """
        if cost_grid is None:
            cost_grid = self.terrain.cost_grid

        padded_grid = self._build_padded_cost_grid(cost_grid)

        grid_res = self.terrain.grid_res
        cell_size = self.terrain.cell_size

        orig_start_gx, orig_start_gy = self.terrain.world_to_grid(start_world[0], start_world[1])
        goal_gx, goal_gy = self.terrain.world_to_grid(goal_world[0], goal_world[1])

        escape_world: Optional[Tuple[float, float]] = None
        start_gx, start_gy = orig_start_gx, orig_start_gy

        # If start cell is inside a hazard, escape to nearest free cell first
        if float(cost_grid[orig_start_gy, orig_start_gx]) >= self.terrain.COST_HAZARD:
            free_cell = self._find_nearest_free_cell(orig_start_gx, orig_start_gy, start_world, cost_grid)
            if free_cell is not None:
                start_gx, start_gy = free_cell
                escape_world = (
                    start_gx * cell_size + cell_size * 0.5,
                    start_gy * cell_size + cell_size * 0.5,
                )

        # Priority queue for open set: (f_score, h_score, (gx, gy))
        open_set: List[Tuple[float, float, Tuple[int, int]]] = []
        heapq.heappush(open_set, (0.0, 0.0, (start_gx, start_gy)))

        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
        g_score: Dict[Tuple[int, int], float] = {(start_gx, start_gy): 0.0}
        closed_set = set()

        # 8-Directional Neighbors with step lengths
        neighbors = [
            (1, 0, 1.0),
            (-1, 0, 1.0),
            (0, 1, 1.0),
            (0, -1, 1.0),
            (1, 1, 1.414),
            (1, -1, 1.414),
            (-1, 1, 1.414),
            (-1, -1, 1.414),
        ]

        def heuristic(gx: int, gy: int) -> float:
            # Euclidean distance with slight tie-breaker
            dx = gx - goal_gx
            dy = gy - goal_gy
            return math.hypot(dx, dy) * 1.001

        found = False

        while open_set:
            _, _, current = heapq.heappop(open_set)

            if current in closed_set:
                continue
            closed_set.add(current)

            if current == (goal_gx, goal_gy):
                found = True
                break

            cgx, cgy = current
            current_g = g_score[current]
            current_in_hazard = float(cost_grid[cgy, cgx]) >= self.terrain.COST_HAZARD

            for dx, dy, step_len in neighbors:
                ngx, ngy = cgx + dx, cgy + dy

                # Bounds check
                if not (0 <= ngx < grid_res and 0 <= ngy < grid_res):
                    continue

                cell_cost = float(padded_grid[ngy, ngx])
                # Allow stepping out if currently inside a hazard cell; otherwise block hazards
                if not current_in_hazard and float(cost_grid[ngy, ngx]) >= self.terrain.COST_HAZARD:
                    continue

                # Edge cost = step distance * cell traversal cost
                edge_cost = step_len * cell_cost
                tentative_g = current_g + edge_cost

                neighbor = (ngx, ngy)
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    g_score[neighbor] = tentative_g
                    h = heuristic(ngx, ngy)
                    f = tentative_g + h
                    came_from[neighbor] = current
                    heapq.heappush(open_set, (f, h, neighbor))

        if not found:
            # Fallback direct line if completely blocked
            if escape_world is not None:
                return [start_world, escape_world, goal_world]
            return [start_world, goal_world]

        # Reconstruct grid path
        grid_path = []
        curr = (goal_gx, goal_gy)
        while curr in came_from:
            grid_path.append(curr)
            curr = came_from[curr]
        grid_path.append((start_gx, start_gy))
        grid_path.reverse()

        # Convert to world coordinates
        world_path = [
            (
                gx * cell_size + cell_size * 0.5,
                gy * cell_size + cell_size * 0.5,
            )
            for gx, gy in grid_path
        ]

        # Smooth waypoints (reduce redundant collinear grid nodes)
        smoothed = self._smooth_path(world_path, padded_grid)
        if escape_world is not None:
            smoothed = [start_world, escape_world] + smoothed[1:]
        elif smoothed:
            smoothed[0] = start_world
        if smoothed:
            smoothed[-1] = goal_world

        return smoothed

    def _smooth_path(
        self,
        raw_path: List[Tuple[float, float]],
        cost_grid: np.ndarray,
    ) -> List[Tuple[float, float]]:
        """String-pulling / shortcut path smoother to eliminate grid jaggedness."""
        if len(raw_path) <= 2:
            return raw_path

        smoothed = [raw_path[0]]
        current_idx = 0

        while current_idx < len(raw_path) - 1:
            furthest_visible = current_idx + 1
            for look_idx in range(len(raw_path) - 1, current_idx + 1, -1):
                if self._line_of_sight(
                    raw_path[current_idx], raw_path[look_idx], cost_grid
                ):
                    furthest_visible = look_idx
                    break
            smoothed.append(raw_path[furthest_visible])
            current_idx = furthest_visible

        return smoothed

    def _line_of_sight(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        cost_grid: np.ndarray,
    ) -> bool:
        """Check if straight segment between p1 and p2 crosses high-cost hazards or rocks."""
        dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        steps = max(2, int(dist / (self.terrain.cell_size * 0.5)))
        for i in range(steps + 1):
            alpha = i / steps
            qx = p1[0] + alpha * (p2[0] - p1[0])
            qy = p1[1] + alpha * (p2[1] - p1[1])
            gx, gy = self.terrain.world_to_grid(qx, qy)
            if cost_grid[gy, gx] >= (self.terrain.COST_HAZARD * 0.5):
                return False
        return True

    def trigger_replan(
        self,
        current_rover_pos: Tuple[float, float],
        goal_world: Tuple[float, float],
        reason: str = "HAZARD_DETECTED",
    ) -> Dict[str, Any]:
        """
        Archive previous path and calculate new safe route avoiding the latest hazard.
        """
        # Save previous route
        self.old_route = list(self.current_route)
        self.last_replan_reason = reason
        self.replanned_count += 1

        new_route = self.plan_path(current_rover_pos, goal_world)
        self.current_route = new_route

        return {
            "replan_id": f"REPLAN-{self.replanned_count:02d}",
            "reason": reason,
            "old_route": self.old_route,
            "new_route": self.current_route,
            "waypoints_count": len(self.current_route),
        }
