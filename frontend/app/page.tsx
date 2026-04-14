"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import VideoUpload from "@/components/VideoUpload";
import VideoList from "@/components/VideoList";
import { getVideo, listVideos, Video } from "@/lib/api";

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      const data = await listVideos();
      setVideos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // extracting 상태 영상을 5초마다 폴링해서 상태 갱신
  useEffect(() => {
    const id = setInterval(async () => {
      const pending = videos.filter(
        (v) => v.status === "extracting" || v.status === "uploaded"
      );
      if (pending.length === 0) return;
      const updated = await Promise.all(pending.map((v) => getVideo(v.id).catch(() => v)));
      setVideos((prev) =>
        prev.map((v) => updated.find((u) => u.id === v.id) ?? v)
      );
    }, 5000);
    return () => clearInterval(id);
  }, [videos]);

  const handleUpload = (video: Video) => {
    setVideos((prev) => [video, ...prev]);
  };

  const handleDelete = (id: number) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const doneCount = videos.filter((v) => v.status === "done").length;
  const extractingCount = videos.filter((v) => v.status === "extracting").length;

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Vision AutoML Platform</h1>
            <p className="text-xs text-muted-foreground">YOLO 객체감지 모델 자동화</p>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <Link
              href="/models"
              className="px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors font-medium"
            >
              🤖 모델 & 추론
            </Link>
            <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">
              All Phases 완료 ✓
            </span>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "전체 영상", value: videos.length, emoji: "🎬" },
            { label: "추출 완료",  value: doneCount,      emoji: "✅" },
            { label: "처리 중",    value: extractingCount, emoji: "⏳" },
          ].map((stat) => (
            <div key={stat.label} className="border border-border rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">{stat.emoji}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* 업로드 */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            영상 업로드
          </h2>
          <div className="border border-border rounded-xl p-6">
            <VideoUpload onUpload={handleUpload} />
          </div>
        </section>

        {/* 영상 목록 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              영상 목록
            </h2>
            <button
              onClick={fetchVideos}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              새로고침
            </button>
          </div>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">로딩 중...</div>
          ) : (
            <VideoList videos={videos} onDelete={handleDelete} />
          )}
        </section>
      </main>
    </div>
  );
}
