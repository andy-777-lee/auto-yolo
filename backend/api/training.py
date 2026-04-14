import os
import shutil
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models.label import FrameLabel
from models.training import TrainingJob
from models.video import Video
from schemas.training import TrainingJobCreate, TrainingJobResponse
from workers.trainer import RUNS_DIR, run_training

router = APIRouter(prefix="/api/v1/training", tags=["Training"])

VALID_MODELS = {"yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolo11n", "yolo11s"}


@router.post("", response_model=TrainingJobResponse)
def start_training(
    body: TrainingJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # 영상 확인
    video = db.query(Video).filter(Video.id == body.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    if video.status != "done":
        raise HTTPException(status_code=400, detail="프레임 추출이 완료된 영상만 학습할 수 있습니다")

    # 라벨 확인
    labeled_count = (
        db.query(FrameLabel.frame_name)
        .filter(FrameLabel.video_id == body.video_id)
        .distinct()
        .count()
    )
    if labeled_count == 0:
        raise HTTPException(status_code=400, detail="라벨링된 프레임이 없습니다. 먼저 라벨링을 해주세요.")

    if body.model_name not in VALID_MODELS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 모델입니다: {body.model_name}")

    job_name = body.name or f"{video.original_filename.rsplit('.', 1)[0]}_train"
    job = TrainingJob(
        video_id=body.video_id,
        name=job_name,
        model_name=body.model_name,
        epochs=body.epochs,
        batch_size=body.batch_size,
        imgsz=body.imgsz,
        val_split=body.val_split,
        total_epochs=body.epochs,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_training, job.id)
    return job


@router.get("", response_model=List[TrainingJobResponse])
def list_jobs(video_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(TrainingJob)
    if video_id is not None:
        q = q.filter(TrainingJob.video_id == video_id)
    return q.order_by(TrainingJob.created_at.desc()).all()


@router.get("/{job_id}", response_model=TrainingJobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="학습 작업을 찾을 수 없습니다")
    return job


@router.get("/{job_id}/download")
def download_weights(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="학습 작업을 찾을 수 없습니다")
    if job.status != "done":
        raise HTTPException(status_code=400, detail="학습이 완료되지 않았습니다")

    weights_path = os.path.join(RUNS_DIR, str(job_id), "weights", "best.pt")
    if not os.path.exists(weights_path):
        raise HTTPException(status_code=404, detail="가중치 파일을 찾을 수 없습니다")

    return FileResponse(
        weights_path,
        media_type="application/octet-stream",
        filename=f"{job.name}_best.pt",
    )


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="학습 작업을 찾을 수 없습니다")

    from workers.trainer import DATASETS_DIR

    for d in [
        os.path.join(DATASETS_DIR, str(job_id)),
        os.path.join(RUNS_DIR, str(job_id)),
    ]:
        if os.path.exists(d):
            shutil.rmtree(d)

    db.delete(job)
    db.commit()
    return {"message": "삭제되었습니다"}
