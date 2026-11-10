import express from 'express'

const router = express.Router()

router.get("/cart", getCart)
router.post("/cart", addToCart)
router.put("/cart", updateCart)

export default router