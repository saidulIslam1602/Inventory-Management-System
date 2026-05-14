-- CreateEnum
CREATE TYPE "AuditEventCategory" AS ENUM ('SETTINGS', 'EXPORT', 'SECURITY', 'AUTH', 'DATA');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "category" "AuditEventCategory" NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "targetType" VARCHAR(64),
    "targetId" VARCHAR(64),
    "summary" VARCHAR(1024) NOT NULL,
    "metadata" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_events_category_idx" ON "audit_events"("category");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
