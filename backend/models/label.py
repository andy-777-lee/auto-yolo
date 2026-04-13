from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String

from database import Base


class LabelClass(Base):
    __tablename__ = "label_classes"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, default="#ef4444")
    created_at = Column(DateTime, default=datetime.utcnow)


class FrameLabel(Base):
    __tablename__ = "frame_labels"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    frame_name = Column(String, nullable=False)
    class_id = Column(Integer, nullable=False)  # LabelClass.id
    cx = Column(Float, nullable=False)  # YOLO: center x (0~1)
    cy = Column(Float, nullable=False)
    w = Column(Float, nullable=False)
    h = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
