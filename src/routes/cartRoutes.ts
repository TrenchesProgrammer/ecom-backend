import express from 'express'
import { addToCart, getCart, updateCart } from '../controllers/cartController'
const router = express.Router()

router.get("/cart", getCart)
router.post("/cart", addToCart)
router.put("/cart", updateCart)

export default router