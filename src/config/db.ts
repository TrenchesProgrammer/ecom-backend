import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
// @ts-ignore
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});




const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "error", "warn"]
      : ["error"],
});


const globalForPrisma = globalThis as unknown as { prisma: any };

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("DB connected via Prisma");
  } catch (error: any) {
    console.error("Database connection error:", error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await prisma.$disconnect();
};

export { prisma, connectDB, disconnectDB };