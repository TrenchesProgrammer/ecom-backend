import express from "express"
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from "../controllers/productController"
import { buyLimit } from "../middleware/buyLimit"

const router = express.Router()
router.get("/products",  buyLimit, getProducts)                
router.get("/products/:id",  buyLimit, getProductById)          
router.post("/products",  buyLimit, createProduct)             
router.put("/products/:id",  buyLimit, updateProduct)         
router.delete("/products/:id",  buyLimit, deleteProduct)

export default router;