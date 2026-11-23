-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "status" "CommentStatus" NOT NULL DEFAULT 'PENDING';

-- comments that were already approved keep their approval
UPDATE "Comment" SET "status" = 'APPROVED' WHERE "isApproved" = true;

-- DropIndex
DROP INDEX "Comment_productId_isApproved_idx";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "isApproved";

-- CreateIndex
CREATE INDEX "Comment_productId_status_idx" ON "Comment"("productId", "status");

-- CreateIndex
CREATE INDEX "Comment_status_createdAt_idx" ON "Comment"("status", "createdAt");
