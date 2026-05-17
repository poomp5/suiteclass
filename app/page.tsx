"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BOARD_SIZE = 8;
const POPUP_INTERVAL_MS = 10_000;

type Cell = 0 | 1;
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

const SHAPE_TEMPLATES: Omit<Shape, "id" | "color">[] = [
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
    Array.from({ length: BOARD_SIZE }, () => 0 as Cell),
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
    if (board[r][c]) return false;
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

export default function Home() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [colorBoard, setColorBoard] = useState<(string | null)[][]>(() =>
    Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null as string | null),
    ),
  );
  const [tray, setTray] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupCount, setPopupCount] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  const selectedShape = useMemo(
    () => tray.find((s) => s.id === selectedId) ?? null,
    [tray, selectedId],
  );

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

  const place = useCallback(
    (shape: Shape, row: number, col: number) => {
      if (!canPlace(board, shape, row, col)) return;
      const nextBoard = board.map((r) => r.slice()) as Board;
      const nextColor = colorBoard.map((r) => r.slice());
      for (const [dr, dc] of shape.cells) {
        nextBoard[row + dr][col + dc] = 1;
        nextColor[row + dr][col + dc] = shape.color;
      }

      const fullRows: number[] = [];
      const fullCols: number[] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (nextBoard[r].every((v) => v === 1)) fullRows.push(r);
      }
      for (let c = 0; c < BOARD_SIZE; c++) {
        let full = true;
        for (let r = 0; r < BOARD_SIZE; r++) {
          if (nextBoard[r][c] === 0) {
            full = false;
            break;
          }
        }
        if (full) fullCols.push(c);
      }

      const cleared = fullRows.length + fullCols.length;
      if (cleared > 0) {
        for (const r of fullRows) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            nextBoard[r][c] = 0;
            nextColor[r][c] = null;
          }
        }
        for (const c of fullCols) {
          for (let r = 0; r < BOARD_SIZE; r++) {
            nextBoard[r][c] = 0;
            nextColor[r][c] = null;
          }
        }
      }

      const placedPoints = shape.cells.length;
      const clearPoints = cleared * BOARD_SIZE * 10;
      const comboBonus = cleared > 1 ? cleared * 20 : 0;
      setScore((s) => s + placedPoints + clearPoints + comboBonus);
      setCombo(cleared > 0 ? cleared : 0);

      setBoard(nextBoard);
      setColorBoard(nextColor);

      const nextTray = tray.filter((s) => s.id !== shape.id);
      setTray(nextTray.length === 0 ? newTray() : nextTray);
      setSelectedId(null);
      setHover(null);
    },
    [board, colorBoard, tray],
  );

  const reset = () => {
    setBoard(emptyBoard());
    setColorBoard(
      Array.from({ length: BOARD_SIZE }, () =>
        Array.from({ length: BOARD_SIZE }, () => null as string | null),
      ),
    );
    setTray(newTray());
    setSelectedId(null);
    setHover(null);
    setScore(0);
    setCombo(0);
    setGameOver(false);
    startedAtRef.current = Date.now();
  };

  const previewCells = useMemo(() => {
    if (!selectedShape || !hover) return new Set<string>();
    if (!canPlace(board, selectedShape, hover.row, hover.col))
      return new Set<string>();
    const s = new Set<string>();
    for (const [dr, dc] of selectedShape.cells) {
      s.add(`${hover.row + dr}-${hover.col + dc}`);
    }
    return s;
  }, [selectedShape, hover, board]);

  const previewValid =
    selectedShape && hover
      ? canPlace(board, selectedShape, hover.row, hover.col)
      : false;

  return (
    <div
      className="flex flex-1 flex-col items-center justify-start px-4 py-6 sm:py-10"
      style={{
        background:
          "linear-gradient(160deg, #48caea 0%, #5aafff 60%, #4a7bd6 100%)",
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
        <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Score
          </div>
          <div className="text-xl font-black tabular-nums">{score}</div>
        </div>
        <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Best
          </div>
          <div className="text-xl font-black tabular-nums">{best}</div>
        </div>
        <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Combo
          </div>
          <div className="text-xl font-black tabular-nums">×{combo}</div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-white/15 p-3 shadow-2xl backdrop-blur">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {board.map((row, r) =>
            row.map((_cell, c) => {
              const key = `${r}-${c}`;
              const filledColor = colorBoard[r][c];
              const isPreview = previewCells.has(key);
              const showColor = filledColor
                ? filledColor
                : isPreview
                ? previewValid
                  ? selectedShape!.color
                  : "#ef4444"
                : null;
              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={() =>
                    selectedShape && setHover({ row: r, col: c })
                  }
                  onMouseLeave={() =>
                    setHover((h) =>
                      h && h.row === r && h.col === c ? null : h,
                    )
                  }
                  onClick={() => {
                    if (selectedShape) place(selectedShape, r, c);
                  }}
                  className="aspect-square rounded-md transition-colors"
                  style={{
                    background: showColor ?? "rgba(255,255,255,0.18)",
                    boxShadow: showColor
                      ? "inset 0 -3px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.35)"
                      : "inset 0 1px 0 rgba(255,255,255,0.15)",
                    opacity: isPreview && !filledColor ? 0.75 : 1,
                  }}
                />
              );
            }),
          )}
        </div>
      </div>

      <div className="mt-5 flex w-full max-w-md items-end justify-around rounded-3xl bg-white/15 p-4 backdrop-blur">
        {tray.length === 0 ? (
          <div className="text-white/80">Loading next pieces…</div>
        ) : (
          tray.map((shape) => (
            <TrayPiece
              key={shape.id}
              shape={shape}
              selected={selectedId === shape.id}
              disabled={!hasAnyPlacement(board, shape)}
              onSelect={() =>
                setSelectedId((id) => (id === shape.id ? null : shape.id))
              }
            />
          ))
        )}
      </div>

      <p className="mt-3 text-center text-xs text-white/80">
        Tap a piece, then tap the board to drop it. Fill rows or columns to
        clear them.
      </p>

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

function TrayPiece({
  shape,
  selected,
  disabled,
  onSelect,
}: {
  shape: Shape;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { rows, cols } = shapeBounds(shape.cells);
  const filled = new Set(shape.cells.map(([r, c]) => `${r}-${c}`));
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      className={`rounded-2xl p-2 transition-transform ${
        selected ? "scale-110 bg-white/30" : "bg-white/0"
      } ${disabled ? "opacity-40" : "hover:scale-105"}`}
      disabled={disabled}
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, 18px)`,
          gridTemplateRows: `repeat(${rows}, 18px)`,
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const on = filled.has(`${r}-${c}`);
            return (
              <div
                key={`${r}-${c}`}
                className="rounded-sm"
                style={{
                  background: on ? shape.color : "transparent",
                  boxShadow: on
                    ? "inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)"
                    : undefined,
                }}
              />
            );
          }),
        )}
      </div>
    </button>
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
                Add <code className="rounded bg-white/20 px-1">public/bogie.png</code>{" "}
                to show your image here.
              </div>
            </div>
          ) : (
            <Image
              src="/bogie.png"
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
            Bogie says hi! 👋
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Popup #{count} · auto-shown every 10s
          </div>
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background:
                "linear-gradient(135deg, #48caea 0%, #5aafff 100%)",
            }}
          >
            Keep playing
          </button>
        </div>
      </div>
    </div>
  );
}
