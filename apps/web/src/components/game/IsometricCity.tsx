import { useRef, useEffect, useCallback, useState } from "react";
import { preloadSprites, getSpriteForBuilding, getSprite, GROUND_COLOR_A, GROUND_COLOR_B, GROUND_EMPTY } from "../../lib/spriteMap";

const TILE_W = 72;
const TILE_H = 36;
const SPRITE_SIZE = 64;

interface Building {
  id: string; defId: string; gridX: number; gridY: number;
  level: number; status: string; finishAt?: number;
}

function toIso(gx: number, gy: number): [number, number] {
  return [(gx - gy) * (TILE_W / 2), (gx + gy) * (TILE_H / 2)];
}

function fromIso(px: number, py: number): [number, number] {
  const gx = (px / (TILE_W / 2) + py / (TILE_H / 2)) / 2;
  const gy = (py / (TILE_H / 2) - px / (TILE_W / 2)) / 2;
  return [Math.floor(gx), Math.floor(gy)];
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + TILE_W / 2, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx - TILE_W / 2, cy + TILE_H / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default function IsometricCity({ buildings, buildingDefs, selectedSlot, onClickTile, gridSize = 5 }: {
  buildings: Building[];
  buildingDefs: any[];
  selectedSlot: { x: number; y: number } | null;
  onClickTile: (gx: number, gy: number) => void;
  gridSize?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(false);
  const GRID = gridSize;
  const animRef = useRef(0);

  useEffect(() => {
    preloadSprites().then(() => setSpritesReady(true));
  }, []);

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
    const offsetY = 40;
    const now = Date.now();

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw grid back-to-front
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const [ix, iy] = toIso(gx, gy);
        const cx = offsetX + ix;
        const cy = offsetY + iy;

        // Ground tile
        const isSelected = selectedSlot && selectedSlot.x === gx && selectedSlot.y === gy;
        const hasBuilding = buildings.some((b) => b.gridX === gx && b.gridY === gy);
        const groundColor = isSelected ? "#66BB6A" : hasBuilding
          ? ((gx + gy) % 2 === 0 ? "#A5D6A7" : "#81C784")
          : ((gx + gy) % 2 === 0 ? GROUND_COLOR_A : GROUND_COLOR_B);

        drawDiamond(ctx, cx, cy, groundColor, isSelected ? 0.9 : 1);

        // Selected slot indicator
        if (isSelected) {
          drawDiamond(ctx, cx, cy, "rgba(255,255,255,0.3)");
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + TILE_W / 2, cy + TILE_H / 2);
          ctx.lineTo(cx, cy + TILE_H);
          ctx.lineTo(cx - TILE_W / 2, cy + TILE_H / 2);
          ctx.closePath();
          ctx.stroke();
        }

        // Building sprite
        const b = buildings.find((b) => b.gridX === gx && b.gridY === gy);
        if (b && spritesReady) {
          const spritePath = getSpriteForBuilding(b.defId, b.level);
          const filename = spritePath.replace("/sprites/", "");
          const img = getSprite(filename);

          const isBuilding = b.status === "building" || b.status === "upgrading";
          const alpha = isBuilding ? 0.4 + 0.2 * Math.sin(now / 300) : 1;

          if (img) {
            ctx.globalAlpha = alpha;
            // Center sprite on tile, raise it above ground
            const spriteScale = TILE_W / SPRITE_SIZE * 1.3;
            const sw = SPRITE_SIZE * spriteScale;
            const sh = SPRITE_SIZE * spriteScale;
            const sx = cx - sw / 2;
            const sy = cy + TILE_H / 2 - sh + 4; // bottom-aligned to tile center
            ctx.drawImage(img, sx, sy, sw, sh);
            ctx.globalAlpha = 1;
          } else {
            // Fallback: draw colored block
            drawFallbackBuilding(ctx, cx, cy, b);
          }

          // Level badge
          if (b.level > 0 && b.status === "built") {
            const badgeX = cx + TILE_W / 4;
            const badgeY = cy - 2;
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("" + b.level, badgeX, badgeY);
          }

          // Building/upgrading icon
          if (isBuilding) {
            ctx.font = "14px serif";
            ctx.textAlign = "center";
            ctx.fillText("🔨", cx, cy + 2);
          }
        }
      }
    }

    // Animate building construction
    if (buildings.some((b) => b.status === "building" || b.status === "upgrading")) {
      animRef.current = requestAnimationFrame(() => draw());
    }
  }, [buildings, selectedSlot, spritesReady, GRID]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => {
      window.removeEventListener("resize", draw);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - 40;
    const [gx, gy] = fromIso(px, py);
    if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
      onClickTile(gx, gy);
    }
  };

  return (
    <canvas ref={canvasRef} onClick={handleClick}
      className="w-full cursor-pointer"
      style={{ height: "380px" }} />
  );
}

// Fallback if sprite not loaded
function drawFallbackBuilding(ctx: CanvasRenderingContext2D, cx: number, cy: number, b: any) {
  const h = 24;
  ctx.fillStyle = "#78909C";
  ctx.beginPath();
  ctx.moveTo(cx - TILE_W / 3, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx, cy + TILE_H - h);
  ctx.lineTo(cx - TILE_W / 3, cy + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + TILE_W / 3, cy + TILE_H / 2);
  ctx.lineTo(cx, cy + TILE_H);
  ctx.lineTo(cx, cy + TILE_H - h);
  ctx.lineTo(cx + TILE_W / 3, cy + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fillStyle = "#546E7A";
  ctx.fill();
}
