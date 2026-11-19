-- CreateEnum
CREATE TYPE "Category" AS ENUM ('HEADPHONE', 'EARPHONE', 'SPEAKER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'HEADPHONE';
