import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models.training import TrainingJob
from workers.inferencer import RESULTS_DIR, clear_model_cache, run_inference
from workers.trainer import RUNS_DIR

router = APIRouter(prefix="/api/v1/models", tags=["Models & Inference"])

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _weights_path(job_id: int) -> Optional[str]:
    path = os.path.join(RUNS_DIR, str(job_id), "weights", "best.pt")
    return path if os.path.exists(path) else None


# ── 모델 목록 ─────────────────────────────────────────────────

@router.get("")
def list_models(db: Session = Depends(get_db)):
    jobs = (
        db.query(TrainingJob)
        .filter(TrainingJob.status == "done")
        .order_by(TrainingJob.created_at.desc())
        .all()
    )
    result = []
    for job in jobs:
        wp = _weights_path(job.id)
        result.append({
            "id": job.id,
            "name": job.name,
            "model_name": job.model_name,
            "video_id": job.video_id,
            "epochs": job.epochs,
            "imgsz": job.imgsz,
            "metrics": job.metrics,
            "weights_available": wp is not None,
            "created_at": job.created_at,
            "finished_at": job.finished_at,
        })
    return result


@router.get("/{job_id}")
def get_model(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TrainingJob).filter(
        TrainingJob.id == job_id, TrainingJob.status == "done"
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="모델을 찾을 수 없습니다")
    wp = _weights_path(job_id)
    return {
        "id": job.id,
        "name": job.name,
        "model_name": job.model_name,
        "video_id": job.video_id,
        "epochs": job.epochs,
        "imgsz": job.imgsz,
        "metrics": job.metrics,
        "weights_available": wp is not None,
        "created_at": job.created_at,
        "finished_at": job.finished_at,
    }


# ── 추론 ──────────────────────────────────────────────────────

@router.post("/{job_id}/infer")
async def infer(
    job_id: int,
    file: UploadFile = File(...),
    conf: float = Form(default=0.25),
    iou: float = Form(default=0.45),
    db: Session = Depends(get_db),
):
    job = db.query(TrainingJob).filter(
        TrainingJob.id == job_id, TrainingJob.status == "done"
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="모델을 찾을 수 없습니다")

    wp = _weights_path(job_id)
    if not wp:
        raise HTTPException(status_code=404, detail="가중치 파일이 없습니다")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 이미지 형식: {ext}")

    image_data = await file.read()

    try:
        result = run_inference(job_id, wp, image_data, conf_threshold=conf, iou_threshold=iou)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"추론 실패: {str(exc)}")

    return result


@router.get("/{job_id}/infer/result/{filename}")
def get_result_image(job_id: int, filename: str):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명")
    path = os.path.join(RESULTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="결과 이미지를 찾을 수 없습니다")
    return FileResponse(path, media_type="image/jpeg")


@router.delete("/{job_id}/cache")
def clear_cache(job_id: int):
    """메모리에서 모델 캐시 제거 (메모리 확보용)"""
    clear_model_cache(job_id)
    return {"message": "캐시가 삭제되었습니다"}
