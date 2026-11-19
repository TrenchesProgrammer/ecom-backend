import "dotenv/config";
import express from "express";
import productRoute from "./routes/productRoutes";
import cartRoute from "./routes/cartRoutes";

const app = express();
const PORT = process.env.PORT || "4040";

app.use(express.json());

// Routes
app.use("/", productRoute);
app.use("/", cartRoute);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("Server is running on: ", PORT);
  });
}

export default app;
