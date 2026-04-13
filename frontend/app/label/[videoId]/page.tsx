"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LabelCanvas, { BBox, LabelClass } from "@/components/LabelCanvas";
import { API_URL } from "@/lib/api";

// ── API helpers ───────────────────────────────────────────────

async function fetchClasses(videoId: string): Promise<LabelClass[]> {
  const res = await fetch(`${API_URL}/api/v1/labels/${videoId}/classes`);
  return res.ok ? res.json() : [];
}
async function createClass(videoId: string, name: string): Promise<LabelClass> {
  const res = await fetch(`${API_URL}/api/v1/labels/${videoId}/classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}
async function deleteClass(videoId: string, classId: number): Promise<void> {
  await fetch(`${API_URL}/api/v1/labels/${videoId}/classes/${classId}`, { method: "DELETE" });
}
async function fetchFrameLabels(videoId: string, frame: string): Promise<BBox[]> {
  const res = await fetch(`${API_URL}/api/v1/labels/${videoId}/frames/${frame}`);
  return res.ok ? res.json() : [];
}
async function saveFrameLabels(videoId: string, frame: string, labels: BBox[]): Promise<void> {
  await fetch(`${API_URL}/api/v1/labels/${videoId}/frames/${frame}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels }),
  });
}
async function fetchStats(videoId: string) {
  const res = await fetch(`${API_URL}/api/v1/labels/${videoId}/stats`);
  return res.ok ? res.json() : null;
}

// ── Component ────────────────────────────────────────────────

