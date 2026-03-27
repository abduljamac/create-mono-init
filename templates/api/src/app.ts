import cors from "cors";
import express from "express";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", router);

app.use(errorHandler);

export { app };
