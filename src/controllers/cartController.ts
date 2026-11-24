import { Request, Response } from "express";
import { prisma } from "../config/db";

export const getCart = async (req: Request, res: Response) => {
  const userToken  = req.get('user-token');

  if (!userToken) {
    return res.status(400).json({ error: "userToken is required" });
  }

  try {
    const cart = await prisma.cartItem.findMany({
      where: {
        cart: {
          sessionId: userToken,
        },
      },
      include: { product: true },
    });

    return res.json(cart);
  } catch (error) {
    console.error("Get cart failed:", error);
    return res.status(500).json({ error: "Failed to fetch cart" });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  const { productId, quantity} = req.body;
  const userToken  = req.get('user-token');

  if (!productId || typeof quantity !== "number" || quantity <= 0 || !userToken) {
    return res.status(400).json({
      error: "productId, valid positive quantity, and userToken are required",
    });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const userCart = await prisma.cart.upsert({
      where: { sessionId: userToken },
      update: {},
      create: { sessionId: userToken },
    });

    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: userCart.id,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
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
  } catch (error) {
    console.error("Add to cart failed:", error);
    return res.status(500).json({ error: "Failed to add item to cart" });
  }
};

export const updateCart = async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  const userToken  = req.get('user-token');

  if (!productId || typeof quantity !== "number" || !userToken) {
    return res.status(400).json({
      error: "productId, quantity, and userToken are required",
    });
  }

  try {
    // 1. Find parent Cart using session token
    const cart = await prisma.cart.findUnique({
      where: { sessionId: userToken },
    });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // 2. The Zero-Quantity Check (Delete the item)
    if (quantity <= 0) {
      await prisma.cartItem.delete({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: productId,
          },
        },
      });
      return res.status(200).json({ success: true, message: "Item removed" });
    }

    // 3. Update to the exact new quantity
    const updatedItem = await prisma.cartItem.update({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: productId,
        },
      },
      data: {
        quantity: quantity,
      },
    });

    return res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    console.error("Cart update failed:", error);
    return res.status(500).json({ error: "Failed to update cart item" });
  }
};

export const checkout = async (req: Request, res: Response) => {
  const { email } = req.body;
  const userToken  = req.get('user-token');

  if (!userToken || !email) {
    return res.status(400).json({ error: "userToken and email are required" });
  }

  try {
    const finalOrder = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch the cart inside transaction
      const cart = await tx.cart.findUnique({
        where: { sessionId: userToken },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new Error("CART_EMPTY");
      }

      // 2. Sort product IDs alphabetically to eliminate PostgreSQL deadlocks
      const sortedProductIds = Array.from(
        new Set(cart.items.map((item: any) => item.productId))
      ).sort();

      // 3. Atomically lock product rows with SELECT ... FOR UPDATE in sorted order
      interface LockedProductRow {
        id: string;
        name: string;
        price: any;
        stockQuantity: number;
      }

      const lockedProducts = await tx.$queryRaw<LockedProductRow[]>`
        SELECT "id", "name", "price", "stockQuantity"
        FROM "Product"
        WHERE "id" = ANY(${sortedProductIds})
        ORDER BY "id" ASC
        FOR UPDATE
      `;

      const productMap = new Map<string, LockedProductRow>(
        lockedProducts.map((p: LockedProductRow) => [p.id, p])
      );

      // 4. Validate stock against the locked records and calculate total
      let totalAmount = 0;

      for (const item of cart.items as any[]) {
        const product = productMap.get(item.productId);

        if (!product || product.stockQuantity < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:${product ? product.name : item.product.name}:${product ? product.stockQuantity : 0}`
          );
        }

        totalAmount += Number(product.price) * item.quantity;
      }

      // 5. Create Order
      const order = await tx.order.create({
        data: {
          sessionId: userToken,
          guestEmail: email,
          status: "PENDING",
          totalAmount,
        },
      });

      // 6. Map and insert OrderItems
      const orderItemsData = cart.items.map((item: any) => {
        const product = productMap.get(item.productId);
        return {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: product ? product.price : item.product.price,
        };
      });

      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      // 7. Deduct inventory atomically
      for (const item of cart.items as any[]) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
      }

      // 8. Delete the Cart
      await tx.cart.delete({
        where: { id: cart.id },
      });

      return order;
    });

    return res.status(200).json({
      success: true,
      orderid: finalOrder.id,
      order: finalOrder,
    });
  } catch (error) {
    console.error("Checkout failed:", error);

    if (error instanceof Error) {
      if (error.message === "CART_EMPTY") {
        return res.status(400).json({ error: "Cart is empty" });
      }
      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const [, productName, stockQuantity] = error.message.split(":");
        return res.status(400).json({
          error: `Not enough stock for ${productName}. Only ${stockQuantity} left.`,
        });
      }
    }

    return res.status(500).json({ error: "Checkout processing failed" });
  }
};
