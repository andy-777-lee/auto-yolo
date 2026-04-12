from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from api.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Vision AutoML Platform starting...")
    yield
    print("Vision AutoML Platform shutting down...")


app = FastAPI(
    title="Vision AutoML Platform API",
    description="로컬 GPU 기반 YOLO 객체감지 모델 자동화 플랫폼",
    version="0.1.0",
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
app.include_router(health_router, tags=["Health"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
