# Vision AutoML Platform — CLAUDE.md

## 프로젝트 컨텍스트

### 목적
로컬 GPU 기반 Vision Model 자동화 플랫폼 (1인 도구)
YOLO v8/v11로 객체감지 모델을 자동으로 만들어주는 웹 플랫폼

### 기술 스택
- **Frontend**: Next.js 14 + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python)
- **DB**: PostgreSQL
- **비동기**: FastAPI BackgroundTasks
- **컨테이너**: Docker + Docker Compose
- **영상처리**: OpenCV + FFmpeg
- **YOLO**: Ultralytics (v8/v11)

### 아키텍처 결정사항
- 로그인/인증 없음 (1인 도구)
- `.env` 파일로 환경변수 관리 (`.gitignore`에 포함)
- CORS: frontend (port 3000) ↔ backend (port 8000)

## 폴더 구조
```
auto-yolo/
├── frontend/          # Next.js 14
│   ├── app/           # App Router
│   ├── components/    # shadcn/ui 컴포넌트
│   ├── lib/           # 유틸리티
│   └── Dockerfile
├── backend/           # FastAPI
│   ├── api/           # 라우터
│   ├── core/          # YOLO, OpenCV 연동
│   ├── models/        # DB 모델 (SQLAlchemy)
│   ├── workers/       # BackgroundTasks
│   ├── main.py
│   ├── database.py
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

## 개발 명령어

### 전체 실행
```bash
cp .env.example .env
docker-compose up --build
```

### 개별 서비스
```bash
# Frontend dev
cd frontend && npm install && npm run dev

# Backend dev
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# DB only
docker-compose up db
```

### API 확인
- Health: http://localhost:8000/health
- DB Health: http://localhost:8000/health/db
- Swagger UI: http://localhost:8000/docs
- Frontend: http://localhost:3000

## Phase 진행 현황
- [x] Phase 1: 기본 세팅 (폴더 구조, Docker, CORS, Health API)
- [ ] Phase 2: 영상 업로드 + 프레임 추출
- [ ] Phase 3: 라벨링 UI
- [ ] Phase 4: YOLO 학습 파이프라인
- [ ] Phase 5: 모델 관리 + 추론