export default function LabelPage() {
  const { videoId } = useParams<{ videoId: string }>();

  const [frames, setFrames] = useState<string[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [labels, setLabels] = useState<BBox[]>([]);
  const [savedFrames, setSavedFrames] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ total_frames: number; labeled_frames: number; total_boxes: number } | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // 프레임 목록 로드
  useEffect(() => {
    fetch(`${API_URL}/api/v1/videos/${videoId}/frames`)
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = (data.frames ?? []).map((p: string) =>
          p.split("/").pop()!
        );
        setFrames(list);
      });
    fetchClasses(videoId).then(setClasses);
    fetchStats(videoId).then(setStats);
  }, [videoId]);

  // 프레임 변경 시 라벨 로드
  const currentFrame = frames[frameIdx];
  useEffect(() => {
    if (!currentFrame) return;
    fetchFrameLabels(videoId, currentFrame).then(setLabels);
  }, [videoId, currentFrame]);

  // 저장
  const save = useCallback(async () => {
    if (!currentFrame) return;
    setSaving(true);
    await saveFrameLabels(videoId, currentFrame, labels);
    setSavedFrames((prev) => new Set(prev).add(currentFrame));
    fetchStats(videoId).then(setStats);
    setSaveMsg("저장됨 ✓");
    setTimeout(() => setSaveMsg(""), 2000);
    setSaving(false);
  }, [videoId, currentFrame, labels]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
      if (e.key === "ArrowRight") setFrameIdx((i) => Math.min(i + 1, frames.length - 1));
      if (e.key === "ArrowLeft")  setFrameIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, frames.length]);

  const addClass = async () => {
    const name = newClassName.trim();
    if (!name) return;
    try {
      const cls = await createClass(videoId, name);
      setClasses((prev) => [...prev, cls]);
      setSelectedClassId(cls.id);
      setNewClassName("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "오류 발생");
    }
  };

  const removeClass = async (id: number) => {
    if (!confirm("이 클래스와 관련 라벨을 모두 삭제할까요?")) return;
    await deleteClass(videoId, id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (selectedClassId === id) setSelectedClassId(null);
    setLabels((prev) => prev.filter((l) => l.class_id !== id));
  };

  const exportZip = () => {
    window.location.href = `${API_URL}/api/v1/labels/${videoId}/export`;
  };

  const frameUrl = currentFrame
    ? `${API_URL}/api/v1/videos/${videoId}/frames/${currentFrame}`
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-border bg-background sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← 목록
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">라벨링</span>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>프레임 {stats.labeled_frames}/{stats.total_frames}</span>
              <span>박스 {stats.total_boxes}개</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-xs text-green-600 font-medium">{saveMsg}</span>}
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장 (Ctrl+S)"}
            </button>
            <button
              onClick={exportZip}
              className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
            >
              YOLO 내보내기
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-xl mx-auto w-full gap-0">
        {/* 왼쪽: 프레임 목록 */}
        <aside className="w-36 shrink-0 border-r border-border overflow-y-auto" style={{ maxHeight: "calc(100vh - 56px)" }}>
          <div className="p-2 text-xs text-muted-foreground font-medium">
            프레임 {frames.length}개
          </div>
          <div className="flex flex-col gap-1 p-1">
            {frames.map((f, i) => (
              <button
                key={f}
                onClick={() => setFrameIdx(i)}
                className={[
                  "relative rounded-md overflow-hidden border-2 transition-colors",
                  i === frameIdx ? "border-primary" : "border-transparent hover:border-border",
                ].join(" ")}
              >
                <img
                  src={`${API_URL}/api/v1/videos/${videoId}/frames/${f}`}
                  alt={f}
                  className="w-full aspect-video object-cover"
                />
                {savedFrames.has(f) && (
                  <span className="absolute top-0.5 right-0.5 text-[10px] bg-green-500 text-white rounded px-1">
                    ✓
                  </span>
                )}
                <span className="block text-[10px] text-center text-muted-foreground py-0.5">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* 중앙: 캔버스 */}
        <main className="flex-1 flex flex-col p-4 gap-3 min-w-0">
          {/* 프레임 네비게이션 */}
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setFrameIdx((i) => Math.max(i - 1, 0))}
              disabled={frameIdx === 0}
              className="px-3 py-1 border border-border rounded-md disabled:opacity-40 hover:bg-accent transition-colors text-xs"
            >
              ◀ 이전
            </button>
            <span className="text-muted-foreground text-xs">
              {frameIdx + 1} / {frames.length}
              {currentFrame && <span className="ml-2 font-mono">{currentFrame}</span>}
            </span>
            <button
              onClick={() => setFrameIdx((i) => Math.min(i + 1, frames.length - 1))}
              disabled={frameIdx === frames.length - 1}
              className="px-3 py-1 border border-border rounded-md disabled:opacity-40 hover:bg-accent transition-colors text-xs"
            >
              다음 ▶
            </button>
          </div>

          {/* 캔버스 */}
          {frameUrl ? (
            <LabelCanvas
              imageUrl={frameUrl}
              labels={labels}
              classes={classes}
              selectedClassId={selectedClassId}
              onChange={setLabels}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm border border-border rounded-xl">
              프레임이 없습니다. 먼저 영상을 업로드하고 프레임을 추출해주세요.
            </div>
          )}

          {/* 현재 프레임 라벨 목록 */}
          {labels.length > 0 && (
            <div className="border border-border rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                현재 프레임 라벨 ({labels.length}개)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((lbl, i) => {
                  const cls = classes.find((c) => c.id === lbl.class_id);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: cls?.color ?? "#888" }}
                    >
                      <span>{cls?.name ?? `id_${lbl.class_id}`}</span>
                      <button
                        onClick={() => setLabels((prev) => prev.filter((_, idx) => idx !== i))}
                        className="opacity-70 hover:opacity-100 ml-0.5"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* 오른쪽: 클래스 패널 */}
        <aside className="w-52 shrink-0 border-l border-border p-4 flex flex-col gap-4" style={{ maxHeight: "calc(100vh - 56px)", overflowY: "auto" }}>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              클래스
            </p>
            {/* 클래스 추가 */}
            <div className="flex gap-1 mb-3">
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addClass()}
                placeholder="클래스명 입력"
                className="flex-1 text-xs px-2 py-1.5 border border-border rounded-md bg-background min-w-0"
              />
              <button
                onClick={addClass}
                className="text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded-md shrink-0"
              >
                +
              </button>
            </div>

            {/* 클래스 목록 */}
            <div className="flex flex-col gap-1">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id === selectedClassId ? null : cls.id)}
                  className={[
                    "flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                    selectedClassId === cls.id
                      ? "ring-2 ring-offset-1"
                      : "hover:bg-accent",
                  ].join(" ")}
                  style={selectedClassId === cls.id ? { ringColor: cls.color } : {}}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="text-xs truncate">{cls.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeClass(cls.id); }}
                    className="text-muted-foreground hover:text-destructive text-xs ml-1 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  클래스를 추가하세요
                </p>
              )}
            </div>
          </div>

          {/* 단축키 안내 */}
          <div className="mt-auto border border-border rounded-xl p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">단축키</p>
            <dl className="text-xs space-y-1 text-muted-foreground">
              {[
                ["드래그", "박스 그리기"],
                ["클릭", "박스 선택"],
                ["Delete", "선택 삭제"],
                ["←/→", "프레임 이동"],
                ["Ctrl+S", "저장"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <kbd className="bg-muted px-1 rounded">{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
