"""
NAVIS - Martian Procedural Terrain Generator and Cost Surface
Generates multi-feature terrain (Flat, Rocks, Slopes, Craters, Hazards, Science Target).
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import math


class TerrainType:
    NORMAL = "normal"
    ROCK = "rock"
    SLOPE = "slope"
    HAZARD = "hazard"
    CRATER = "crater"
    TARGET = "target"


class DustStorm:
    """
    Dynamic moving Martian dust storm fault model.
    Drifts smoothly across the terrain grid and severely occludes Visual Odometry (VO).
    """

    def __init__(
        self,
        x: float = 220.0,
        y: float = 220.0,
        radius: float = 90.0,
        vx: float = 5.5,
        vy: float = 3.5,
        intensity: float = 0.85,
    ):
        self.active: bool = False
        self.x: float = float(x)
        self.y: float = float(y)
        self.radius: float = float(radius)
        self.vx: float = float(vx)
        self.vy: float = float(vy)
        self.intensity: float = float(intensity)
        self.rover_in_storm: bool = False

    def update(self, dt: float, width_m: float = 600.0, height_m: float = 600.0) -> None:
        """Step dust storm position with smooth gentle bounce off map edges."""
        if not self.active or dt <= 0:
            return

        self.x += self.vx * dt
        self.y += self.vy * dt

        pad = self.radius * 0.4
        if self.x < pad:
            self.x = pad
            self.vx = abs(self.vx)
        elif self.x > width_m - pad:
            self.x = width_m - pad
            self.vx = -abs(self.vx)

        if self.y < pad:
            self.y = pad
            self.vy = abs(self.vy)
        elif self.y > height_m - pad:
            self.y = height_m - pad
            self.vy = -abs(self.vy)

    def check_inside(self, px: float, py: float) -> bool:
        """Return True if coordinates (px, py) are within active storm radius."""
        if not self.active:
            return False
        return math.hypot(px - self.x, py - self.y) <= self.radius

    def spawn_upwind(
        self,
        rover_x: float,
        rover_y: float,
        heading: float,
        distance: float = 65.0,
    ) -> None:
        """
        Spawn the dust storm upwind along the rover's projected path so it impacts within seconds.
        """
        target_x = rover_x + math.cos(heading) * distance
        target_y = rover_y + math.sin(heading) * distance
        self.x = float(np.clip(target_x, 70.0, 530.0))
        self.y = float(np.clip(target_y, 70.0, 530.0))

        # Drift direction: slightly angled back towards rover's path
        drift_angle = heading + math.pi + float(np.random.uniform(-0.35, 0.35))
        speed = 6.5
        self.vx = float(speed * math.cos(drift_angle))
        self.vy = float(speed * math.sin(drift_angle))
        self.active = True
        self.rover_in_storm = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "active": bool(self.active),
            "x": round(float(self.x), 2),
            "y": round(float(self.y), 2),
            "radius": round(float(self.radius), 2),
            "intensity": round(float(self.intensity), 2),
            "vx": round(float(self.vx), 2),
            "vy": round(float(self.vy), 2),
            "rover_in_storm": bool(self.rover_in_storm),
        }


class MarsTerrain:
    """
    Simulates a 2D Martian grid with continuous coordinate mappings.
    Grid Size: width_m x height_m (default 600m x 600m), discrete resolution (e.g., 60x60 cells).
    Supports two presets: 'procedural' and 'jezero_crater'.
    """

    COST_NORMAL = 1.0
    COST_ROCK = 5.0
    COST_SLOPE = 8.0
    COST_HAZARD = 1000.0

    def __init__(
        self,
        width_m: float = 600.0,
        height_m: float = 600.0,
        grid_res: int = 60,
        seed: Optional[int] = 42,
        preset: str = "procedural",
    ):
        self.width_m = width_m
        self.height_m = height_m
        self.grid_res = grid_res
        self.cell_size = width_m / grid_res
        self.seed = seed
        self.preset = preset if preset in ["procedural", "jezero_crater"] else "procedural"

        # Positions
        self.start_pos = (50.0, 50.0)
        self.target_pos = (540.0, 530.0)

        # Dynamic hazards list: [{'x': float, 'y': float, 'radius': float, 'type': str, 'id': str}]
        self.injected_hazards: List[Dict[str, Any]] = []

        # Data grids
        self.elevation_grid = np.zeros((grid_res, grid_res), dtype=np.float32)
        self.slope_grid = np.zeros((grid_res, grid_res), dtype=np.float32)
        self.cost_grid = np.ones((grid_res, grid_res), dtype=np.float32)
        self.type_grid = np.full((grid_res, grid_res), TerrainType.NORMAL, dtype=object)

        # Crater records
        self.craters: List[Dict[str, float]] = []
        self.rock_fields: List[Dict[str, float]] = []

        self.generate(seed=seed)

    def generate(self, seed: Optional[int] = None) -> None:
        """Generate Martian topography according to active preset."""
        if seed is not None:
            self.seed = seed
            np.random.seed(seed)

        if self.preset == "jezero_crater":
            self._generate_jezero_crater()
        else:
            self._generate_procedural()

    def _generate_procedural(self) -> None:
        """Procedurally generate multi-octave Mars plains with craters and rock fields."""
        N = self.grid_res
        x = np.linspace(0, self.width_m, N)
        y = np.linspace(0, self.height_m, N)
        X, Y = np.meshgrid(x, y)

        # 1. Harmonic Multi-Octave Elevation Surface (Martian plains & ridges)
        elevation = np.zeros((N, N), dtype=np.float32)
        harmonics = [
            (0.003, 18.0),
            (0.007, 10.0),
            (0.015, 5.0),
            (0.035, 2.2),
            (0.08, 0.8),
        ]
        for freq, amp in harmonics:
            phase_x = np.random.uniform(0, 2 * np.pi)
            phase_y = np.random.uniform(0, 2 * np.pi)
            elevation += amp * (
                np.sin(freq * X + phase_x) * np.cos(freq * Y + phase_y)
                + 0.5 * np.cos(freq * 1.4 * X - phase_y)
            )

        # Base elevation range ~ 0 to 45 meters
        elevation -= elevation.min()

        # 2. Procedural Craters
        self.craters = []
        num_craters = 6
        for _ in range(num_craters):
            cx = float(np.random.uniform(100.0, self.width_m - 100.0))
            cy = float(np.random.uniform(100.0, self.height_m - 100.0))
            if math.hypot(cx - self.start_pos[0], cy - self.start_pos[1]) < 80:
                continue
            if math.hypot(cx - self.target_pos[0], cy - self.target_pos[1]) < 80:
                continue

            radius = float(np.random.uniform(25.0, 55.0))
            depth = float(np.random.uniform(12.0, 25.0))
            self.craters.append({"x": cx, "y": cy, "radius": radius, "depth": depth})

            dist = np.hypot(X - cx, Y - cy)
            bowl = dist <= radius
            elevation[bowl] -= depth * (1.0 - (dist[bowl] / radius) ** 2)
            rim = (dist > radius) & (dist <= radius * 1.3)
            elevation[rim] += depth * 0.35 * np.exp(-((dist[rim] - radius) ** 2) / (2 * (radius * 0.15) ** 2))

        self.elevation_grid = elevation

        # 3. Slopes & Hazards
        self._compute_slopes_and_costs(X, Y)

    def _generate_jezero_crater(self) -> None:
        """
        Deterministic Martian elevation map modeled on NASA Perseverance's Jezero Crater western river delta:
        - Raised crater rim ridge on western edge (X < 130m, 30-40m elevation)
        - Branching river delta escarpment cutting across center with cliff edges
        - Ancient flat lakebed floor basin in eastern half (X > 320m)
        - Distinctive impact features (e.g. Belva remnant crater) and delta boulder fields
        """
        N = self.grid_res
        x = np.linspace(0, self.width_m, N)
        y = np.linspace(0, self.height_m, N)
        X, Y = np.meshgrid(x, y)

        # 1. Base lakebed basin floor (elevation ~ 8m)
        elevation = 9.0 + 2.5 * np.sin(0.007 * X) * np.cos(0.007 * Y)

        # 2. Raised Western Crater Rim Ridge (high ridge along X < 130m)
        rim_factor = np.clip((140.0 - X) / 140.0, 0.0, 1.0)
        elevation += 30.0 * (rim_factor ** 1.8)

        # 3. Western River Delta Escarpment (fanning from inlet at ~85m,255m to 310m,170-380m)
        delta_lobe = (X >= 80.0) & (X <= 310.0) & (np.abs(Y - (255.0 + 0.14 * (X - 80.0))) <= 0.65 * (X - 55.0))
        delta_profile = np.clip((310.0 - X) / 230.0, 0.0, 1.0)
        elevation[delta_lobe] += 17.0 * delta_profile[delta_lobe]

        # 4. Jezero Impact Craters (Belva crater remnant and delta pit)
        self.craters = [
            {"x": 420.0, "y": 190.0, "radius": 40.0, "depth": 18.0},
            {"x": 210.0, "y": 480.0, "radius": 34.0, "depth": 15.0},
            {"x": 480.0, "y": 450.0, "radius": 28.0, "depth": 12.0},
        ]
        for cr in self.craters:
            dist = np.hypot(X - cr["x"], Y - cr["y"])
            bowl = dist <= cr["radius"]
            elevation[bowl] -= cr["depth"] * (1.0 - (dist[bowl] / cr["radius"]) ** 2)
            rim = (dist > cr["radius"]) & (dist <= cr["radius"] * 1.3)
            elevation[rim] += cr["depth"] * 0.35 * np.exp(-((dist[rim] - cr["radius"]) ** 2) / (2 * (cr["radius"] * 0.15) ** 2))

        self.elevation_grid = elevation

        # 5. Jezero Delta Front Boulder / Rock Fields
        self.rock_fields = [
            {"x": 260.0, "y": 210.0, "radius": 30.0},
            {"x": 310.0, "y": 300.0, "radius": 28.0},
            {"x": 180.0, "y": 340.0, "radius": 26.0},
            {"x": 390.0, "y": 130.0, "radius": 24.0},
            {"x": 460.0, "y": 360.0, "radius": 30.0},
        ]

        # 6. Compute Slopes & Assign Traversal Costs
        self._compute_slopes_and_costs(X, Y, custom_rocks=True)

    def _compute_slopes_and_costs(self, X: np.ndarray, Y: np.ndarray, custom_rocks: bool = False) -> None:
        """Calculate terrain slope gradient and map to cost matrix."""
        N = self.grid_res
        gy, gx = np.gradient(self.elevation_grid, self.cell_size)
        self.slope_grid = np.sqrt(gx**2 + gy**2)

        if not custom_rocks:
            # Generate random rock fields if not preset
            self.rock_fields = []
            num_rock_fields = 7
            for _ in range(num_rock_fields):
                rx = float(np.random.uniform(80.0, self.width_m - 80.0))
                ry = float(np.random.uniform(80.0, self.height_m - 80.0))
                rad = float(np.random.uniform(20.0, 45.0))
                self.rock_fields.append({"x": rx, "y": ry, "radius": rad})

        # Base Costs
        self.cost_grid = np.ones((N, N), dtype=np.float32) * self.COST_NORMAL
        self.type_grid = np.full((N, N), TerrainType.NORMAL, dtype=object)

        # Assign slopes (slope > 0.30 rad)
        slope_mask = self.slope_grid > 0.30
        self.cost_grid[slope_mask] = self.COST_SLOPE
        self.type_grid[slope_mask] = TerrainType.SLOPE

        # Assign rocks
        for rf in self.rock_fields:
            dist = np.hypot(X - rf["x"], Y - rf["y"])
            rock_mask = dist <= rf["radius"]
            self.cost_grid[rock_mask] = np.maximum(self.cost_grid[rock_mask], self.COST_ROCK)
            self.type_grid[rock_mask] = TerrainType.ROCK

        # Assign crater hazard pits
        for cr in self.craters:
            dist = np.hypot(X - cr["x"], Y - cr["y"])
            hazard_mask = dist <= (cr["radius"] * 0.85)
            self.cost_grid[hazard_mask] = self.COST_HAZARD
            self.type_grid[hazard_mask] = TerrainType.HAZARD

        # Apply any active injected hazards
        self._apply_injected_hazards()

    def _apply_injected_hazards(self) -> None:
        """Overlay dynamic/user injected hazards onto cost grid."""
        N = self.grid_res
        x = np.linspace(0, self.width_m, N)
        y = np.linspace(0, self.height_m, N)
        X, Y = np.meshgrid(x, y)

        for hz in self.injected_hazards:
            dist = np.hypot(X - hz["x"], Y - hz["y"])
            mask = dist <= hz["radius"]
            self.cost_grid[mask] = self.COST_HAZARD
            self.type_grid[mask] = TerrainType.HAZARD

    def inject_hazard(
        self,
        x: float,
        y: float,
        radius: float = 28.0,
        hazard_type: str = "ROCK_FIELD",
        hazard_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dynamically adds a hazard zone to trigger AI replanning."""
        if hazard_id is None:
            hazard_id = f"HZ-{len(self.injected_hazards)+1:02d}"

        hazard = {
            "id": hazard_id,
            "x": float(np.clip(x, 0, self.width_m)),
            "y": float(np.clip(y, 0, self.height_m)),
            "radius": float(radius),
            "type": hazard_type,
        }
        self.injected_hazards.append(hazard)
        self._apply_injected_hazards()
        return hazard

    def clear_injected_hazards(self) -> None:
        """Clear dynamic hazards and regenerate base costs."""
        self.injected_hazards.clear()
        self.generate(seed=self.seed)

    def world_to_grid(self, x: float, y: float) -> Tuple[int, int]:
        """Map world coordinates (meters) to grid indices (col, row)."""
        gx = int(np.clip(round(x / self.cell_size), 0, self.grid_res - 1))
        gy = int(np.clip(round(y / self.cell_size), 0, self.grid_res - 1))
        return gx, gy

    def grid_to_world(self, gx: int, gy: int) -> Tuple[float, float]:
        """Map grid indices (col, row) to world coordinates (meters)."""
        return gx * self.cell_size, gy * self.cell_size

    def get_cost(self, x: float, y: float) -> float:
        """Get traversal cost at world position (x, y)."""
        gx, gy = self.world_to_grid(x, y)
        return float(self.cost_grid[gy, gx])

    def get_elevation(self, x: float, y: float) -> float:
        """Get terrain elevation (meters) at world position (x, y)."""
        gx, gy = self.world_to_grid(x, y)
        return float(self.elevation_grid[gy, gx])

    def get_slope(self, x: float, y: float) -> float:
        """Get terrain slope at world position (x, y)."""
        gx, gy = self.world_to_grid(x, y)
        return float(self.slope_grid[gy, gx])

    def is_in_hazard(self, x: float, y: float, margin: float = 2.0) -> bool:
        """Check if position is inside or dangerously close to a hazard."""
        cost = self.get_cost(x, y)
        if cost >= self.COST_HAZARD:
            return True
        for hz in self.injected_hazards:
            if math.hypot(x - hz["x"], y - hz["y"]) <= (hz["radius"] + margin):
                return True
        for cr in self.craters:
            if math.hypot(x - cr["x"], y - cr["y"]) <= (cr["radius"] * 0.85 + margin):
                return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Export compact data structure for frontend visualization."""
        # Subsample or return grid for frontend rendering
        return {
            "preset": self.preset,
            "width_m": self.width_m,
            "height_m": self.height_m,
            "grid_res": self.grid_res,
            "cell_size": self.cell_size,
            "start_pos": [float(self.start_pos[0]), float(self.start_pos[1])],
            "target_pos": [float(self.target_pos[0]), float(self.target_pos[1])],
            "craters": self.craters,
            "rock_fields": self.rock_fields,
            "injected_hazards": self.injected_hazards,
            "elevation_summary": {
                "min": float(self.elevation_grid.min()),
                "max": float(self.elevation_grid.max()),
            },
            # Return downsampled elevation grid (e.g. 30x30 or full 60x60)
            "elevation": self.elevation_grid.tolist(),
            "cost_grid": self.cost_grid.tolist(),
        }
