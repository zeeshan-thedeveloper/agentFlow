-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN "trigger" JSONB,
ADD COLUMN "results" JSONB;
