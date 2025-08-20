import express from "express";
import cors from "cors";
import router from "./routes.js";

const app = express();

// JSON
app.use(express.json());

// CORS — ajustá la lista a tus orígenes reales
const allowed = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "https://tu-frontend.vercel.app",
];
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
// Preflight (por si algún proxy lo requiere)
app.options("*", cors());

// Rutas
app.use(router);

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

export default app; 