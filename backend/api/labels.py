import io
import os
import zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.label import FrameLabel, LabelClass
from models.video import Video
from schemas.label import (
    BBoxResponse,
    FrameLabelsUpdate,
    LabelClassCreate,
    LabelClassResponse,
    LabelStatsResponse,
)
from workers.frame_extractor import FRAMES_DIR

router = APIRouter(prefix="/api/v1/labels", tags=["Labels"])

COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
]


def _get_video_or_404(video_id: int, db: Session) -> Video:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    return video


# ── 클래스 관리 ──────────────────────────────────────────────

@router.get("/{video_id}/classes", response_model=List[LabelClassResponse])
def list_classes(video_id: int, db: Session = Depends(get_db)):
    _get_video_or_404(video_id, db)
    return db.query(LabelClass).filter(LabelClass.video_id == video_id).all()


@router.post("/{video_id}/classes", response_model=LabelClassResponse)
def create_class(video_id: int, body: LabelClassCreate, db: Session = Depends(get_db)):
    _get_video_or_404(video_id, db)
    existing = db.query(LabelClass).filter(
        LabelClass.video_id == video_id, LabelClass.name == body.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 클래스 이름입니다")

    # 색상 자동 지정 (지정 안 했을 때)
    count = db.query(LabelClass).filter(LabelClass.video_id == video_id).count()
    color = body.color if body.color != "#ef4444" else COLORS[count % len(COLORS)]

    cls = LabelClass(video_id=video_id, name=body.name, color=color)
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


@router.delete("/{video_id}/classes/{class_id}")
def delete_class(video_id: int, class_id: int, db: Session = Depends(get_db)):
    cls = db.query(LabelClass).filter(
        LabelClass.id == class_id, LabelClass.video_id == video_id
    ).first()
    if not cls:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다")
    db.query(FrameLabel).filter(
        FrameLabel.video_id == video_id, FrameLabel.class_id == class_id
    ).delete()
    db.delete(cls)
    db.commit()
    return {"message": "삭제되었습니다"}


# ── 프레임 라벨 ──────────────────────────────────────────────

@router.get("/{video_id}/frames/{frame_name}", response_model=List[BBoxResponse])
def get_frame_labels(video_id: int, frame_name: str, db: Session = Depends(get_db)):
    _get_video_or_404(video_id, db)
    return db.query(FrameLabel).filter(
        FrameLabel.video_id == video_id,
        FrameLabel.frame_name == frame_name,
    ).all()


@router.put("/{video_id}/frames/{frame_name}", response_model=List[BBoxResponse])
def save_frame_labels(
    video_id: int, frame_name: str, body: FrameLabelsUpdate, db: Session = Depends(get_db)
):
    _get_video_or_404(video_id, db)
    # 기존 라벨 전체 교체
    db.query(FrameLabel).filter(
        FrameLabel.video_id == video_id,
        FrameLabel.frame_name == frame_name,
    ).delete()

    new_labels = [
        FrameLabel(
            video_id=video_id,
            frame_name=frame_name,
            class_id=b.class_id,
            cx=b.cx, cy=b.cy, w=b.w, h=b.h,
        )
        for b in body.labels
    ]
    db.add_all(new_labels)
    db.commit()
    for lbl in new_labels:
        db.refresh(lbl)
    return new_labels


# ── 통계 ──────────────────────────────────────────────────────

@router.get("/{video_id}/stats", response_model=LabelStatsResponse)
def get_stats(video_id: int, db: Session = Depends(get_db)):
    video = _get_video_or_404(video_id, db)

    frame_dir = os.path.join(FRAMES_DIR, str(video_id))
    total_frames = 0
    if os.path.exists(frame_dir):
        total_frames = len([f for f in os.listdir(frame_dir) if f.endswith(".jpg")])

    labeled_frames = (
        db.query(FrameLabel.frame_name)
        .filter(FrameLabel.video_id == video_id)
        .distinct()
        .count()
    )
    total_boxes = db.query(FrameLabel).filter(FrameLabel.video_id == video_id).count()

    return LabelStatsResponse(
        total_frames=total_frames,
        labeled_frames=labeled_frames,
        total_boxes=total_boxes,
    )


# ── YOLO 포맷 내보내기 ────────────────────────────────────────

@router.get("/{video_id}/export")
def export_labels(video_id: int, db: Session = Depends(get_db)):
    video = _get_video_or_404(video_id, db)

    classes = db.query(LabelClass).filter(LabelClass.video_id == video_id).all()
    if not classes:
        raise HTTPException(status_code=400, detail="클래스가 없습니다")

    # class_id → index 매핑
    id_to_idx = {cls.id: idx for idx, cls in enumerate(classes)}

    labels = db.query(FrameLabel).filter(FrameLabel.video_id == video_id).all()

    # 프레임별 그룹핑
    frame_map: dict[str, list[FrameLabel]] = {}
    for lbl in labels:
        frame_map.setdefault(lbl.frame_name, []).append(lbl)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # classes.txt
        classes_txt = "\n".join(cls.name for cls in classes)
        zf.writestr("classes.txt", classes_txt)

        # labels/*.txt (YOLO format: class_idx cx cy w h)
        for frame_name, frame_labels in frame_map.items():
            stem = os.path.splitext(frame_name)[0]
            lines = []
            for lbl in frame_labels:
                idx = id_to_idx.get(lbl.class_id)
                if idx is None:
                    continue
                lines.append(f"{idx} {lbl.cx:.6f} {lbl.cy:.6f} {lbl.w:.6f} {lbl.h:.6f}")
            zf.writestr(f"labels/{stem}.txt", "\n".join(lines))

    buf.seek(0)
    filename = f"{video.original_filename.rsplit('.', 1)[0]}_labels.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
