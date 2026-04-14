import os
import time
import uuid
from typing import Any

import cv2

RESULTS_DIR = os.getenv("RESULTS_DIR", "/app/results")

# 메모리 모델 캐시 (프로세스 내 재사용)
_model_cache: dict[int, Any] = {}


def get_model(job_id: int, weights_path: str):
    if job_id not in _model_cache:
        from ultralytics import YOLO
        _model_cache[job_id] = YOLO(weights_path)
    return _model_cache[job_id]


def clear_model_cache(job_id: int) -> None:
    _model_cache.pop(job_id, None)


def run_inference(
    job_id: int,
    weights_path: str,
    image_data: bytes,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
) -> dict:
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # 업로드된 이미지 임시 저장
    tmp_id = uuid.uuid4().hex
    input_path = os.path.join(RESULTS_DIR, f"_input_{tmp_id}.jpg")
    with open(input_path, "wb") as f:
        f.write(image_data)

    try:
        model = get_model(job_id, weights_path)

        t0 = time.perf_counter()
        results = model.predict(
            input_path,
            conf=conf_threshold,
            iou=iou_threshold,
            verbose=False,
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        result = results[0]

        # 어노테이션 이미지 저장
        result_filename = f"result_{tmp_id}.jpg"
        result_path = os.path.join(RESULTS_DIR, result_filename)
        annotated = result.plot()  # BGR numpy array
        cv2.imwrite(result_path, annotated)

        # 탐지 결과 파싱
        detections = []
        if result.boxes is not None and len(result.boxes):
            for box in result.boxes:
                cls_id = int(box.cls[0])
                detections.append({
                    "class_id": cls_id,
                    "class_name": model.names.get(cls_id, str(cls_id)),
                    "confidence": round(float(box.conf[0]), 4),
                    "bbox": {
                        "x1": int(box.xyxy[0][0]),
                        "y1": int(box.xyxy[0][1]),
                        "x2": int(box.xyxy[0][2]),
                        "y2": int(box.xyxy[0][3]),
                    },
                })

        # confidence 내림차순 정렬
        detections.sort(key=lambda d: d["confidence"], reverse=True)

        return {
            "result_filename": result_filename,
            "detections": detections,
            "inference_time_ms": elapsed_ms,
            "image_size": {
                "width": result.orig_shape[1],
                "height": result.orig_shape[0],
            },
        }
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)
