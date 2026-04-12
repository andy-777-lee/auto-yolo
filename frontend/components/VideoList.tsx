"use client";

import { useState } from "react";
import {
  Video,
  FrameList,
  deleteVideo,
  listFrames,
  formatFileSize,
  formatDuration,
  API_URL,
} from "@/lib/api";

const STATUS: Record<string, { label: string; cls: string }> = {
  uploaded:   { label: "업로드됨",    cls: "bg-blue-100 text-blue-700" },
  extracting: { label: "추출 중...",  cls: "bg-yellow-100 text-yellow-700" },
  done:       { label: "완료",        cls: "bg-green-100 text-green-700" },
  error:      { label: "오류",        cls: "bg-red-100 text-red-700" },
};

interface Props {
  videos: Video[];
  onDelete: (id: number) => void;
}

export default function VideoList({ videos, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [frames, setFrames] = useState<Record<number, FrameList>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const toggle = async (video: Video) => {
    if (expandedId === video.id) { setExpandedId(null); return; }
    setExpandedId(video.id);
    if (!frames[video.id] && video.status === "done") {
      setLoadingId(video.id);
      try {
        const data = await listFrames(video.id);
        setFrames((prev) => ({ ...prev, [video.id]: data }));
      } finally {
        setLoadingId(null);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("이 영상과 추출된 프레임을 모두 삭제할까요?")) return;
    await deleteVideo(id);
    onDelete(id);
    if (expandedId === id) setExpandedId(null);
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-4xl mb-3">📂</p>
        <p className="text-sm">업로드된 영상이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => {
        const s = STATUS[video.status] ?? { label: video.status, cls: "bg-gray-100 text-gray-700" };
        const isOpen = expandedId === video.id;

        return (
          <div key={video.id} className="border border-border rounded-xl overflow-hidden">
            {/* 헤더 행 */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => toggle(video)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">🎥</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{video.original_filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(video.file_size)}
                    {video.duration != null && ` · ${formatDuration(video.duration)}`}
                    {video.width && video.height && ` · ${video.width}×${video.height}`}
                    {video.fps != null && ` · ${video.fps.toFixed(1)} fps`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
                  {s.label}
                  {video.status === "done" && ` (${video.extracted_frames}프레임)`}
                </span>
                <button
                  onClick={(e) => handleDelete(e, video.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded"
                >
                  삭제
                </button>
                <span className="text-xs text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* 프레임 패널 */}
            {isOpen && (
              <div className="border-t border-border bg-accent/10 p-4">
                {video.status === "extracting" && (
                  <p className="text-sm text-center text-muted-foreground py-6">
                    ⏳ 프레임 추출 중입니다...
                  </p>
                )}
                {video.status === "uploaded" && (
                  <p className="text-sm text-center text-muted-foreground py-6">
                    대기 중...
                  </p>
                )}
                {video.status === "error" && (
                  <p className="text-sm text-center text-destructive py-6">
                    오류: {video.error_message}
                  </p>
                )}
                {video.status === "done" && loadingId === video.id && (
                  <p className="text-sm text-center text-muted-foreground py-6">로딩 중...</p>
                )}
                {video.status === "done" && frames[video.id] && (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      총 {frames[video.id].total}개 프레임
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                      {frames[video.id].frames.slice(0, 32).map((path, i) => (
                        <img
                          key={i}
                          src={`${API_URL}${path}`}
                          alt={`frame-${i}`}
                          className="w-full aspect-video object-cover rounded-md border border-border"
                        />
                      ))}
                      {frames[video.id].total > 32 && (
                        <div className="flex items-center justify-center aspect-video rounded-md border border-border bg-muted text-xs text-muted-foreground">
                          +{frames[video.id].total - 32}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
