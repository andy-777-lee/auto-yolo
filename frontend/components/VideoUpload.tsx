"use client";

import { useCallback, useState } from "react";
import { uploadVideo, Video } from "@/lib/api";

interface Props {
  onUpload: (video: Video) => void;
}

export default function VideoUpload({ onUpload }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [intervalSec, setIntervalSec] = useState(1.0);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setMessage("업로드 중...");
      try {
        const video = await uploadVideo(file, intervalSec);
        setMessage("업로드 완료! 프레임 추출 중...");
        onUpload(video);
        setTimeout(() => setMessage(""), 3000);
      } catch (e: unknown) {
        setMessage(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
      } finally {
        setIsUploading(false);
      }
    },
    [intervalSec, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">프레임 추출 간격</label>
        <select
          value={intervalSec}
          onChange={(e) => setIntervalSec(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
          disabled={isUploading}
        >
          <option value={0.5}>0.5초마다</option>
          <option value={1}>1초마다</option>
          <option value={2}>2초마다</option>
          <option value={5}>5초마다</option>
        </select>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex flex-col items-center justify-center gap-3 w-full h-44",
          "border-2 border-dashed rounded-xl cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30",
          isUploading ? "opacity-60 pointer-events-none" : "",
        ].join(" ")}
      >
        <input
          type="file"
          accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          disabled={isUploading}
        />
        <span className="text-4xl">{isUploading ? "⏳" : "🎬"}</span>
        <div className="text-center">
          <p className="text-sm font-medium">
            영상 파일을 드래그하거나 클릭해서 업로드
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4 · AVI · MOV · MKV · WebM 지원
          </p>
        </div>
        {message && (
          <p
            className={`text-sm font-medium ${
              message.startsWith("오류") ? "text-destructive" : "text-primary"
            }`}
          >
            {message}
          </p>
        )}
      </label>
    </div>
  );
}
