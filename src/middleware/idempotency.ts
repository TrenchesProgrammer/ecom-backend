import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { redis } from "../config/redis";

interface IdempotencyOptions {
  required?: boolean;
  lockTtlSeconds?: number;
  cacheTtlSeconds?: number;
}

export const idempotency = (options: IdempotencyOptions = {}) => {
  const {
    required = true,
    lockTtlSeconds = 60, // 60 seconds lock for in-progress operations
    cacheTtlSeconds = 86400, // 24 hours cache for completed operations
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract Idempotency Key from headers
    const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!idempotencyKey) {
      if (required) {
        return res.status(400).json({
          error: "Idempotency-Key header is required for this operation",
        });
      }
      return next();
    }

    // 2. Compute SHA-256 hash of the request body to verify payload integrity
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");

    // 3. Build namespaced Redis key
    const userScope = req.body?.userToken || "guest";
    const redisKey = `idempotency:${req.method}:${req.baseUrl || ""}${req.path}:${userScope}:${idempotencyKey}`;

    try {
      // 4. Try to atomically acquire in-progress lock using SET NX EX
      const initialRecord = {
        status: "IN_PROGRESS",
        requestHash,
        createdAt: Date.now(),
      };

      const acquired = await redis.set(
        redisKey,
        JSON.stringify(initialRecord),
        "EX",
        lockTtlSeconds,
        "NX"
      );

      // 5. If key already exists, inspect existing status
      if (!acquired) {
        const cachedRaw = await redis.get(redisKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);

          // Check if payload matches original request
          if (cached.requestHash !== requestHash) {
            return res.status(409).json({
              error:
                "Idempotency conflict: Key was already used with a different request payload",
            });
          }

          // If still processing, return conflict to prevent concurrent duplicates
          if (cached.status === "IN_PROGRESS") {
            return res.status(409).json({
              error:
                "A request with this idempotency key is currently in progress. Please wait.",
            });
          }

          // If completed, return cached response
          if (cached.status === "COMPLETED") {
            res.setHeader("X-Cache-Lookup", "HIT - Idempotent");
            return res.status(cached.statusCode).json(cached.responseBody);
          }
        }
      }

      // 6. Hook response to capture result and update Redis state
      let intercepted = false;

      const saveCompletedResponse = async (body: any) => {
        if (intercepted) return;
        intercepted = true;

        const statusCode = res.statusCode || 200;

        // On 5xx server error, remove lock so user can retry
        if (statusCode >= 500) {
          try {
            await redis.del(redisKey);
          } catch (err) {
            console.error("Failed to delete failed idempotency key:", err);
          }
          return;
        }

        // Cache completed status and response
        try {
          let parsedBody = body;
          if (typeof body === "string") {
            try {
              parsedBody = JSON.parse(body);
            } catch {
              parsedBody = body;
            }
          }

          const completedRecord = {
            status: "COMPLETED",
            requestHash,
            statusCode,
            responseBody: parsedBody,
            completedAt: Date.now(),
          };

          await redis.set(
            redisKey,
            JSON.stringify(completedRecord),
            "EX",
            cacheTtlSeconds
          );
        } catch (err) {
          console.error("Failed to store completed idempotency state:", err);
        }
      };

      // Monkey-patch res.send
      const originalSend = res.send.bind(res);
      res.send = (body?: any): Response => {
        saveCompletedResponse(body);
        return originalSend(body);
      };

      // Monkey-patch res.json
      const originalJson = res.json.bind(res);
      res.json = (body?: any): Response => {
        saveCompletedResponse(body);
        return originalJson(body);
      };

      // Clean up on unexpected connection close / abort
      res.on("close", async () => {
        if (!intercepted && res.statusCode >= 500) {
          try {
            await redis.del(redisKey);
          } catch (_) {}
        }
      });

      return next();
    } catch (error) {
      console.error("Idempotency middleware error:", error);
      return next(); // Fail-open or continue to not block user if Redis is temporarily unreachable
    }
  };
};

