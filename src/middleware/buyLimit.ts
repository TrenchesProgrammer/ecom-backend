import { rateLimit } from "express-rate-limit";

export const buyLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many requests! Slow down, nigga." },
});


