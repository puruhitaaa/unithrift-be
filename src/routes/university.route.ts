import { createRouter } from "@/lib/create-app"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createDb } from "@/db"
import { university } from "@/db/schema"
import { eq } from "drizzle-orm"
import { uploadToCloudinary } from "@/lib/cloudinary"

const router = createRouter()

// Validation schemas
const createUniversitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  logo: z.instanceof(File).optional(),
})

const updateUniversitySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  logo: z.instanceof(File).optional(),
})

// GET /api/universities - List all universities
router.get("/api/universities", async (c) => {
  const db = createDb(c.env)

  const universities = await db.select().from(university)

  return c.json({ universities }, 200)
})

// GET /api/universities/:id - Get university by ID
router.get("/api/universities/:id", async (c) => {
  const db = createDb(c.env)
  const id = c.req.param("id")

  const result = await db.select().from(university).where(eq(university.id, id))

  if (result.length === 0) {
    return c.json({ error: "University not found" }, 404)
  }

  return c.json({ university: result[0] }, 200)
})

// POST /api/universities - Create new university
router.post(
  "/api/universities",
  zValidator("form", createUniversitySchema),
  async (c) => {
    const db = createDb(c.env)
    const { name, slug, logo } = c.req.valid("form")

    // Check if slug already exists
    const existing = await db
      .select()
      .from(university)
      .where(eq(university.slug, slug))
    if (existing.length > 0) {
      return c.json({ error: "Slug already exists" }, 400)
    }

    // Upload logo to Cloudinary if provided
    let logoUrl: string | null = null
    if (logo) {
      try {
        const uploadResult = await uploadToCloudinary(
          logo,
          "universities",
          c.env
        )
        logoUrl = uploadResult.url
      } catch (error) {
        console.error("Cloudinary upload error:", error)
        return c.json({ error: "Failed to upload logo" }, 500)
      }
    }

    // Generate unique ID
    const id = crypto.randomUUID()
    const now = new Date()

    // Insert university
    const newUniversity = await db
      .insert(university)
      .values({
        id,
        name,
        slug,
        logo: logoUrl,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return c.json({ university: newUniversity[0] }, 201)
  }
)

// PUT /api/universities/:id - Update university
router.put(
  "/api/universities/:id",
  zValidator("form", updateUniversitySchema),
  async (c) => {
    const db = createDb(c.env)
    const id = c.req.param("id")
    const data = c.req.valid("form")

    // Check if university exists
    const existing = await db
      .select()
      .from(university)
      .where(eq(university.id, id))
    if (existing.length === 0) {
      return c.json({ error: "University not found" }, 404)
    }

    // If slug is being updated, check if it's already taken
    if (data.slug && data.slug !== existing[0].slug) {
      const slugExists = await db
        .select()
        .from(university)
        .where(eq(university.slug, data.slug))
      if (slugExists.length > 0) {
        return c.json({ error: "Slug already exists" }, 400)
      }
    }

    // Upload new logo if provided
    let logoUrl: string | undefined = undefined
    if (data.logo) {
      try {
        const uploadResult = await uploadToCloudinary(
          data.logo,
          "universities",
          c.env
        )
        logoUrl = uploadResult.url
      } catch (error) {
        console.error("Cloudinary upload error:", error)
        return c.json({ error: "Failed to upload logo" }, 500)
      }
    }

    // Update university
    const updated = await db
      .update(university)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(logoUrl && { logo: logoUrl }),
        updatedAt: new Date(),
      })
      .where(eq(university.id, id))
      .returning()

    return c.json({ university: updated[0] }, 200)
  }
)

// DELETE /api/universities/:id - Delete university
router.delete("/api/universities/:id", async (c) => {
  const db = createDb(c.env)
  const id = c.req.param("id")

  // Check if university exists
  const existing = await db
    .select()
    .from(university)
    .where(eq(university.id, id))
  if (existing.length === 0) {
    return c.json({ error: "University not found" }, 404)
  }

  // Delete university
  await db.delete(university).where(eq(university.id, id))

  return c.json({ message: "University deleted successfully" }, 200)
})

export default router
