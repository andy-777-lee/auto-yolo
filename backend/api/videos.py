import os
import shutil
import uuid
from typing import List

import cv2
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models.video import Video
from schemas.video import VideoResponse
from workers.frame_extractor import FRAMES_DIR, extract_frames

router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads/videos")
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def _ensure_dirs() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)


@router.post("/upload", response_model=VideoResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    interval_sec: float = 1.0,
    db: Session = Depends(get_db),
):
    _ensure_dirs()

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 형식: {ext}")

    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # 영상 메타데이터 추출
    cap = cv2.VideoCapture(file_path)
    fps = width = height = duration = total_frames = None
    if cap.isOpened():
        _fps = cap.get(cv2.CAP_PROP_FPS)
        _total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        _w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        _h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = _fps if _fps > 0 else None
        total_frames = _total if _total > 0 else None
        width = _w if _w > 0 else None
        height = _h if _h > 0 else None
        if fps and total_frames:
            duration = total_frames / fps
        cap.release()

    db_video = Video(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        total_frames=total_frames,
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    background_tasks.add_task(extract_frames, db_video.id, file_path, interval_sec, db)

    return db_video


@router.get("", response_model=List[VideoResponse])
def list_videos(db: Session = Depends(get_db)):
    return db.query(Video).order_by(Video.created_at.desc()).all()


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    return video


@router.get("/{video_id}/frames")
def list_frames(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")

    frame_dir = os.path.join(FRAMES_DIR, str(video_id))
    if not os.path.exists(frame_dir):
        return {"video_id": video_id, "total": 0, "frames": []}

    frames = sorted(f for f in os.listdir(frame_dir) if f.endswith(".jpg"))
    return {
        "video_id": video_id,
        "total": len(frames),
        "frames": [f"/api/v1/videos/{video_id}/frames/{f}" for f in frames],
    }


@router.get("/{video_id}/frames/{frame_name}")
def get_frame(video_id: int, frame_name: str):
    # 경로 탐색 방지
    if "/" in frame_name or ".." in frame_name:
        raise HTTPException(status_code=400, detail="잘못된 파일명")
    frame_path = os.path.join(FRAMES_DIR, str(video_id), frame_name)
    if not os.path.exists(frame_path):
        raise HTTPException(status_code=404, detail="프레임을 찾을 수 없습니다")
    return FileResponse(frame_path, media_type="image/jpeg")


@router.delete("/{video_id}")
def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")

    if os.path.exists(video.file_path):
        os.remove(video.file_path)

    frame_dir = os.path.join(FRAMES_DIR, str(video_id))
    if os.path.exists(frame_dir):
        shutil.rmtree(frame_dir)

    db.delete(video)
    db.commit()
    return {"message": "삭제되었습니다"}
