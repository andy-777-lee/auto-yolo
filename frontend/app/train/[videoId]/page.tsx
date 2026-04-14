"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

interface TrainingJob {
  id: number;
  video_id: number;
  name: string;
  model_name: string;
  epochs: number;
  batch_size: number;
  imgsz: number;
  val_split: number;
  status: string;
  current_epoch: number;
  total_epochs: number;
  metrics: Record<string, number> | null;
  output_dir: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "대기 중",    cls: "bg-gray-100 text-gray-600" },
  preparing: { label: "준비 중",    cls: "bg-blue-100 text-blue-700" },
  training:  { label: "학습 중...", cls: "bg-yellow-100 text-yellow-700" },
  done:      { label: "완료",       cls: "bg-green-100 text-green-700" },
  error:     { label: "오류",       cls: "bg-red-100 text-red-700" },
};

const MODELS = [
  { value: "yolov8n", label: "YOLOv8 Nano  (빠름, 낮은 정확도)" },
  { value: "yolov8s", label: "YOLOv8 Small" },
  { value: "yolov8m", label: "YOLOv8 Medium" },
  { value: "yolov8l", label: "YOLOv8 Large (느림, 높은 정확도)" },
  { value: "yolo11n", label: "YOLO11 Nano  (최신 경량)" },
  { value: "yolo11s", label: "YOLO11 Small (최신)" },
];

const METRIC_LABELS: Record<string, string> = {
  "metrics/mAP50(B)":    "mAP@50",
  "metrics/mAP50-95(B)": "mAP@50-95",
  "metrics/precision(B)":"Precision",
  "metrics/recall(B)":   "Recall",
  "train/box_loss":      "Box Loss",
  "train/cls_loss":      "Class Loss",
  "val/box_loss":        "Val Box Loss",
  "val/cls_loss":        "Val Class Loss",
};

export default function TrainPage() {
  const { videoId } = useParams<{ videoId: string }>();

  // 폼 상태
  const [modelName, setModelName] = useState("yolov8n");
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(16);
  const [imgsz, setImgsz] = useState(640);
  const [valSplit, setValSplit] = useState(0.2);
  const [jobName, setJobName] = useState("");

  // 학습 작업 목록
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [starting, setStarting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = async () => {
    const res = await fetch(`${API_URL}/api/v1/training?video_id=${videoId}`);
    if (res.ok) setJobs(await res.json());
  };

  useEffect(() => {
    fetchJobs();
  }, [videoId]);

  // 진행 중인 작업이 있으면 3초마다 폴링
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "training" || j.status === "preparing");
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs]);

  const startTraining = async () => {
    setErrMsg("");
    setStarting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: Number(videoId),
          name: jobName || undefined,
          model_name: modelName,
          epochs,
          batch_size: batchSize,
          imgsz,
          val_split: valSplit,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "학습 시작 실패");
      }
      const job: TrainingJob = await res.json();
      setJobs((prev) => [job, ...prev]);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setStarting(false);
    }
  };

  const deleteJob = async (jobId: number) => {
    if (!confirm("이 학습 작업을 삭제할까요?")) return;
    await fetch(`${API_URL}/api/v1/training/${jobId}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const downloadWeights = (jobId: number) => {
    window.location.href = `${API_URL}/api/v1/training/${jobId}/download`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← 목록
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href={`/label/${videoId}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              라벨링
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">YOLO 학습</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
            Phase 4 — 학습 파이프라인
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 학습 설정 폼 */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-5">
            학습 설정
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* 작업명 */}
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">작업 이름 (선택)</label>
              <input
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="ex) 사람_감지_v1"
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>

            {/* 모델 */}
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">모델</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Epochs */}
            <div>
              <label className="block text-xs font-medium mb-1">에포크 수</label>
              <input
                type="number" min={1} max={300}
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>

            {/* Batch */}
            <div>
              <label className="block text-xs font-medium mb-1">배치 크기</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background"
              >
                {[4, 8, 16, 32, 64].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* imgsz */}
            <div>
              <label className="block text-xs font-medium mb-1">이미지 크기</label>
              <select
                value={imgsz}
                onChange={(e) => setImgsz(Number(e.target.value))}
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background"
              >
                {[320, 416, 512, 640, 832, 1280].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Val split */}
            <div>
              <label className="block text-xs font-medium mb-1">
                검증 비율 ({Math.round(valSplit * 100)}%)
              </label>
              <input
                type="range" min={5} max={40} step={5}
                value={valSplit * 100}
                onChange={(e) => setValSplit(Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          </div>

          {errMsg && (
            <p className="mt-3 text-sm text-destructive">{errMsg}</p>
          )}

          <button
            onClick={startTraining}
            disabled={starting}
            className="mt-5 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {starting ? "시작 중..." : "🚀 학습 시작"}
          </button>
        </section>

        {/* 학습 목록 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              학습 기록
            </h2>
            <button
              onClick={fetchJobs}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              새로고침
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-sm">아직 학습 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const s = STATUS[job.status] ?? { label: job.status, cls: "bg-gray-100 text-gray-600" };
                const progress = job.total_epochs > 0
                  ? Math.round((job.current_epoch / job.total_epochs) * 100)
                  : 0;

                return (
                  <div key={job.id} className="border border-border rounded-xl p-5">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{job.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {job.model_name} · {job.epochs}epoch · batch{job.batch_size} · {job.imgsz}px
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {job.status === "done" && (
                          <button
                            onClick={() => downloadWeights(job.id)}
                            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90"
                          >
                            ⬇ 가중치 다운로드
                          </button>
                        )}
                        <button
                          onClick={() => deleteJob(job.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {/* 진행률 바 */}
                    {(job.status === "training" || job.status === "done") && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>에포크 {job.current_epoch} / {job.total_epochs}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 메트릭 */}
                    {job.metrics && Object.keys(job.metrics).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {Object.entries(METRIC_LABELS)
                          .filter(([k]) => job.metrics![k] !== undefined)
                          .map(([k, label]) => (
                            <div key={k} className="bg-muted rounded-lg px-3 py-2 text-center">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="text-sm font-semibold mt-0.5">
                                {(job.metrics![k] * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* 오류 메시지 */}
                    {job.status === "error" && job.error_message && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">
                          {job.error_message}
                        </p>
                      </div>
                    )}

                    {/* 시간 정보 */}
                    <p className="text-xs text-muted-foreground mt-3">
                      생성: {new Date(job.created_at).toLocaleString("ko-KR")}
                      {job.finished_at && (
                        <> · 완료: {new Date(job.finished_at).toLocaleString("ko-KR")}</>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
