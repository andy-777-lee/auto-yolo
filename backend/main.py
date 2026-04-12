import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB 테이블 자동 생성
    from database import engine, Base
    import models.video  # noqa: F401 — 모델 등록
    Base.metadata.create_all(bind=engine)
    print("Vision AutoML Platform starting...")
    yield
    print("Vision AutoML Platform shutting down...")


app = FastAPI(
    title="Vision AutoML Platform API",
    description="로컬 GPU 기반 YOLO 객체감지 모델 자동화 플랫폼",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from api.health import router as health_router
from api.videos import router as videos_router

app.include_router(health_router, tags=["Health"])
app.include_router(videos_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
