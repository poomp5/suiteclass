"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const POPUP_INTERVAL_MS = 10_000;
const TICK_MS_START = 700;
const TICK_MS_MIN = 120;

type Cell = string | null;
type Board = Cell[][];
type Piece = {
  shape: number[][];
  color: string;
  row: number;
  col: number;
};

const PIECES: { shape: number[][]; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: "#22d3ee" },
  { shape: [[1, 1], [1, 1]], color: "#facc15" },
  { shape: [[0, 1, 0], [1, 1, 1]], color: "#a78bfa" },
  { shape: [[0, 1, 1], [1, 1, 0]], color: "#06d6a0" },
  { shape: [[1, 1, 0], [0, 1, 1]], color: "#ef476f" },
  { shape: [[1, 0, 0], [1, 1, 1]], color: "#5aafff" },
  { shape: [[0, 0, 1], [1, 1, 1]], color: "#fb923c" },
];

const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null as Cell),
  );

const randomPiece = (): Piece => {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: p.shape.map((r) => r.slice()),
    color: p.color,
    row: 0,
    col: Math.floor((COLS - p.shape[0].length) / 2),
  };
};

const rotate = (shape: number[][]): number[][] => {
  const h = shape.length;
  const w = shape[0].length;
  const out: number[][] = Array.from({ length: w }, () =>
    Array.from({ length: h }, () => 0),
  );
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      out[c][h - 1 - r] = shape[r][c];
    }
  }
  return out;
};

const collides = (
  board: Board,
  shape: number[][],
  row: number,
  col: number,
): boolean => {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) {
      if (!shape[r][c]) continue;
      const br = row + r;
      const bc = col + c;
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return true;
      if (board[br][bc] !== null) return true;
    }
  }
  return false;
};

const merge = (board: Board, piece: Piece): Board => {
  const next = board.map((r) => r.slice()) as Board;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[0].length; c++) {
      if (piece.shape[r][c]) {
        next[piece.row + r][piece.col + c] = piece.color;
      }
    }
  }
  return next;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const keep = board.filter((row) => row.some((v) => v === null));
  const cleared = ROWS - keep.length;
  const filler: Board = Array.from({ length: cleared }, () =>
    Array.from({ length: COLS }, () => null as Cell),
  );
  return { board: [...filler, ...keep], cleared };
};

