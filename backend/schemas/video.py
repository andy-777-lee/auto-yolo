from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VideoResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    duration: Optional[float]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    total_frames: Optional[int]
    status: str
    extracted_frames: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
