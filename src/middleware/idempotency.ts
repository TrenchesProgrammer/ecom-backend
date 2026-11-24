import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { redis } from "../config/redis";

interface IdempotencyOptions {
  required?: boolean;
  lockTtlSeconds?: number;
  cacheTtlSeconds?: number;
}
export const idempotency = () => async (req: Request, res: Response, next: NextFunction) => {
  const key = req.header("idempotency-key");
  if (!key) return res.status(400).json({ error: "Idempotency-Key header required" });

  const redisKey = `idem:${req.get  ('user-token')}:${req.method}:${req.originalUrl}:${key}`;

  // Try to claim the key
  const acquired = await redis.set(
    redisKey,
    JSON.stringify({ status: "IN_PROGRESS" }),
    "EX",
    60,
    "NX"
  );

  if (!acquired) {
    const saved = JSON.parse((await redis.get(redisKey)) ?? "null");
    if (saved?.status === "COMPLETED") {
      return res.status(saved.statusCode).json(saved.body);
    }
    return res.status(409).json({ error: "Request already in progress" });
  }


  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500) {
      redis.del(redisKey).catch(console.error);
    } else {
      redis
        .set(
          redisKey,
          JSON.stringify({ status: "COMPLETED", statusCode: res.statusCode, body }),
          "EX",
          86400
        )
        .catch(console.error);
    }
    return originalJson(body);
  };

  next();
};
