-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('CONTRACT', 'INVOICE', 'OTHER');

-- CreateTable
CREATE TABLE "managed_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocCategory" NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "managed_documents_uploadedById_createdAt_idx" ON "managed_documents"("uploadedById", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "managed_documents" ADD CONSTRAINT "managed_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
