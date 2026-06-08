-- CreateTable LessonResource
CREATE TABLE "LessonResource" (
  "id"        TEXT NOT NULL,
  "lessonId"  TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "label"     TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable LessonMediaChapter
CREATE TABLE "LessonMediaChapter" (
  "id"               TEXT NOT NULL,
  "lessonResourceId" TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "startSec"         DOUBLE PRECISION NOT NULL,
  "sortOrder"        INTEGER NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonMediaChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable LessonTextBlock
CREATE TABLE "LessonTextBlock" (
  "id"            TEXT NOT NULL,
  "lessonId"      TEXT NOT NULL,
  "blockIndex"    INTEGER NOT NULL,
  "content"       TEXT NOT NULL,
  "audioStartSec" DOUBLE PRECISION,
  "audioEndSec"   DOUBLE PRECISION,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonTextBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_sortOrder_idx" ON "LessonResource"("lessonId", "sortOrder");
CREATE INDEX "LessonMediaChapter_lessonResourceId_sortOrder_idx" ON "LessonMediaChapter"("lessonResourceId", "sortOrder");
CREATE INDEX "LessonTextBlock_lessonId_blockIndex_idx" ON "LessonTextBlock"("lessonId", "blockIndex");

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonMediaChapter" ADD CONSTRAINT "LessonMediaChapter_lessonResourceId_fkey"
  FOREIGN KEY ("lessonResourceId") REFERENCES "LessonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonTextBlock" ADD CONSTRAINT "LessonTextBlock_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
