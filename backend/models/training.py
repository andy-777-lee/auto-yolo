from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String

from database import Base


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    model_name = Column(String, default="yolov8n")
    epochs = Column(Integer, default=50)
    batch_size = Column(Integer, default=16)
    imgsz = Column(Integer, default=640)
    val_split = Column(Float, default=0.2)

    # 상태 추적
    status = Column(String, default="pending")  # pending|preparing|training|done|error
    current_epoch = Column(Integer, default=0)
    total_epochs = Column(Integer, default=50)
    metrics = Column(JSON, nullable=True)  # 최신 메트릭 (mAP, loss 등)
    output_dir = Column(String, nullable=True)
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
