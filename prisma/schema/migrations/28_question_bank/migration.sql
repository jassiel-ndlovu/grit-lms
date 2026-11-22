-- Question bank (contracts/question-bank.md). Additive.
ALTER TABLE "TestQuestion" ADD COLUMN "bankQuestionId" TEXT;

CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "gradeLevel" INTEGER,
    "data" JSONB NOT NULL,
    "sourceTestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankQuestion_workspaceId_ownerUserId_createdAt_idx" ON "BankQuestion"("workspaceId", "ownerUserId", "createdAt");
