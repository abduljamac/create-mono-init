import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { router } from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", router);

app.use(errorHandler);

export { app };
