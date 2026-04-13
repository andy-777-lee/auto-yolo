from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class LabelClassCreate(BaseModel):
    name: str
    color: str = "#ef4444"


class LabelClassResponse(BaseModel):
    id: int
    video_id: int
    name: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BBoxCreate(BaseModel):
    class_id: int
    cx: float = Field(ge=0.0, le=1.0)
    cy: float = Field(ge=0.0, le=1.0)
    w: float = Field(ge=0.0, le=1.0)
    h: float = Field(ge=0.0, le=1.0)


class BBoxResponse(BBoxCreate):
    id: int
    frame_name: str

    model_config = {"from_attributes": True}


class FrameLabelsUpdate(BaseModel):
    labels: List[BBoxCreate]


class LabelStatsResponse(BaseModel):
    total_frames: int
    labeled_frames: int
    total_boxes: int
