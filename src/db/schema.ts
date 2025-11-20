import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core"

export const listingConditionEnum = pgEnum("listing_condition", [
  "new",
  "like_new",
  "used_good",
  "used_fair",
])
export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "sold",
  "reserved",
  "deleted",
])
export const paymentMethodEnum = pgEnum("payment_method", [
  "midtrans",
  "direct",
])
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "paid",
  "failed",
  "completed",
  "cancelled",
])

export const university = pgTable("university", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  universityId: text("university_id").references(() => university.id),
  phoneNumber: text("phone_number"),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})

export const listing = pgTable("listing", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  condition: listingConditionEnum("condition").notNull(),
  status: listingStatusEnum("status").default("active").notNull(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  universityId: text("university_id")
    .notNull()
    .references(() => university.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const listingMedia = pgTable("listing_media", {
  id: text("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listing.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  type: text("type").notNull(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").notNull(),
})

export const transaction = pgTable("transaction", {
  id: text("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listing.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => user.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => user.id),
  amount: integer("amount").notNull(),
  status: transactionStatusEnum("status").default("pending").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})
