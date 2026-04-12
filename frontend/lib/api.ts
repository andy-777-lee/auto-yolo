const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Video {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  total_frames: number | null;
  status: "uploaded" | "extracting" | "done" | "error";
  extracted_frames: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrameList {
  video_id: number;
  total: number;
  frames: string[];
}

export async function uploadVideo(file: File, intervalSec = 1.0): Promise<Video> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/v1/videos/upload?interval_sec=${intervalSec}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "업로드 실패");
  }
  return res.json();
}

export async function listVideos(): Promise<Video[]> {
  const res = await fetch(`${API_URL}/api/v1/videos`);
  if (!res.ok) throw new Error("영상 목록 조회 실패");
  return res.json();
}

export async function getVideo(id: number): Promise<Video> {
  const res = await fetch(`${API_URL}/api/v1/videos/${id}`);
  if (!res.ok) throw new Error("영상 조회 실패");
  return res.json();
}

export async function listFrames(id: number): Promise<FrameList> {
  const res = await fetch(`${API_URL}/api/v1/videos/${id}/frames`);
  if (!res.ok) throw new Error("프레임 조회 실패");
  return res.json();
}

export async function deleteVideo(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/videos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제 실패");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(sec: number | null): string {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export { API_URL };
