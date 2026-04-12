export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Vision AutoML Platform
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          로컬 GPU 기반 YOLO 객체감지 모델 자동화 플랫폼
        </p>
        <div className="flex flex-col items-center gap-4">
          <div className="px-6 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium">
            Phase 1 — 세팅 완료
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            API Docs (Swagger) →
          </a>
        </div>
      </div>
    </main>
  );
}
