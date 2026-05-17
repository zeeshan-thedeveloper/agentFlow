-- CreateTable
CREATE TABLE "user_integration_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "maskedHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_integration_credentials_userId_idx" ON "user_integration_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_integration_credentials_userId_integrationId_key" ON "user_integration_credentials"("userId", "integrationId");

-- AddForeignKey
ALTER TABLE "user_integration_credentials" ADD CONSTRAINT "user_integration_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
