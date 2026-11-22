-- Marks per rubric criterion on a question grade (#216). Additive: one nullable column.
ALTER TABLE "QuestionGrade" ADD COLUMN "criteria" JSONB;
