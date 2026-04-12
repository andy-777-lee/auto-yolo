import os

import cv2
from sqlalchemy.orm import Session

from models.video import Video

FRAMES_DIR = os.getenv("FRAMES_DIR", "/app/uploads/frames")


def extract_frames(video_id: int, file_path: str, interval_sec: float, db: Session) -> None:
    """영상에서 지정 간격으로 프레임을 추출해 JPEG로 저장"""
    video_dir = os.path.join(FRAMES_DIR, str(video_id))
    os.makedirs(video_dir, exist_ok=True)

    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        return

    db_video.status = "extracting"
    db.commit()

    try:
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise RuntimeError(f"영상을 열 수 없습니다: {file_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_interval = max(1, int(fps * interval_sec))

        frame_idx = 0
        saved_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                frame_path = os.path.join(video_dir, f"frame_{saved_count:05d}.jpg")
                cv2.imwrite(frame_path, frame)
                saved_count += 1
            frame_idx += 1

        cap.release()

        db_video.status = "done"
        db_video.extracted_frames = saved_count
        db.commit()

    except Exception as e:
        db_video.status = "error"
        db_video.error_message = str(e)
        db.commit()
