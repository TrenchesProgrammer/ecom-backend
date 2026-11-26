import "dotenv/config";
import express from "express";
import productRoute from "./routes/productRoutes";
import cartRoute from "./routes/cartRoutes";

// Load the CommonJS package without an ES module declaration.
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || "4040";
const corsOptions = {
  origin: 'https://audiophile-ecom-six.vercel.app', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Required if sending cookies or authorization headers
};

app.use(cors(corsOptions));
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
