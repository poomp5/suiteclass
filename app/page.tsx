"use client";

import Image from "next/image";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const BOARD_SIZE = 8;
const POPUP_INTERVAL_MS = 10_000;
const TRAY_CELL_PX = 22;
const DRAG_CELL_PX = 38;

type Cell = string | null; // null = empty, otherwise = color
type Board = Cell[][];
type Shape = { id: string; cells: [number, number][]; color: string };

const PALETTE = [
  "#ff6ec7",
  "#ffd166",
  "#06d6a0",
  "#ef476f",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#facc15",
];

const SHAPE_TEMPLATES: { cells: [number, number][] }[] = [
  { cells: [[0, 0]] },
  { cells: [[0, 0], [0, 1]] },
  { cells: [[0, 0], [1, 0]] },
  { cells: [[0, 0], [0, 1], [0, 2]] },
  { cells: [[0, 0], [1, 0], [2, 0]] },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
];

const emptyBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Cell),
  );

const randomShape = (): Shape => {
  const template =
    SHAPE_TEMPLATES[Math.floor(Math.random() * SHAPE_TEMPLATES.length)];
  return {
    id: Math.random().toString(36).slice(2),
    cells: template.cells.map(([r, c]) => [r, c]) as [number, number][],
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
};

const newTray = (): Shape[] => [randomShape(), randomShape(), randomShape()];

const shapeBounds = (cells: [number, number][]) => {
  let maxR = 0;
  let maxC = 0;
  for (const [r, c] of cells) {
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return { rows: maxR + 1, cols: maxC + 1 };
};

const canPlace = (board: Board, shape: Shape, row: number, col: number) => {
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
};

const hasAnyPlacement = (board: Board, shape: Shape) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(board, shape, r, c)) return true;
    }
  }
  return false;
};

type DragState = {
  shape: Shape;
  pointerId: number;
  x: number;
  y: number;
};

