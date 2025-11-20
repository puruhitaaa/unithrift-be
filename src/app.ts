import createApp from "@/lib/create-app"
import index from "@/routes/index.route"
import auth from "@/routes/auth/auth.index"
import university from "@/routes/university.route"
import listing from "@/routes/listing.route"

const app = createApp()

const routes = [index, auth, university, listing] as const

routes.forEach((route) => {
  app.route("/", route)
})

export default app
