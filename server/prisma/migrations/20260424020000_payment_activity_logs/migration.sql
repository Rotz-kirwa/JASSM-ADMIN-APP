-- AlterTable
ALTER TABLE "PaymentCallbackEvent"
ADD COLUMN "method" TEXT,
ADD COLUMN "path" TEXT,
ADD COLUMN "contentType" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ip" TEXT,
ADD COLUMN "headers" JSONB,
ADD COLUMN "query" JSONB,
ADD COLUMN "rawBody" TEXT,
ADD COLUMN "paymentId" TEXT;

-- CreateTable
CREATE TABLE "PaymentActivityLog" (
    "id" TEXT NOT NULL,
    "callbackEventId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_createdAt_idx" ON "PaymentCallbackEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentActivityLog_callbackEventId_idx" ON "PaymentActivityLog"("callbackEventId");

-- CreateIndex
CREATE INDEX "PaymentActivityLog_level_idx" ON "PaymentActivityLog"("level");

-- CreateIndex
CREATE INDEX "PaymentActivityLog_stage_idx" ON "PaymentActivityLog"("stage");

-- CreateIndex
CREATE INDEX "PaymentActivityLog_createdAt_idx" ON "PaymentActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentActivityLog" ADD CONSTRAINT "PaymentActivityLog_callbackEventId_fkey" FOREIGN KEY ("callbackEventId") REFERENCES "PaymentCallbackEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