export default function Home() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [tray, setTray] = useState<Shape[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupCount, setPopupCount] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("bb-best");
    if (stored) setBest(Number(stored) || 0);
    setTray(newTray());
  }, []);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      window.localStorage.setItem("bb-best", String(score));
    }
  }, [score, best]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPopupOpen(true);
      setPopupCount((n) => n + 1);
    }, POPUP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (tray.length === 0) return;
    const stuck = tray.every((s) => !hasAnyPlacement(board, s));
    if (stuck) setGameOver(true);
  }, [tray, board]);

  const hoverCell = useMemo(() => {
    if (!drag || !gridRef.current) return null;
    const cells = gridRef.current.children;
    const c00 = cells[0] as HTMLElement | undefined;
    const cLast = cells[BOARD_SIZE * BOARD_SIZE - 1] as HTMLElement | undefined;
    if (!c00 || !cLast) return null;
    const r00 = c00.getBoundingClientRect();
    const rLast = cLast.getBoundingClientRect();
    const strideX = (rLast.left - r00.left) / (BOARD_SIZE - 1);
    const strideY = (rLast.top - r00.top) / (BOARD_SIZE - 1);
    if (strideX <= 0 || strideY <= 0) return null;
    const { cols } = shapeBounds(drag.shape.cells);
    const pointerCol = (drag.x - (r00.left + r00.width / 2)) / strideX;
    const pointerRow = (drag.y - (r00.top + r00.height / 2)) / strideY;
    const col = Math.round(pointerCol - (cols - 1) / 2);
    const row = Math.round(pointerRow - 1.5);
    if (row < -2 || row > BOARD_SIZE + 2 || col < -2 || col > BOARD_SIZE + 2) {
      return null;
    }
    return { row, col };
  }, [drag]);

  const previewValid =
    drag && hoverCell
      ? canPlace(board, drag.shape, hoverCell.row, hoverCell.col)
      : false;

  const previewCells = useMemo(() => {
    if (!drag || !hoverCell || !previewValid) return new Set<string>();
    const s = new Set<string>();
    for (const [dr, dc] of drag.shape.cells) {
      s.add(`${hoverCell.row + dr}-${hoverCell.col + dc}`);
    }
    return s;
  }, [drag, hoverCell, previewValid]);

  const commitPlace = useCallback(
    (shape: Shape, row: number, col: number) => {
      setBoard((cur) => {
        if (!canPlace(cur, shape, row, col)) return cur;
        const next = cur.map((r) => r.slice()) as Board;
        for (const [dr, dc] of shape.cells) {
          next[row + dr][col + dc] = shape.color;
        }

        const fullRows: number[] = [];
        const fullCols: number[] = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          if (next[r].every((v) => v !== null)) fullRows.push(r);
        }
        for (let c = 0; c < BOARD_SIZE; c++) {
          let full = true;
          for (let r = 0; r < BOARD_SIZE; r++) {
            if (next[r][c] === null) {
              full = false;
              break;
            }
          }
          if (full) fullCols.push(c);
        }

        const cleared = fullRows.length + fullCols.length;
        if (cleared > 0) {
          for (const r of fullRows) {
            for (let c = 0; c < BOARD_SIZE; c++) next[r][c] = null;
          }
          for (const c of fullCols) {
            for (let r = 0; r < BOARD_SIZE; r++) next[r][c] = null;
          }
        }

        const placedPoints = shape.cells.length;
        const clearPoints = cleared * BOARD_SIZE * 10;
        const comboBonus = cleared > 1 ? cleared * 20 : 0;
        setScore((s) => s + placedPoints + clearPoints + comboBonus);
        setCombo(cleared > 0 ? cleared : 0);

        return next;
      });

      setTray((cur) => {
        const next = cur.filter((s) => s.id !== shape.id);
        return next.length === 0 ? newTray() : next;
      });
      return true;
    },
    [],
  );

  const startDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    shape: Shape,
  ) => {
    if (!hasAnyPlacement(board, shape)) return;
    e.preventDefault();
    setDrag({
      shape,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      ev.preventDefault();
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      if (hoverCell && previewValid) {
        commitPlace(drag.shape, hoverCell.row, hoverCell.col);
      }
      setDrag(null);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag, hoverCell, previewValid, commitPlace]);

  const reset = () => {
    setBoard(emptyBoard());
    setTray(newTray());
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setDrag(null);
  };

  const dragBounds = drag ? shapeBounds(drag.shape.cells) : null;

  return (
    <div
      className="flex flex-1 flex-col items-center justify-start px-4 py-6 sm:py-10"
      style={{
        background:
          "linear-gradient(160deg, #48caea 0%, #5aafff 60%, #4a7bd6 100%)",
        touchAction: drag ? "none" : "auto",
      }}
    >
      <header className="flex w-full max-w-md items-center justify-between text-white">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight drop-shadow-sm">
            Block
          </span>
          <span className="text-2xl font-black tracking-tight text-yellow-200 drop-shadow-sm">
            Burst
          </span>
        </div>
        <button
          onClick={reset}
          className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-white/30"
        >
          New game
        </button>
      </header>

      <div className="mt-4 grid w-full max-w-md grid-cols-3 gap-2 text-center text-white">
        <Stat label="Score" value={score} />
        <Stat label="Best" value={best} />
        <Stat label="Combo" value={`×${combo}`} />
      </div>

      <div
        ref={boardRef}
        className="mt-5 rounded-3xl bg-white/15 p-3 shadow-2xl backdrop-blur"
        style={{ touchAction: "none" }}
      >
        <div
          ref={gridRef}
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r}-${c}`;
              const filledColor = cell;
              const isPreview = previewCells.has(key);
              const isInvalidHover =
                drag &&
                hoverCell &&
                !previewValid &&
                drag.shape.cells.some(
                  ([dr, dc]) =>
                    hoverCell.row + dr === r && hoverCell.col + dc === c,
                );
              const showColor = filledColor
                ? filledColor
                : isPreview
                ? drag!.shape.color
                : isInvalidHover
                ? "#ef4444"
                : null;
              return (
                <div
                  key={key}
                  className="aspect-square rounded-md transition-colors"
                  style={{
                    background: showColor ?? "rgba(255,255,255,0.18)",
                    boxShadow: showColor
                      ? "inset 0 -3px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.35)"
                      : "inset 0 1px 0 rgba(255,255,255,0.15)",
                    opacity: isPreview && !filledColor ? 0.7 : 1,
                  }}
                />
              );
            }),
          )}
        </div>
      </div>

      <div
        className="mt-5 flex w-full max-w-md items-end justify-around rounded-3xl bg-white/15 p-4 backdrop-blur"
        style={{ touchAction: "none", minHeight: 110 }}
      >
        {tray.length === 0 ? (
          <div className="text-white/80">Loading…</div>
        ) : (
          tray.map((shape) => {
            const isDragging = drag?.shape.id === shape.id;
            const disabled = !hasAnyPlacement(board, shape);
            return (
              <div
                key={shape.id}
                onPointerDown={(e) => !disabled && startDrag(e, shape)}
                className={`cursor-grab touch-none select-none rounded-2xl p-2 ${
                  disabled ? "opacity-40" : "active:cursor-grabbing"
                }`}
                style={{ visibility: isDragging ? "hidden" : "visible" }}
              >
                <ShapePreview shape={shape} cellSize={TRAY_CELL_PX} />
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-center text-xs text-white/80">
        Drag a piece onto the board. Fill rows or columns to clear them.
      </p>

      {drag && dragBounds && (
        <div
          className="pointer-events-none fixed z-30"
          style={{
            left: drag.x,
            top: drag.y,
            transform: `translate(${-(dragBounds.cols * DRAG_CELL_PX) / 2}px, ${-(dragBounds.rows * DRAG_CELL_PX) - DRAG_CELL_PX * 0.4}px)`,
          }}
        >
          <ShapePreview shape={drag.shape} cellSize={DRAG_CELL_PX} />
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="text-3xl font-black text-slate-800">Game over</div>
            <div className="mt-2 text-slate-600">
              No more moves. You scored{" "}
              <span className="font-bold text-slate-900">{score}</span>.
            </div>
            <button
              onClick={reset}
              className="mt-5 w-full rounded-full px-5 py-3 text-base font-bold text-white shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #48caea 0%, #5aafff 100%)",
              }}
            >
              Play again
            </button>
          </div>
        </div>
      )}

      {popupOpen && (
        <BogiePopup
          count={popupCount}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </div>
      <div className="text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function ShapePreview({
  shape,
  cellSize,
}: {
  shape: Shape;
  cellSize: number;
}) {
  const { rows, cols } = shapeBounds(shape.cells);
  const filled = new Set(shape.cells.map(([r, c]) => `${r}-${c}`));
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gap: Math.max(2, Math.round(cellSize * 0.1)),
      }}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => {
          const on = filled.has(`${r}-${c}`);
          return (
            <div
              key={`${r}-${c}`}
              className="rounded-md"
              style={{
                background: on ? shape.color : "transparent",
                boxShadow: on
                  ? "inset 0 -3px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)"
                  : undefined,
              }}
            />
          );
        }),
      )}
    </div>
  );
}

function BogiePopup({ count, onClose }: { count: number; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          ✕
        </button>
        <div
          className="flex aspect-square items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #48caea 0%, #5aafff 100%)",
          }}
        >
          {imgFailed ? (
            <div className="px-6 text-center text-white">
              <div className="text-5xl">🐶</div>
              <div className="mt-2 text-sm opacity-80">
                Add{" "}
                <code className="rounded bg-white/20 px-1">
                  public/bogieman.png
                </code>{" "}
                to show your image here.
              </div>
            </div>
          ) : (
            <Image
              src="/bogieman.png"
              alt="Bogie"
              width={400}
              height={400}
              className="h-full w-full object-contain"
              onError={() => setImgFailed(true)}
              unoptimized
              priority
            />
          )}
        </div>
        <div className="p-4 text-center">
          <div className="text-lg font-black text-slate-800">
            Bogie Man
          </div>
          <div className="mt-1 text-xs text-slate-500">
            โดนไปดิ #{count} ครั้ง
          </div>
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background:
                "linear-gradient(135deg, #48caea 0%, #5aafff 100%)",
            }}
          >
            สู้ต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
