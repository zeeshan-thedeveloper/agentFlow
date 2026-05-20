-- CreateTable
CREATE TABLE "database_schema_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_schema_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "database_schema_configs_userId_idx" ON "database_schema_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "database_schema_configs_userId_integrationId_key" ON "database_schema_configs"("userId", "integrationId");

-- AddForeignKey
ALTER TABLE "database_schema_configs" ADD CONSTRAINT "database_schema_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
