import { createRouter } from "@/lib/create-app"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createDb } from "@/db"
import { listing, listingMedia, user, university } from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { uploadToCloudinary } from "@/lib/cloudinary"
import apiCors from "@/middlewares/api-cors"

const router = createRouter()
router.use(apiCors)

// Validation schemas
const createListingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required"),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a valid positive number",
  }),
  condition: z.enum(["new", "like_new", "used_good", "used_fair"]),
  universityId: z.string().min(1, "University ID is required"),
  "media[]": z.instanceof(File).array().optional(),
})

const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  price: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0)
    .optional(),
  condition: z.enum(["new", "like_new", "used_good", "used_fair"]).optional(),
  status: z.enum(["active", "sold", "reserved", "deleted"]).optional(),
  "media[]": z.instanceof(File).array().optional(),
})

// GET /api/listings - List all listings with filters
router.get("/api/listings", async (c) => {
  const db = createDb(c.env)

  // Query parameters for filtering and pagination
  const {
    universityId,
    status = "active",
    condition,
    minPrice,
    maxPrice,
    limit = "20",
    offset = "0",
  } = c.req.query()

  // Build query conditions
  const conditions = []

  if (universityId) {
    conditions.push(eq(listing.universityId, universityId))
  }

  if (status) {
    conditions.push(eq(listing.status, status as any))
  }

  if (condition) {
    conditions.push(eq(listing.condition, condition as any))
  }

  if (minPrice) {
    conditions.push(sql`${listing.price} >= ${Number(minPrice)}`)
  }

  if (maxPrice) {
    conditions.push(sql`${listing.price} <= ${Number(maxPrice)}`)
  }

  // Execute query with pagination
  const listings = await db
    .select({
      listing,
      seller: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      university: {
        id: university.id,
        name: university.name,
        slug: university.slug,
      },
    })
    .from(listing)
    .leftJoin(user, eq(listing.sellerId, user.id))
    .leftJoin(university, eq(listing.universityId, university.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(listing.createdAt))
    .limit(Number(limit))
    .offset(Number(offset))

  // Get media for each listing
  const listingIds = listings.map((l) => l.listing.id)
  const media =
    listingIds.length > 0
      ? await db
          .select()
          .from(listingMedia)
          .where(sql`${listingMedia.listingId} IN ${listingIds}`)
          .orderBy(listingMedia.order)
      : []

  // Group media by listing ID
  const mediaByListing = media.reduce((acc, m) => {
    if (!acc[m.listingId]) acc[m.listingId] = []
    acc[m.listingId].push(m)
    return acc
  }, {} as Record<string, typeof media>)

  // Combine listings with their media
  const result = listings.map((l) => ({
    ...l.listing,
    seller: l.seller,
    university: l.university,
    media: mediaByListing[l.listing.id] || [],
  }))

  return c.json({ listings: result, count: result.length }, 200)
})

// GET /api/listings/:id - Get single listing by ID
router.get("/api/listings/:id", async (c) => {
  const db = createDb(c.env)
  const id = c.req.param("id")

  const result = await db
    .select({
      listing,
      seller: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        phoneNumber: user.phoneNumber,
        bio: user.bio,
      },
      university: {
        id: university.id,
        name: university.name,
        slug: university.slug,
        logo: university.logo,
      },
    })
    .from(listing)
    .leftJoin(user, eq(listing.sellerId, user.id))
    .leftJoin(university, eq(listing.universityId, university.id))
    .where(eq(listing.id, id))

  if (result.length === 0) {
    return c.json({ error: "Listing not found" }, 404)
  }

  // Get media for this listing
  const media = await db
    .select()
    .from(listingMedia)
    .where(eq(listingMedia.listingId, id))
    .orderBy(listingMedia.order)

  return c.json(
    {
      listing: {
        ...result[0].listing,
        seller: result[0].seller,
        university: result[0].university,
        media,
      },
    },
    200
  )
})

