import express from "express";
import {
  addToCart,
  checkout,
  getCart,
  updateCart,
} from "../controllers/cartController";
import { buyLimit } from "../middleware/buyLimit";
import { idempotency } from "../middleware/idempotency";

const router = express.Router();

router.get("/cart", buyLimit, getCart);
router.post("/cart", buyLimit, idempotency(), addToCart);
router.put("/cart", buyLimit, updateCart);
router.post("/checkout", buyLimit, idempotency(), checkout);

export default router;
