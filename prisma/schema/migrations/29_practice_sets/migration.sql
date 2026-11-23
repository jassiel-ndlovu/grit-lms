-- Practice sets with spaced repetition (contracts/practice.md). Additive.
CREATE TABLE "PracticeSet" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeItem" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "data" JSONB NOT NULL,
    "bankQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeReview" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastAnsweredAt" TIMESTAMP(3) NOT NULL,
    "lastShare" DOUBLE PRECISION NOT NULL,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PracticeReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeSet_courseId_idx" ON "PracticeSet"("courseId");
CREATE INDEX "PracticeItem_setId_idx" ON "PracticeItem"("setId");
CREATE UNIQUE INDEX "PracticeReview_itemId_studentId_key" ON "PracticeReview"("itemId", "studentId");
CREATE INDEX "PracticeReview_studentId_dueAt_idx" ON "PracticeReview"("studentId", "dueAt");

ALTER TABLE "PracticeSet" ADD CONSTRAINT "PracticeSet_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeItem" ADD CONSTRAINT "PracticeItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PracticeSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeReview" ADD CONSTRAINT "PracticeReview_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PracticeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