// POST /api/listings - Create new listing
router.post(
  "/api/listings",
  zValidator("form", createListingSchema),
  async (c) => {
    const db = createDb(c.env)
    const currentUser = c.get("user")

    // Check authentication
    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const formData = c.req.valid("form")
    const { title, description, price, condition, universityId } = formData
    const mediaFiles = formData["media[]"] || []

    // Verify university exists
    const uni = await db
      .select()
      .from(university)
      .where(eq(university.id, universityId))
    if (uni.length === 0) {
      return c.json({ error: "University not found" }, 404)
    }

    // Create listing
    const listingId = crypto.randomUUID()
    const now = new Date()

    const newListing = await db
      .insert(listing)
      .values({
        id: listingId,
        title,
        description,
        price: Number(price),
        condition,
        status: "active",
        sellerId: currentUser.id,
        universityId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // Upload media if provided
    const uploadedMedia = []
    if (mediaFiles.length > 0) {
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i]

        try {
          const uploadResult = await uploadToCloudinary(file, "listings", c.env)

          const mediaId = crypto.randomUUID()
          const mediaRecord = await db
            .insert(listingMedia)
            .values({
              id: mediaId,
              listingId,
              url: uploadResult.url,
              type: file.type.startsWith("video/") ? "video" : "image",
              order: i,
              createdAt: now,
            })
            .returning()

          uploadedMedia.push(mediaRecord[0])
        } catch (error) {
          console.error("Media upload error:", error)
          // Continue with other uploads even if one fails
        }
      }
    }

    return c.json(
      {
        listing: {
          ...newListing[0],
          media: uploadedMedia,
        },
      },
      201
    )
  }
)

// PUT /api/listings/:id - Update listing
router.put(
  "/api/listings/:id",
  zValidator("form", updateListingSchema),
  async (c) => {
    const db = createDb(c.env)
    const id = c.req.param("id")
    const currentUser = c.get("user")

    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Check if listing exists and user owns it
    const existing = await db.select().from(listing).where(eq(listing.id, id))
    if (existing.length === 0) {
      return c.json({ error: "Listing not found" }, 404)
    }

    if (existing[0].sellerId !== currentUser.id) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const formData = c.req.valid("form")
    const mediaFiles = formData["media[]"] || []

    // Update listing
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (formData.title) updateData.title = formData.title
    if (formData.description) updateData.description = formData.description
    if (formData.price) updateData.price = Number(formData.price)
    if (formData.condition) updateData.condition = formData.condition
    if (formData.status) updateData.status = formData.status

    const updated = await db
      .update(listing)
      .set(updateData)
      .where(eq(listing.id, id))
      .returning()

    // Upload new media if provided
    const uploadedMedia = []
    if (mediaFiles.length > 0) {
      // Get current media count for ordering
      const currentMedia = await db
        .select()
        .from(listingMedia)
        .where(eq(listingMedia.listingId, id))
      const startOrder = currentMedia.length

      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i]

        try {
          const uploadResult = await uploadToCloudinary(file, "listings", c.env)

          const mediaId = crypto.randomUUID()
          const mediaRecord = await db
            .insert(listingMedia)
            .values({
              id: mediaId,
              listingId: id,
              url: uploadResult.url,
              type: file.type.startsWith("video/") ? "video" : "image",
              order: startOrder + i,
              createdAt: new Date(),
            })
            .returning()

          uploadedMedia.push(mediaRecord[0])
        } catch (error) {
          console.error("Media upload error:", error)
        }
      }
    }

    // Get all media for this listing
    const allMedia = await db
      .select()
      .from(listingMedia)
      .where(eq(listingMedia.listingId, id))
      .orderBy(listingMedia.order)

    return c.json(
      {
        listing: {
          ...updated[0],
          media: allMedia,
        },
      },
      200
    )
  }
)

// DELETE /api/listings/:id - Delete listing
router.delete("/api/listings/:id", async (c) => {
  const db = createDb(c.env)
  const id = c.req.param("id")
  const currentUser = c.get("user")

  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  // Check if listing exists and user owns it
  const existing = await db.select().from(listing).where(eq(listing.id, id))
  if (existing.length === 0) {
    return c.json({ error: "Listing not found" }, 404)
  }

  if (existing[0].sellerId !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // Delete listing (media will cascade delete)
  await db.delete(listing).where(eq(listing.id, id))

  return c.json({ message: "Listing deleted successfully" }, 200)
})

// DELETE /api/listings/:listingId/media/:mediaId - Delete specific media
router.delete("/api/listings/:listingId/media/:mediaId", async (c) => {
  const db = createDb(c.env)
  const { listingId, mediaId } = c.req.param()
  const currentUser = c.get("user")

  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  // Verify listing ownership
  const listingRecord = await db
    .select()
    .from(listing)
    .where(eq(listing.id, listingId))
  if (listingRecord.length === 0) {
    return c.json({ error: "Listing not found" }, 404)
  }

  if (listingRecord[0].sellerId !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // Delete media
  const deleted = await db
    .delete(listingMedia)
    .where(
      and(eq(listingMedia.id, mediaId), eq(listingMedia.listingId, listingId))
    )
    .returning()

  if (deleted.length === 0) {
    return c.json({ error: "Media not found" }, 404)
  }

  return c.json({ message: "Media deleted successfully" }, 200)
})

export default router
