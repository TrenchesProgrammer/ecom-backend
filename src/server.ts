import express from 'express';
// import userRoute from './routes/user.routes'
import productRoute from './routes/productRoutes'

const app = express()
const PORT = process.env.PORT || "4040"
app.listen(PORT, ()=>{
    console.log("Server is running on: ", PORT)
});
app.use(express.json())
// app.use("/user", userRoute)
app.use("/", productRoute)
export default app;

