import express from 'express'
import { addToCart, checkout, getCart, updateCart } from '../controllers/cartController'
import { buyLimit } from '../middleware/buyLimit'
const router = express.Router()

router.get("/cart", buyLimit, getCart)
router.post("/cart",  buyLimit, addToCart)
router.put("/cart",  buyLimit, updateCart)
router.post("/checkout",  buyLimit, checkout)

export default router