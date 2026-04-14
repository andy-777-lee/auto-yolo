import os
import random
import shutil
from datetime import datetime

import yaml

from database import SessionLocal
from models.label import FrameLabel, LabelClass
from models.training import TrainingJob
from workers.frame_extractor import FRAMES_DIR

DATASETS_DIR = os.getenv("DATASETS_DIR", "/app/datasets")
RUNS_DIR = os.getenv("RUNS_DIR", "/app/runs")


def _prepare_dataset(job_id: int, video_id: int, val_split: float, db) -> tuple[str, int, list[str]]:
    """YOLO 학습용 폴더 구조 생성 및 train/val 분할"""
    # 라벨 있는 프레임 목록
    rows = db.query(FrameLabel.frame_name).filter(
        FrameLabel.video_id == video_id
    ).distinct().all()
    frame_names = [r[0] for r in rows]

    if not frame_names:
        raise ValueError("라벨링된 프레임이 없습니다. 먼저 라벨링을 해주세요.")

    # 클래스 목록 (id → index 매핑)
    classes = db.query(LabelClass).filter(
        LabelClass.video_id == video_id
    ).order_by(LabelClass.id).all()
    class_names = [c.name for c in classes]
    id_to_idx = {c.id: idx for idx, c in enumerate(classes)}

    # train / val 분할
    random.shuffle(frame_names)
    n_val = max(1, int(len(frame_names) * val_split))
    splits = {
        "val": frame_names[:n_val],
        "train": frame_names[n_val:] or frame_names,  # 최소 1장 보장
    }

    dataset_path = os.path.join(DATASETS_DIR, str(job_id))
    frames_src = os.path.join(FRAMES_DIR, str(video_id))

    for split, names in splits.items():
        img_dir = os.path.join(dataset_path, "images", split)
        lbl_dir = os.path.join(dataset_path, "labels", split)
        os.makedirs(img_dir, exist_ok=True)
        os.makedirs(lbl_dir, exist_ok=True)

        for frame_name in names:
            # 이미지 복사
            shutil.copy2(
                os.path.join(frames_src, frame_name),
                os.path.join(img_dir, frame_name),
            )
            # 라벨 파일 작성 (YOLO: class_idx cx cy w h)
            lbls = db.query(FrameLabel).filter(
                FrameLabel.video_id == video_id,
                FrameLabel.frame_name == frame_name,
            ).all()
            stem = os.path.splitext(frame_name)[0]
            with open(os.path.join(lbl_dir, f"{stem}.txt"), "w") as f:
                for lbl in lbls:
                    idx = id_to_idx.get(lbl.class_id)
                    if idx is not None:
                        f.write(f"{idx} {lbl.cx:.6f} {lbl.cy:.6f} {lbl.w:.6f} {lbl.h:.6f}\n")

    # data.yaml
    data_yaml = {
        "path": dataset_path,
        "train": "images/train",
        "val": "images/val",
        "nc": len(class_names),
        "names": class_names,
    }
    with open(os.path.join(dataset_path, "data.yaml"), "w", encoding="utf-8") as f:
        yaml.dump(data_yaml, f, allow_unicode=True)

    return dataset_path, len(class_names), class_names


def run_training(job_id: int) -> None:
    """BackgroundTask로 실행되는 YOLO 학습 함수"""
    db = SessionLocal()
    try:
        job: TrainingJob = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return

        # 1. 데이터셋 준비
        job.status = "preparing"
        job.started_at = datetime.utcnow()
        db.commit()

        dataset_path, _, _ = _prepare_dataset(job_id, job.video_id, job.val_split, db)

        # 2. YOLO 학습
        job.status = "training"
        db.commit()

        from ultralytics import YOLO  # 무거운 import를 실행 시점으로 지연

        model = YOLO(f"{job.model_name}.pt")

        def on_epoch_end(trainer):
            """에포크마다 DB에 진행률 및 메트릭 업데이트"""
            try:
                j = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
                if not j:
                    return
                j.current_epoch = trainer.epoch + 1
                if hasattr(trainer, "metrics") and trainer.metrics:
                    j.metrics = {
                        k: round(float(v), 6)
                        for k, v in trainer.metrics.items()
                        if v is not None
                    }
                db.commit()
            except Exception:
                db.rollback()

        model.add_callback("on_train_epoch_end", on_epoch_end)

        results = model.train(
            data=os.path.join(dataset_path, "data.yaml"),
            epochs=job.epochs,
            batch=job.batch_size,
            imgsz=job.imgsz,
            project=RUNS_DIR,
            name=str(job_id),
            exist_ok=True,
            verbose=False,
        )

        # 3. 완료 처리
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        job.status = "done"
        job.current_epoch = job.epochs
        job.output_dir = os.path.join(RUNS_DIR, str(job_id))
        job.finished_at = datetime.utcnow()

        if results and hasattr(results, "results_dict"):
            job.metrics = {
                k: round(float(v), 6)
                for k, v in results.results_dict.items()
                if v is not None
            }
        db.commit()

    except Exception as exc:
        try:
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if job:
                job.status = "error"
                job.error_message = str(exc)
                job.finished_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
