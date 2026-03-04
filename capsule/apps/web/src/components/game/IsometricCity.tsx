import { useRef, useEffect, useCallback } from "react";

const TILE_W = 64;
const TILE_H = 32;

interface Building {
  id: string; defId: string; gridX: number; gridY: number;
  level: number; status: string; finishAt?: number;
}

interface BuildingDef {
  id: string; name: string; color: string; height: number; emoji: string;
}

function toIso(gx: number, gy: number): [number, number] {
  const x = (gx - gy) * (TILE_W / 2);
  const y = (gx + gy) * (TILE_H / 2);
  return [x, y];
}

function fromIso(px: number, py: number): [number, number] {
  const gx = (px / (TILE_W / 2) + py / (TILE_H / 2)) / 2;
  const gy = (py / (TILE_H / 2) - px / (TILE_W / 2)) / 2;
  return [Math.floor(gx), Math.floor(gy)];
}

function drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + TILE_W / 2, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx - TILE_W / 2, cy + TILE_H / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBuilding(ctx: CanvasRenderingContext2D, cx: number, cy: number, def: BuildingDef, level: number, status: string) {
  const h = (def.height + level * 0.3) * 12;
  const alpha = status === "building" || status === "upgrading" ? 0.5 : 1;
  ctx.globalAlpha = alpha;

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - TILE_W / 2, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx, cy + TILE_H - h);
  ctx.lineTo(cx - TILE_W / 2, cy + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fillStyle = darken(def.color, 0.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + TILE_W / 2, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx, cy + TILE_H - h);
  ctx.lineTo(cx + TILE_W / 2, cy + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fillStyle = darken(def.color, 0.35);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy + TILE_H - h);
  ctx.lineTo(cx + TILE_W / 2, cy + TILE_H / 2 - h);
  ctx.lineTo(cx, cy - h);
  ctx.lineTo(cx - TILE_W / 2, cy + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.stroke();

  // Windows (dots on left face)
  const windowRows = Math.min(Math.floor(h / 14), 6);
  ctx.fillStyle = "rgba(255,255,200,0.7)";
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < 2; col++) {
      const wy = cy + TILE_H - 8 - row * 14;
      const wx = cx - TILE_W / 4 + col * 12 - 3;
      ctx.fillRect(wx, wy - h + row * 0.5, 3, 4);
    }
  }

  // Level badge
  if (level > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lv" + level, cx, cy + TILE_H - h - 4);
  }

  // Emoji on top
  ctx.font = "14px serif";
  ctx.textAlign = "center";
  ctx.fillText(def.emoji, cx, cy - h + 4);

  // Building animation
  if (status === "building" || status === "upgrading") {
    ctx.font = "10px sans-serif";
    ctx.fillText("🔨", cx + 10, cy + TILE_H - h);
  }

  ctx.globalAlpha = 1;
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * (1 - amount))},${Math.floor(g * (1 - amount))},${Math.floor(b * (1 - amount))})`;
}

export default function IsometricCity({ buildings, buildingDefs, selectedSlot, onClickTile, gridSize = 5 }: {
  buildings: Building[];
  buildingDefs: BuildingDef[];
  selectedSlot: { x: number; y: number } | null;
  onClickTile: (gx: number, gy: number) => void;
  gridSize?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const defMap = new Map(buildingDefs.map((d) => [d.id, d]));
  const GRID = gridSize;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const offsetX = rect.width / 2;
    const offsetY = 60;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw grid back-to-front for proper overlap
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const [ix, iy] = toIso(gx, gy);
        const cx = offsetX + ix;
        const cy = offsetY + iy;

        // Ground tile
        const isSelected = selectedSlot && selectedSlot.x === gx && selectedSlot.y === gy;
        drawTile(ctx, cx, cy, isSelected ? "#86EFAC" : (gx + gy) % 2 === 0 ? "#C7D2C0" : "#B8C4B1");

        // Building
        const b = buildings.find((b) => b.gridX === gx && b.gridY === gy);
        if (b) {
          const def = defMap.get(b.defId);
          if (def) drawBuilding(ctx, cx, cy, def, b.level, b.status);
        }
      }
    }
  }, [buildings, buildingDefs, selectedSlot]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - 60;
    const [gx, gy] = fromIso(px, py);
    if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
      onClickTile(gx, gy);
    }
  };

  return (
    <canvas ref={canvasRef} onClick={handleClick}
      className="w-full cursor-pointer"
      style={{ height: "340px" }} />
  );
}