export default function Home() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupCount, setPopupCount] = useState(0);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const gameOverRef = useRef(gameOver);
  const pausedRef = useRef(paused);
  boardRef.current = board;
  pieceRef.current = piece;
  gameOverRef.current = gameOver;
  pausedRef.current = paused;

  useEffect(() => {
    const stored = window.localStorage.getItem("tetris-best");
    if (stored) setBest(Number(stored) || 0);
    setPiece(randomPiece());
  }, []);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      window.localStorage.setItem("tetris-best", String(score));
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
    setLevel(Math.floor(lines / 10) + 1);
  }, [lines]);

  const lockAndNext = useCallback(
    (p: Piece) => {
      const merged = merge(boardRef.current, p);
      const { board: cleared, cleared: clearedCount } = clearLines(merged);
      setBoard(cleared);
      if (clearedCount > 0) {
        setLines((n) => n + clearedCount);
        setScore((s) => s + [0, 100, 300, 500, 800][clearedCount] * level);
      } else {
        setScore((s) => s + 10);
      }
      const next = randomPiece();
      if (collides(cleared, next.shape, next.row, next.col)) {
        setGameOver(true);
        setPiece(null);
        return;
      }
      setPiece(next);
    },
    [level],
  );

  const step = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, p.shape, p.row + 1, p.col)) {
      setPiece({ ...p, row: p.row + 1 });
    } else {
      lockAndNext(p);
    }
  }, [lockAndNext]);

  useEffect(() => {
    const tickMs = Math.max(TICK_MS_MIN, TICK_MS_START - (level - 1) * 60);
    const id = window.setInterval(step, tickMs);
    return () => window.clearInterval(id);
  }, [step, level]);

  const move = useCallback((dx: number) => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, p.shape, p.row, p.col + dx)) {
      setPiece({ ...p, col: p.col + dx });
    }
  }, []);

  const softDrop = useCallback(() => {
    step();
  }, [step]);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current || pausedRef.current) return;
    let r = p.row;
    while (!collides(boardRef.current, p.shape, r + 1, p.col)) r++;
    lockAndNext({ ...p, row: r });
  }, [lockAndNext]);

  const rotatePiece = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current || pausedRef.current) return;
    const rotated = rotate(p.shape);
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rotated, p.row, p.col + dx)) {
        setPiece({ ...p, shape: rotated, col: p.col + dx });
        return;
      }
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          move(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          move(1);
          break;
        case "ArrowDown":
          e.preventDefault();
          softDrop();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          e.preventDefault();
          rotatePiece();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
        case "p":
        case "P":
          setPaused((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, softDrop, rotatePiece, hardDrop, gameOver]);

  const reset = () => {
    setBoard(emptyBoard());
    setPiece(randomPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  const displayBoard = piece ? merge(board, piece) : board;

  return (
    <div
      className="flex flex-1 flex-col items-center justify-start px-4 py-4 sm:py-8"
      style={{
        background:
          "linear-gradient(160deg, #48caea 0%, #5aafff 60%, #4a7bd6 100%)",
        minHeight: "100vh",
        touchAction: "none",
      }}
    >
      <header className="flex w-full max-w-md items-center justify-between text-white">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight drop-shadow-sm">
            Bogie
          </span>
          <span className="text-2xl font-black tracking-tight text-yellow-200 drop-shadow-sm">
            Drop
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused((v) => !v)}
            className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-white/30"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={reset}
            className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-white/30"
          >
            New
          </button>
        </div>
      </header>

      <div className="mt-3 grid w-full max-w-md grid-cols-4 gap-2 text-center text-white">
        <Stat label="Score" value={score} />
        <Stat label="Best" value={best} />
        <Stat label="Lines" value={lines} />
        <Stat label="Level" value={level} />
      </div>

      <div className="mt-4 rounded-2xl bg-white/15 p-2 shadow-2xl backdrop-blur">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            width: "min(92vw, 360px)",
          }}
        >
          {displayBoard.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="aspect-square rounded-[3px]"
                style={{
                  background: cell ?? "rgba(255,255,255,0.12)",
                  boxShadow: cell
                    ? "inset 0 -2px 0 rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35)"
                    : "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              />
            )),
          )}
        </div>
      </div>

      <div className="mt-4 grid w-full max-w-md grid-cols-5 gap-2">
        <ControlButton onPress={() => move(-1)} label="◀" />
        <ControlButton onPress={rotatePiece} label="⟳" />
        <ControlButton onPress={softDrop} label="▼" />
        <ControlButton onPress={() => move(1)} label="▶" />
        <ControlButton onPress={hardDrop} label="⤓" accent />
      </div>

      <p className="mt-3 text-center text-xs text-white/80">
        Arrows to move · Up/X to rotate · Space to drop · P to pause
      </p>

      {(gameOver || paused) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-6">
          <div
            className="w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
            style={{ background: "#0a0a0a", border: "1px solid #1f1f1f" }}
          >
            <div className="text-3xl font-black text-white">
              {gameOver ? "คุณแพ้แล้ว" : "หยุดชั่วคราว"}
            </div>
            {gameOver && (
              <div className="mt-3 text-base text-white/80">
                &ldquo;โดนโบกี้แมนยึดโทรศัพท์&rdquo;
                <div className="mt-2 text-sm text-white/50">
                  คะแนนของคุณ:{" "}
                  <span className="font-bold text-white">{score}</span>
                </div>
              </div>
            )}
            <button
              onClick={gameOver ? reset : () => setPaused(false)}
              className="mt-5 w-full rounded-full px-5 py-3 text-base font-bold text-white"
              style={{
                background: "#1f1f1f",
                border: "1px solid #2f2f2f",
              }}
            >
              {gameOver ? "เล่นใหม่" : "เล่นต่อ"}
            </button>
          </div>
        </div>
      )}

      {popupOpen && (
        <BogiePopup count={popupCount} onClose={() => setPopupOpen(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </div>
      <div className="text-lg font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function ControlButton({
  onPress,
  label,
  accent,
}: {
  onPress: () => void;
  label: string;
  accent?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="select-none rounded-2xl py-4 text-2xl font-black text-white shadow-lg active:scale-95"
      style={{
        background: accent
          ? "linear-gradient(135deg, #ffd166 0%, #fb923c 100%)"
          : "rgba(255,255,255,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      {label}
    </button>
  );
}

const CLOSE_CLICKS_REQUIRED = 5;

function BogiePopup({
  count,
  onClose,
}: {
  count: number;
  onClose: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [closeClicks, setCloseClicks] = useState(0);
  const [jitter, setJitter] = useState({ dx: 0, dy: 0 });

  const handleClose = () => {
    const next = closeClicks + 1;
    if (next >= CLOSE_CLICKS_REQUIRED) {
      onClose();
      return;
    }
    setCloseClicks(next);
    setJitter({
      dx: Math.round((Math.random() - 0.5) * 30),
      dy: Math.round((Math.random() - 0.5) * 20),
    });
  };

  const closeSize = Math.max(10, 36 - closeClicks * 6);
  const fontSize = Math.max(8, closeSize * 0.55);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
        style={{ background: "#0a0a0a", border: "1px solid #1f1f1f" }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute z-10 grid place-items-center rounded-full bg-white/10 text-white/70 transition-all duration-150 hover:bg-white/20"
          style={{
            top: 12 + jitter.dy,
            right: 12 + jitter.dx,
            width: closeSize,
            height: closeSize,
            fontSize,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
        <div
          className="flex aspect-square items-center justify-center"
          style={{ background: "#0a0a0a" }}
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
              alt="โบกี้แมน"
              width={400}
              height={400}
              className="h-full w-full object-contain"
              onError={() => setImgFailed(true)}
              unoptimized
              priority
            />
          )}
        </div>
        <div className="p-5 text-center">
          <div className="text-2xl font-black text-white drop-shadow">
            โบกี้แมนมาแล้ว!!
          </div>
          <div className="mt-1 text-xs text-white/50">
            Popup #{count} · ทุก 10 วิ
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background: "#1f1f1f",
              border: "1px solid #2f2f2f",
            }}
          >
            เล่นต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
