import { cors } from "hono/cors"

export default cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://app.hughdev101.workers.dev",
  ],
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["POST", "GET", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
})
