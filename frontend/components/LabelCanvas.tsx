"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface BBox {
  id?: number;
  class_id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface LabelClass {
  id: number;
  name: string;
  color: string;
}

interface Props {
  imageUrl: string;
  labels: BBox[];
  classes: LabelClass[];
  selectedClassId: number | null;
  onChange: (labels: BBox[]) => void;
}

export default function LabelCanvas({
  imageUrl,
  labels,
  classes,
  selectedClassId,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // 드래그 상태 (ref로 관리 — 리렌더 불필요)
  const drag = useRef<{
    active: boolean;
    sx: number; sy: number;
    ex: number; ey: number;
  }>({ active: false, sx: 0, sy: 0, ex: 0, ey: 0 });

  // ── 이미지 로드 ──────────────────────────────────────────
  useEffect(() => {
    setImgLoaded(false);
    setSelectedIdx(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── 렌더링 ────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    // canvas 내부 해상도 = 이미지 자연 크기
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const W = img.naturalWidth;
    const H = img.naturalHeight;

    // 기존 박스
    labels.forEach((lbl, idx) => {
      const cls = classes.find((c) => c.id === lbl.class_id);
      const color = cls?.color ?? "#ef4444";
      const name = cls?.name ?? `id_${lbl.class_id}`;

      const x = (lbl.cx - lbl.w / 2) * W;
      const y = (lbl.cy - lbl.h / 2) * H;
      const w = lbl.w * W;
      const h = lbl.h * H;

      ctx.strokeStyle = selectedIdx === idx ? "#fff" : color;
      ctx.lineWidth = selectedIdx === idx ? 3 : 2;
      ctx.strokeRect(x, y, w, h);

      // 라벨 배경
      ctx.font = `${Math.max(14, W * 0.015)}px sans-serif`;
      const tw = ctx.measureText(name).width + 6;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - Math.max(18, W * 0.02), tw, Math.max(18, W * 0.02));
      ctx.fillStyle = "#fff";
      ctx.fillText(name, x + 3, y - 4);
    });

    // 드래그 중 박스
    const d = drag.current;
    if (d.active) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        Math.min(d.sx, d.ex),
        Math.min(d.sy, d.ey),
        Math.abs(d.ex - d.sx),
        Math.abs(d.ey - d.sy),
      );
      ctx.setLineDash([]);
    }
  }, [imgLoaded, labels, classes, selectedIdx]);

  useEffect(() => { render(); }, [render]);

  // ── 마우스 좌표 → 이미지 좌표 변환 ──────────────────────
  const toImgCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const img = imgRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * img.naturalWidth,
      y: ((e.clientY - rect.top) / rect.height) * img.naturalHeight,
    };
  };

  // ── 이벤트 핸들러 ────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || selectedClassId === null) return;
    const { x, y } = toImgCoords(e);
    drag.current = { active: true, sx: x, sy: y, ex: x, ey: y };
    setSelectedIdx(null);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag.current.active) return;
    const { x, y } = toImgCoords(e);
    drag.current.ex = x;
    drag.current.ey = y;
    render();
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;

    const img = imgRef.current!;
    const W = img.naturalWidth;
    const H = img.naturalHeight;

    const px = Math.abs(d.ex - d.sx);
    const py = Math.abs(d.ey - d.sy);
    if (px < 5 || py < 5) { render(); return; }

    const cx = (Math.min(d.sx, d.ex) + px / 2) / W;
    const cy = (Math.min(d.sy, d.ey) + py / 2) / H;
    const w = px / W;
    const h = py / H;

    onChange([
      ...labels,
      {
        class_id: selectedClassId!,
        cx: Math.max(0, Math.min(1, cx)),
        cy: Math.max(0, Math.min(1, cy)),
        w: Math.max(0.001, Math.min(1, w)),
        h: Math.max(0.001, Math.min(1, h)),
      },
    ]);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drag.current.active) return;
    const { x, y } = toImgCoords(e);
    const img = imgRef.current!;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const nx = x / W;
    const ny = y / H;

    const idx = labels.findLastIndex((lbl) => {
      const x1 = lbl.cx - lbl.w / 2;
      const y1 = lbl.cy - lbl.h / 2;
      return nx >= x1 && nx <= x1 + lbl.w && ny >= y1 && ny <= y1 + lbl.h;
    });
    setSelectedIdx(idx >= 0 ? idx : null);
  };

  // ── Delete 키로 선택 박스 삭제 ────────────────────────────
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdx !== null) {
        onChange(labels.filter((_, i) => i !== selectedIdx));
        setSelectedIdx(null);
      }
    },
    [selectedIdx, labels, onChange],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <div className="relative w-full select-none">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-border"
        style={{ cursor: selectedClassId !== null ? "crosshair" : "default" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={onClick}
      />
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">로딩 중...</span>
        </div>
      )}
      {selectedIdx !== null && (
        <div className="absolute top-2 right-2 text-xs bg-black/70 text-white px-2 py-1 rounded pointer-events-none">
          Delete 키로 삭제
        </div>
      )}
      {selectedClassId === null && (
        <div className="absolute top-2 left-2 text-xs bg-yellow-500/90 text-white px-2 py-1 rounded pointer-events-none">
          클래스를 먼저 선택하세요
        </div>
      )}
    </div>
  );
}
