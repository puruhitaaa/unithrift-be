import { createRouter } from "@/lib/create-app"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createDb } from "@/db"
import { transaction, listing, user } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { createSnapToken, handleMidtransNotification } from "@/lib/midtrans"

const router = createRouter()

// Validation schemas
const createTransactionSchema = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
  paymentMethod: z.enum(["midtrans", "direct"]),
})

const updateTransactionStatusSchema = z.object({
  status: z.enum(["pending", "paid", "failed", "completed", "cancelled"]),
})

// GET /api/transactions - Get user's transactions (as buyer or seller)
router.get("/api/transactions", async (c) => {
  const db = createDb(c.env)
  const currentUser = c.get("user")

  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { type = "all" } = c.req.query() // 'buy', 'sell', or 'all'

  let conditions = []

  if (type === "buy") {
    conditions.push(eq(transaction.buyerId, currentUser.id))
  } else if (type === "sell") {
    conditions.push(eq(transaction.sellerId, currentUser.id))
  } else {
    // Get both buy and sell transactions
    const buyTransactions = await db
      .select({
        transaction,
        listing: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
        },
        buyer: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        seller: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(transaction)
      .leftJoin(listing, eq(transaction.listingId, listing.id))
      .leftJoin(user, eq(transaction.buyerId, user.id))
      .where(eq(transaction.buyerId, currentUser.id))
      .orderBy(desc(transaction.createdAt))

    const sellTransactions = await db
      .select({
        transaction,
        listing: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
        },
        buyer: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        seller: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(transaction)
      .leftJoin(listing, eq(transaction.listingId, listing.id))
      .leftJoin(user, eq(transaction.sellerId, user.id))
      .where(eq(transaction.sellerId, currentUser.id))
      .orderBy(desc(transaction.createdAt))

    const allTransactions = [...buyTransactions, ...sellTransactions].sort(
      (a, b) =>
        b.transaction.createdAt.getTime() - a.transaction.createdAt.getTime()
    )

    return c.json({ transactions: allTransactions }, 200)
  }

  // Get filtered transactions
  const transactions = await db
    .select({
      transaction,
      listing: {
        id: listing.id,
        title: listing.title,
        price: listing.price,
      },
      buyer: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      seller: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(transaction)
    .leftJoin(listing, eq(transaction.listingId, listing.id))
    .leftJoin(
      user,
      type === "buy"
        ? eq(transaction.buyerId, user.id)
        : eq(transaction.sellerId, user.id)
    )
    .where(and(...conditions))
    .orderBy(desc(transaction.createdAt))

  return c.json({ transactions }, 200)
})

// GET /api/transactions/:id - Get single transaction
router.get("/api/transactions/:id", async (c) => {
  const db = createDb(c.env)
  const currentUser = c.get("user")
  const id = c.req.param("id")

  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const result = await db
    .select({
      transaction,
      listing: {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        condition: listing.condition,
      },
      buyer: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
      seller: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    })
    .from(transaction)
    .leftJoin(listing, eq(transaction.listingId, listing.id))
    .leftJoin(user, eq(transaction.buyerId, user.id))
    .where(eq(transaction.id, id))

  if (result.length === 0) {
    return c.json({ error: "Transaction not found" }, 404)
  }

  const txn = result[0]

  // Verify user is either buyer or seller
  if (
    txn.transaction.buyerId !== currentUser.id &&
    txn.transaction.sellerId !== currentUser.id
  ) {
    return c.json({ error: "Forbidden" }, 403)
  }

  return c.json({ transaction: txn }, 200)
})

// POST /api/transactions - Create transaction and get Snap token (for Midtrans)
router.post(
  "/api/transactions",
  zValidator("json", createTransactionSchema),
  async (c) => {
    const db = createDb(c.env)
    const currentUser = c.get("user")

    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const { listingId, paymentMethod } = c.req.valid("json")

    // Get listing details
    const listingResult = await db
      .select({
        listing,
        seller: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(listing)
      .leftJoin(user, eq(listing.sellerId, user.id))
      .where(eq(listing.id, listingId))

    if (listingResult.length === 0) {
      return c.json({ error: "Listing not found" }, 404)
    }

    const { listing: listingData, seller } = listingResult[0]

    // Check if listing is still available
    if (listingData.status !== "active") {
      return c.json({ error: "Listing is not available" }, 400)
    }

    // Prevent buying own listing
    if (listingData.sellerId === currentUser.id) {
      return c.json({ error: "Cannot buy your own listing" }, 400)
    }

    // Create transaction
    const transactionId = crypto.randomUUID()
    const now = new Date()

    const newTransaction = await db
      .insert(transaction)
      .values({
        id: transactionId,
        listingId,
        buyerId: currentUser.id,
        sellerId: listingData.sellerId,
        amount: listingData.price,
        status: "pending",
        paymentMethod,
        paymentId: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // If Midtrans, create Snap token
    if (paymentMethod === "midtrans") {
      try {
        const snapData = await createSnapToken(
          {
            orderId: transactionId,
            grossAmount: listingData.price,
            customerDetails: {
              firstName: currentUser.name,
              email: currentUser.email,
              phone: currentUser.phoneNumber || undefined,
            },
            itemDetails: [
              {
                id: listingId,
                price: listingData.price,
                quantity: 1,
                name: listingData.title,
              },
            ],
          },
          c.env
        )

        return c.json(
          {
            transaction: newTransaction[0],
            snapToken: snapData.token,
            snapRedirectUrl: snapData.redirectUrl,
          },
          201
        )
      } catch (error) {
        console.error("Midtrans error:", error)
        // Delete transaction if Snap token creation fails
        await db.delete(transaction).where(eq(transaction.id, transactionId))
        return c.json({ error: "Failed to create payment" }, 500)
      }
    }

    // For COD or direct payment
    return c.json({ transaction: newTransaction[0] }, 201)
  }
)

// POST /api/transactions/midtrans/notification - Midtrans webhook
router.post("/api/transactions/midtrans/notification", async (c) => {
  const db = createDb(c.env)
  const notificationJson = await c.req.json()

  try {
    const notification = await handleMidtransNotification(
      notificationJson,
      c.env
    )

    const orderId = notification.orderId
    const transactionStatus = notification.transactionStatus
    const fraudStatus = notification.fraudStatus

    console.log(
      `Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`
    )

    // Update transaction based on status
    let newStatus: "pending" | "paid" | "failed" | "completed" | "cancelled" =
      "pending"

    if (transactionStatus === "capture") {
      if (fraudStatus === "accept") {
        newStatus = "paid"
      } else if (fraudStatus === "challenge") {
        newStatus = "pending" // Keep pending for manual review
      }
    } else if (transactionStatus === "settlement") {
      newStatus = "paid"
    } else if (
      transactionStatus === "cancel" ||
      transactionStatus === "expire"
    ) {
      newStatus = "cancelled"
    } else if (transactionStatus === "deny") {
      newStatus = "failed"
    } else if (transactionStatus === "pending") {
      newStatus = "pending"
    }

    // Update transaction in database
    await db
      .update(transaction)
      .set({
        status: newStatus,
        paymentId: notification.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, orderId))

    // If paid, mark listing as reserved
    if (newStatus === "paid") {
      const txn = await db
        .select()
        .from(transaction)
        .where(eq(transaction.id, orderId))
      if (txn.length > 0) {
        await db
          .update(listing)
          .set({
            status: "reserved",
            updatedAt: new Date(),
          })
          .where(eq(listing.id, txn[0].listingId))
      }
    }

    return c.json({ message: "Notification processed" }, 200)
  } catch (error) {
    console.error("Notification processing error:", error)
    return c.json({ error: "Failed to process notification" }, 500)
  }
})

// PUT /api/transactions/:id/status - Update transaction status (for COD/direct)
router.put(
  "/api/transactions/:id/status",
  zValidator("json", updateTransactionStatusSchema),
  async (c) => {
    const db = createDb(c.env)
    const currentUser = c.get("user")
    const id = c.req.param("id")

    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const { status } = c.req.valid("json")

    // Get transaction
    const txn = await db
      .select()
      .from(transaction)
      .where(eq(transaction.id, id))

    if (txn.length === 0) {
      return c.json({ error: "Transaction not found" }, 404)
    }

    // Only seller can mark as completed, buyer can cancel
    if (status === "completed" && txn[0].sellerId !== currentUser.id) {
      return c.json(
        { error: "Only seller can mark transaction as completed" },
        403
      )
    }

    if (status === "cancelled" && txn[0].buyerId !== currentUser.id) {
      return c.json({ error: "Only buyer can cancel transaction" }, 403)
    }

    // Update status
    const updated = await db
      .update(transaction)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, id))
      .returning()

    // Update listing status based on transaction status
    if (status === "completed") {
      await db
        .update(listing)
        .set({
          status: "sold",
          updatedAt: new Date(),
        })
        .where(eq(listing.id, txn[0].listingId))
    } else if (status === "cancelled") {
      await db
        .update(listing)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(listing.id, txn[0].listingId))
    }

    return c.json({ transaction: updated[0] }, 200)
  }
)

export default router
