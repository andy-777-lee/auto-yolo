import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import Base, engine
    import models.video   # noqa: F401
    import models.label   # noqa: F401
    Base.metadata.create_all(bind=engine)
    print("Vision AutoML Platform starting...")
    yield
    print("Vision AutoML Platform shutting down...")


app = FastAPI(
    title="Vision AutoML Platform API",
    description="로컬 GPU 기반 YOLO 객체감지 모델 자동화 플랫폼",
    version="0.3.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.health import router as health_router
from api.videos import router as videos_router
from api.labels import router as labels_router

app.include_router(health_router, tags=["Health"])
app.include_router(videos_router)
app.include_router(labels_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
