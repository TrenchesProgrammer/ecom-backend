    import { Request, Response } from "express";
    import { prisma } from "../config/db";
    export const getProducts = async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany();
        return res.json(products);
    } catch (error) {
        return res.status(400).json({
        error: "failed to fetch products",
        });
    }
    };

    export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid product id" });
    }
    try {
        const product = await prisma.product.findUnique({
        where: { id: id },
        });
        if (!product) {
        return res.status(404).json({
            error:"Product not found!"
        });
        }
        return res.json(product);
    } catch (error) {
        return res.status(400).json({
        error: "failed to fetch products",
        });
    }
    };

    export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, price, stockQuantity } = req.body;

        if (!name || !price || !stockQuantity) {
        return res.status(400).json({error:"Missing required details"});
        }
        const newProduct = await prisma.product.create({
        data: { name, price, stockQuantity },
        });
        return res.status(201).json(newProduct);
    } catch (error) {
        return res.status(400).json({
            message:"Unable to create product"
        })
    }
    };

    export const updateProduct = async (req:Request, res:Response) => {
        try {
            const {id} = req.params
            if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid product id" });
    }
            const {name, stockQuantity, price} = req.body

            const updatedData = await prisma.product.update({
                where:{id:id},
                data:{name, stockQuantity, price}
            })
            res.status(200).json({
                message:"Success! Data updated",
                data:updatedData
            })
            return res.status(200).json({
                message:"Updated product successfully"
            })
        } catch (error) {
            return res.status(400).json({
                error:"Unable to update product"
            })
        }
    };

    export const deleteProduct = () => {};
