-- CreateTable
CREATE TABLE "PaymentCallbackEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transactionCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCallbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_eventType_idx" ON "PaymentCallbackEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_transactionCode_idx" ON "PaymentCallbackEvent"("transactionCode");

-- CreateIndex
CREATE INDEX "PaymentCallbackEvent_status_idx" ON "PaymentCallbackEvent"("status");
