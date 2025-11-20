import { cors } from "hono/cors"

export default cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  // credentials should be false for wildcard origin
  credentials: false,
})
