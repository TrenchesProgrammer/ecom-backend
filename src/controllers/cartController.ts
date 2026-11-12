import {Request, Response} from 'express'
import { prisma } from '../config/db'

export const getCart = async (req:Request, res:Response) =>{
    const {userToken} = req.body

    const cart = await prisma.cartItem.findMany({
        where: {
            cart: {
                sessionId: userToken
            }
        }
    })

    return res.json(cart)
}
export const addToCart = async () =>{

}
export const updateCart = async () =>{

}