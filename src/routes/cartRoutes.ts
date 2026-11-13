import express from 'express'
import { addToCart, checkout, getCart, updateCart } from '../controllers/cartController'
const router = express.Router()

router.get("/cart", getCart)
router.post("/cart", addToCart)
router.put("/cart", updateCart)
router.post("/checkout", checkout)

export default router