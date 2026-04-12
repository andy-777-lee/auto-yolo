# auto-yolo (Vision AutoML Platform)

로컬 GPU 기반 Vision Model 자동화 플랫폼 (1인 도구)
YOLO v8/v11로 객체감지 모델을 자동으로 만들어주는 웹 플랫폼

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python) |
| DB | PostgreSQL |
| 비동기 | FastAPI BackgroundTasks |
| 컨테이너 | Docker + Docker Compose |
| 영상처리 | OpenCV + FFmpeg |
| YOLO | Ultralytics (v8/v11) |

## 빠른 시작

```bash
# 환경변수 설정
cp .env.example .env

# 전체 실행
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs

## 상세 문서

[CLAUDE.md](./CLAUDE.md) 참고
