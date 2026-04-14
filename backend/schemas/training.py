from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TrainingJobCreate(BaseModel):
    video_id: int
    name: Optional[str] = None
    model_name: str = "yolov8n"
    epochs: int = Field(default=50, ge=1, le=300)
    batch_size: int = Field(default=16, ge=1, le=128)
    imgsz: int = Field(default=640, ge=320, le=1280)
    val_split: float = Field(default=0.2, ge=0.05, le=0.5)


class TrainingJobResponse(BaseModel):
    id: int
    video_id: int
    name: str
    model_name: str
    epochs: int
    batch_size: int
    imgsz: int
    val_split: float
    status: str
    current_epoch: int
    total_epochs: int
    metrics: Optional[Dict[str, Any]]
    output_dir: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]

    model_config = {"from_attributes": True}
