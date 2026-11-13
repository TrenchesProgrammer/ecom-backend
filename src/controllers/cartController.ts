import { Request, Response } from "express";
import { prisma } from "../config/db";

export const getCart = async (req: Request, res: Response) => {
  const { userToken } = req.body;

  const cart = await prisma.cartItem.findMany({
    where: {
      cart: {
        sessionId: userToken,
      },
    },
  });

  return res.json(cart);
};
export const addToCart = async (req: Request, res: Response) => {
  const { productId, quantity, userToken } = req.body;

  const userCart = await prisma.cart.upsert({
    where: { sessionId: userToken },
    update: {},
    create: { sessionId: userToken },
  });
  const cartItem = await prisma.cartItem.create({
    data: {
      cartId: userCart.id,
      productId: productId,
      quantity,
    },
  });
  return res.status(200).json({
    success: true,
    data: {
      cartItem,
    },
  });
};
export const updateCart = async (req:Request, res:Response) => {
  const { productId, quantity, userToken } = req.body;

  
};
export const checkout = async (req: Request, res: Response) => {
  const { userToken, email } = req.body;

  // 1. Fetch EVERYTHING in one single query (Cart, Items, and Products)
  const cart = await prisma.cart.findUnique({
    where: { sessionId: userToken },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  let totalAmount: number = 0;

  // 2. Validate stock and calculate total entirely in memory (no DB calls)
  for (const item of cart.items) {
    if (item.product.stockQuantity < item.quantity) {
      return res.status(400).json({ 
        error: `Not enough stock for ${item.product.name}. Only ${item.product.stockQuantity} left.` 
      });
    }
    const amount = Number(item.product.price) * item.quantity;
    totalAmount += amount;
  }

  try {
    const finalOrder = await prisma.$transaction(async (tx) => {
      // 3. Create the Order
      const order = await tx.order.create({
        data: {
          sessionId: userToken,
          guestEmail: email,
          status: "PENDING",
          totalAmount,
        },
      });

      // 4. Map the items we already fetched into OrderItems
      const orderItemsData = cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.product.price,
      }));

      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      // 5. Deduct the inventory
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
      }

      // 6. Delete the Cart (which cascades and deletes all CartItems)
      await tx.cart.delete({
        where: { id: cart.id },
      });

      return order;
    });

    res.status(200).json({
      success:"true",
      orderid: finalOrder.id,
      order: finalOrder,
    });
  } catch (error) {
    console.error("Checkout failed:", error);
    res.status(500).json({ error: "Checkout processing failed" });
  }
};