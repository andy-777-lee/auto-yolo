"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

interface Model {
  id: number;
  name: string;
  model_name: string;
  video_id: number;
  epochs: number;
  imgsz: number;
  metrics: Record<string, number> | null;
  weights_available: boolean;
  created_at: string;
  finished_at: string | null;
}

interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface InferResult {
  result_filename: string;
  detections: Detection[];
  inference_time_ms: number;
  image_size: { width: number; height: number };
}

const METRIC_SHORT: Record<string, string> = {
  "metrics/mAP50(B)":    "mAP@50",
  "metrics/mAP50-95(B)": "mAP@50-95",
  "metrics/precision(B)":"Precision",
  "metrics/recall(B)":   "Recall",
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  // 추론 상태
  const [isDragging, setIsDragging] = useState(false);
  const [conf, setConf] = useState(0.25);
  const [iou, setIou] = useState(0.45);
  const [inferring, setInferring] = useState(false);
  const [inferResult, setInferResult] = useState<InferResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const fetchModels = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/models`);
    if (res.ok) setModels(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const runInference = useCallback(async (file: File) => {
    if (!selectedModel) return;
    setInferring(true);
    setInferResult(null);
    setResultUrl(null);
    setErrMsg("");

    // 미리보기
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conf", String(conf));
      form.append("iou", String(iou));

      const res = await fetch(`${API_URL}/api/v1/models/${selectedModel.id}/infer`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "추론 실패");
      }
      const data: InferResult = await res.json();
      setInferResult(data);
      setResultUrl(`${API_URL}/api/v1/models/${selectedModel.id}/infer/result/${data.result_filename}`);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setInferring(false);
    }
  }, [selectedModel, conf, iou]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) runInference(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runInference(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← 홈
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">모델 관리 & 추론</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">
            Phase 5 — 모델 관리 & 추론
          </span>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
        {/* 왼쪽: 모델 목록 */}
        <aside className="w-80 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              학습된 모델
            </h2>
            <button onClick={fetchModels} className="text-xs text-muted-foreground hover:text-foreground">
              새로고침
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-center text-muted-foreground py-8">로딩 중...</p>
          ) : models.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-3xl mb-2">🤖</p>
              <p className="text-sm">학습된 모델이 없습니다</p>
              <Link href="/" className="text-xs text-primary underline mt-2 block">
                학습 시작하기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((m) => {
                const mAP = m.metrics?.["metrics/mAP50(B)"];
                const isSelected = selectedModel?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(isSelected ? null : m);
                      setInferResult(null);
                      setResultUrl(null);
                      setPreviewUrl(null);
                      setErrMsg("");
                    }}
                    className={[
                      "p-4 rounded-xl border cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent/30",
                      !m.weights_available ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.model_name} · {m.epochs}epoch · {m.imgsz}px
                        </p>
                      </div>
                      {!m.weights_available && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded shrink-0 ml-2">
                          가중치 없음
                        </span>
                      )}
                    </div>

                    {/* 핵심 메트릭 */}
                    {m.metrics && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {Object.entries(METRIC_SHORT)
                          .filter(([k]) => m.metrics![k] !== undefined)
                          .slice(0, 4)
                          .map(([k, label]) => (
                            <div key={k} className="bg-muted rounded px-2 py-1">
                              <p className="text-[10px] text-muted-foreground">{label}</p>
                              <p className="text-xs font-semibold">
                                {(m.metrics![k] * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground mt-2">
                      {m.finished_at ? new Date(m.finished_at).toLocaleDateString("ko-KR") : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* 오른쪽: 추론 패널 */}
        <main className="flex-1 min-w-0">
          {!selectedModel ? (
            <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-border rounded-xl text-muted-foreground">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-sm">왼쪽에서 모델을 선택하세요</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 선택된 모델 정보 */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selectedModel.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedModel.model_name} · {selectedModel.epochs}epoch · {selectedModel.imgsz}px
                  </p>
                </div>
                <a
                  href={`${API_URL}/api/v1/training/${selectedModel.id}/download`}
                  className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
                >
                  ⬇ best.pt
                </a>
              </div>

              {/* 추론 설정 */}
              <div className="flex items-center gap-6 p-4 border border-border rounded-xl bg-accent/10">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium whitespace-nowrap">
                    Confidence {Math.round(conf * 100)}%
                  </label>
                  <input
                    type="range" min={5} max={95} step={5}
                    value={conf * 100}
                    onChange={(e) => setConf(Number(e.target.value) / 100)}
                    className="w-28"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium whitespace-nowrap">
                    IoU {Math.round(iou * 100)}%
                  </label>
                  <input
                    type="range" min={10} max={90} step={5}
                    value={iou * 100}
                    onChange={(e) => setIou(Number(e.target.value) / 100)}
                    className="w-28"
                  />
                </div>
              </div>

              {/* 이미지 업로드 & 결과 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 업로드 영역 */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">입력 이미지</p>
                  <label
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={[
                      "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden",
                      "aspect-video",
                      isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/20",
                      inferring ? "opacity-60 pointer-events-none" : "",
                    ].join(" ")}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/bmp,image/webp"
                      className="hidden"
                      onChange={handleFile}
                      disabled={inferring}
                    />
                    {previewUrl ? (
                      <img src={previewUrl} alt="input" className="absolute inset-0 w-full h-full object-contain" />
                    ) : (
                      <div className="text-center text-muted-foreground p-4">
                        <p className="text-3xl mb-2">{inferring ? "⏳" : "🖼️"}</p>
                        <p className="text-xs">
                          {inferring ? "추론 중..." : "이미지를 드래그하거나 클릭"}
                        </p>
                        <p className="text-[10px] mt-1">JPG · PNG · BMP · WebP</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* 결과 이미지 */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    추론 결과
                    {inferResult && (
                      <span className="ml-2 text-green-600">
                        {inferResult.inference_time_ms}ms · {inferResult.detections.length}개 탐지
                      </span>
                    )}
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden aspect-video flex items-center justify-center bg-muted">
                    {inferring && (
                      <p className="text-sm text-muted-foreground">추론 중...</p>
                    )}
                    {!inferring && resultUrl && (
                      <img src={resultUrl} alt="result" className="w-full h-full object-contain" />
                    )}
                    {!inferring && !resultUrl && !errMsg && (
                      <p className="text-xs text-muted-foreground">결과가 여기에 표시됩니다</p>
                    )}
                    {errMsg && (
                      <p className="text-xs text-destructive p-4 text-center">{errMsg}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 탐지 결과 테이블 */}
              {inferResult && inferResult.detections.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-accent/10 flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      탐지 결과 ({inferResult.detections.length}개)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      이미지 {inferResult.image_size.width}×{inferResult.image_size.height}px
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">클래스</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">신뢰도</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">위치 (x1, y1, x2, y2)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inferResult.detections.map((det, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/20">
                            <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium">{det.class_name}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${det.confidence * 100}%` }}
                                  />
                                </div>
                                <span>{(det.confidence * 100).toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-muted-foreground">
                              {det.bbox.x1}, {det.bbox.y1}, {det.bbox.x2}, {det.bbox.y2}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inferResult && inferResult.detections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-sm">탐지된 객체가 없습니다</p>
                  <p className="text-xs mt-1">Confidence 임계값을 낮춰보세요</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
