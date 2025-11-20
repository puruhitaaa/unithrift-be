# UniThrift Backend API

## 🎯 Project Overview

UniThrift is a secondhand/preloved items marketplace platform designed specifically for university students. Built with **Hono**, **Better Auth**, **Drizzle ORM**, and **Cloudflare Workers**, this backend provides a robust API for managing multi-university marketplace operations.

## 🛠 Tech Stack

- **Hono** v4.7.7 - Fast web framework for edge computing
- **Better Auth** v1.2.7 - Authentication with Google OAuth
- **Drizzle ORM** v0.43.0 - Type-safe database operations
- **PostgreSQL** - Primary database
- **Cloudinary** v2.8.0 - Media storage (images/videos)
- **Midtrans** v1.4.3 - Payment gateway integration
- **Cloudflare Workers** - Edge deployment platform
- **Bun** - JavaScript runtime
- **TypeScript** - Full type safety

## 🚀 Getting Started

### Prerequisites

- Bun installed
- PostgreSQL database (local or cloud like Neon)
- Cloudinary account
- Midtrans account (for payments)
- Google OAuth credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/puruhitaaa/unithrift-be.git
cd unithrift-be

# Install dependencies
bun install

# Setup environment
cp .env.example .env
cp .env.example .dev.vars
# Edit .env and .dev.vars with your credentials

# Start local database (optional)
bun run docker:up

# Push database schema
bun run db:push

# Start development server
bun run dev
```

Server will run on `http://localhost:3000`

## 📋 Environment Variables

```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Midtrans
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
MIDTRANS_IS_PRODUCTION=false
```

## 📚 API Documentation

Base URL: `http://localhost:3000`

### Authentication

All endpoints except auth routes require session cookies from Better Auth.

---

## 🔐 Auth Routes

### Google OAuth Login

**Endpoint:** `GET /api/auth/google/login`

Redirects to Google OAuth consent screen.

### Get Session

**Endpoint:** `GET /api/auth/get-session`

Returns current user session if authenticated.

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "image": "https://...",
    "universityId": "uni-uuid",
    "phoneNumber": "+62812345678",
    "bio": "Seller bio"
  },
  "session": {
    "id": "session-id",
    "token": "session-token",
    "expiresAt": "2025-12-20T12:00:00.000Z"
  }
}
```

### Logout

**Endpoint:** `POST /api/auth/logout`

Invalidates current session.

---

## 🏫 University Routes

### List All Universities

**Method:** `GET`  
**Endpoint:** `/api/universities`

**Response:**

```json
{
  "universities": [
    {
      "id": "uuid",
      "name": "University of Indonesia",
      "slug": "ui",
      "logo": "https://res.cloudinary.com/.../logo.png",
      "createdAt": "2025-11-20T12:00:00.000Z",
      "updatedAt": "2025-11-20T12:00:00.000Z"
    }
  ]
}
```

### Get University by ID

**Method:** `GET`  
**Endpoint:** `/api/universities/:id`

**Response:** Single university object or 404

### Create University

**Method:** `POST`  
**Endpoint:** `/api/universities`  
**Content-Type:** `multipart/form-data`

**Request Body:**

```typescript
{
  name: string         // Required, university name
  slug: string         // Required, URL-friendly (lowercase, alphanumeric, hyphens)
  logo?: File          // Optional, image file
}
```

**Response:**

```json
{
  "university": {
    "id": "generated-uuid",
    "name": "University of Indonesia",
    "slug": "ui",
    "logo": "https://res.cloudinary.com/.../logo.png",
    "createdAt": "2025-11-20T12:00:00.000Z",
    "updatedAt": "2025-11-20T12:00:00.000Z"
  }
}
```

### Update University

**Method:** `PUT`  
**Endpoint:** `/api/universities/:id`  
**Content-Type:** `multipart/form-data`

**Request Body:** (all optional)

```typescript
{
  name?: string
  slug?: string
  logo?: File
}
```

### Delete University

**Method:** `DELETE`  
**Endpoint:** `/api/universities/:id`

---

## 📦 Listing Routes

### List All Listings

**Method:** `GET`  
**Endpoint:** `/api/listings`

**Query Parameters:**

```typescript
{
  universityId?: string    // Filter by university
  status?: string          // active, sold, reserved, deleted (default: active)
  condition?: string       // new, like_new, used_good, used_fair
  minPrice?: number        // Minimum price in IDR
  maxPrice?: number        // Maximum price in IDR
  limit?: number           // Results per page (default: 20)
  offset?: number          // Pagination offset (default: 0)
}
```

**Response:**

```json
{
  "listings": [
    {
      "id": "uuid",
      "title": "iPhone 13 Pro",
      "description": "Great condition, barely used",
      "price": 8000000,
      "condition": "like_new",
      "status": "active",
      "sellerId": "user-uuid",
      "universityId": "uni-uuid",
      "createdAt": "2025-11-20T12:00:00.000Z",
      "updatedAt": "2025-11-20T12:00:00.000Z",
      "seller": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "image": "https://..."
      },
      "university": {
        "id": "uni-uuid",
        "name": "University of Indonesia",
        "slug": "ui"
      },
      "media": [
        {
          "id": "media-uuid",
          "url": "https://res.cloudinary.com/.../image.jpg",
          "type": "image",
          "order": 0,
          "createdAt": "2025-11-20T12:00:00.000Z"
        }
      ]
    }
  ],
  "count": 1
}
```

### Get Listing by ID

**Method:** `GET`  
**Endpoint:** `/api/listings/:id`

**Response:** Single listing with full seller and university details

### Create Listing

**Method:** `POST`  
**Endpoint:** `/api/listings`  
**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Request Body:**

```typescript
{
  title: string            // Required, max 200 chars
  description: string      // Required
  price: string            // Required, positive number as string (e.g., "8000000")
  condition: enum          // Required: "new", "like_new", "used_good", "used_fair"
  universityId: string     // Required, UUID of university
  "media[]"?: File[]       // Optional, array of image/video files
}
```

**Response:**

```json
{
  "listing": {
    "id": "new-uuid",
    "title": "iPhone 13 Pro",
    "description": "Great condition",
    "price": 8000000,
    "condition": "like_new",
    "status": "active",
    "sellerId": "current-user-id",
    "universityId": "uuid",
    "createdAt": "2025-11-20T12:00:00.000Z",
    "updatedAt": "2025-11-20T12:00:00.000Z",
    "media": [
      {
        "id": "media-uuid",
        "listingId": "new-uuid",
        "url": "https://res.cloudinary.com/.../photo.jpg",
        "type": "image",
        "order": 0,
        "createdAt": "2025-11-20T12:00:00.000Z"
      }
    ]
  }
}
```

### Update Listing

**Method:** `PUT`  
**Endpoint:** `/api/listings/:id`  
**Auth:** Required (must be owner)  
**Content-Type:** `multipart/form-data`

**Request Body:** (all optional)

```typescript
{
  title?: string
  description?: string
  price?: string
  condition?: enum       // "new", "like_new", "used_good", "used_fair"
  status?: enum          // "active", "sold", "reserved", "deleted"
  "media[]"?: File[]     // Additional media (appends to existing)
}
```

### Delete Listing

**Method:** `DELETE`  
**Endpoint:** `/api/listings/:id`  
**Auth:** Required (must be owner)

### Delete Specific Media

**Method:** `DELETE`  
**Endpoint:** `/api/listings/:listingId/media/:mediaId`  
**Auth:** Required (must be listing owner)

---

## 💳 Transaction Routes

### List User Transactions

**Method:** `GET`  
**Endpoint:** `/api/transactions`  
**Auth:** Required

**Query Parameters:**

```typescript
{
  type?: string    // "buy", "sell", or "all" (default: all)
}
```

**Response:**

```json
{
  "transactions": [
    {
      "transaction": {
        "id": "uuid",
        "listingId": "listing-uuid",
        "buyerId": "buyer-uuid",
        "sellerId": "seller-uuid",
        "amount": 8000000,
        "status": "pending",
        "paymentMethod": "midtrans",
        "paymentId": "midtrans-txn-id",
        "createdAt": "2025-11-20T12:00:00.000Z",
        "updatedAt": "2025-11-20T12:00:00.000Z"
      },
      "listing": {
        "id": "listing-uuid",
        "title": "iPhone 13 Pro",
        "price": 8000000
      },
      "buyer": {...},
      "seller": {...}
    }
  ]
}
```

### Get Transaction by ID

**Method:** `GET`  
**Endpoint:** `/api/transactions/:id`  
**Auth:** Required (must be buyer or seller)

### Create Transaction

**Method:** `POST`  
**Endpoint:** `/api/transactions`  
**Auth:** Required  
**Content-Type:** `application/json`

**Request Body:**

```typescript
{
  listingId: string           // Required, UUID of listing
  paymentMethod: enum         // Required: "midtrans" or "direct"
}
```

**Response (Midtrans):**

```json
{
  "transaction": {
    "id": "txn-uuid",
    "listingId": "listing-uuid",
    "buyerId": "current-user-id",
    "sellerId": "seller-uuid",
    "amount": 8000000,
    "status": "pending",
    "paymentMethod": "midtrans",
    "createdAt": "2025-11-20T12:00:00.000Z"
  },
  "snapToken": "xxx-xxx-xxx", // Use this for Snap popup
  "snapRedirectUrl": "https://..."
}
```

**Frontend Integration (Midtrans):**

```html
<script
  src="https://app.sandbox.midtrans.com/snap/snap.js"
  data-client-key="YOUR_MIDTRANS_CLIENT_KEY"
></script>

<script>
  function handlePayment(snapToken) {
    snap.pay(snapToken, {
      onSuccess: function (result) {
        console.log("Payment success", result)
      },
      onPending: function (result) {
        console.log("Payment pending", result)
      },
      onError: function (result) {
        console.log("Payment error", result)
      },
    })
  }
</script>
```

### Midtrans Webhook

**Method:** `POST`  
**Endpoint:** `/api/transactions/midtrans/notification`

**Note:** This is called by Midtrans automatically. Do not call from frontend.

### Update Transaction Status

**Method:** `PUT`  
**Endpoint:** `/api/transactions/:id/status`  
**Auth:** Required (buyer can cancel, seller can complete)  
**Content-Type:** `application/json`

**Request Body:**

```typescript
{
  status: enum    // "pending", "paid", "failed", "completed", "cancelled"
}
```

**Authorization Rules:**

- Only **seller** can mark as `"completed"`
- Only **buyer** can mark as `"cancelled"`

---

## 📊 Data Type Reference

### Enums

```typescript
// Listing Condition
type ListingCondition = "new" | "like_new" | "used_good" | "used_fair"

// Listing Status
type ListingStatus = "active" | "sold" | "reserved" | "deleted"

// Payment Method
type PaymentMethod = "midtrans" | "direct"

// Transaction Status
type TransactionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "completed"
  | "cancelled"
```

### Database Schema

```typescript
interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string
  universityId?: string
  phoneNumber?: string
  bio?: string
  createdAt: Date
  updatedAt: Date
}

interface University {
  id: string
  name: string
  slug: string
  logo?: string
  createdAt: Date
  updatedAt: Date
}

interface Listing {
  id: string
  title: string
  description: string
  price: number
  condition: ListingCondition
  status: ListingStatus
  sellerId: string
  universityId: string
  createdAt: Date
  updatedAt: Date
}

interface ListingMedia {
  id: string
  listingId: string
  url: string
  type: string
  order: number
  createdAt: Date
}

interface Transaction {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  status: TransactionStatus
  paymentMethod: PaymentMethod
  paymentId?: string
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔒 Error Response Format

All errors follow this structure:

```json
{
  "error": "Error message"
}
```

Common HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized for this resource)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🚀 Deployment

### Cloudflare Workers

```bash
# Deploy to production
bun run deploy

# The API will be available at your Cloudflare Workers URL
```

### Environment Setup for Production

1. Set environment variables in Cloudflare Workers dashboard
2. Update `MIDTRANS_IS_PRODUCTION=true` for production
3. Update `BETTER_AUTH_URL` to your production URL
4. Use production Midtrans keys

---

## 📝 Notes for Frontend Integration

1. **Authentication:**

   - Use Better Auth session cookies (automatically handled by `credentials: 'include'`)
   - Check `/api/auth/get-session` to verify authentication

2. **File Uploads:**

   - Use `FormData` for multipart requests
   - Append files with `formData.append('media[]', file)`

3. **Midtrans Integration:**

   - Include Snap.js in your HTML
   - Use `snapToken` from create transaction response
   - Call `snap.pay(snapToken, callbacks)`

4. **Pagination:**

   - Use `limit` and `offset` query params
   - Default limit is 20

5. **Price Format:**
   - Always send price as string for validation
   - Backend converts to integer
   - Prices are in Indonesian Rupiah (IDR)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Credits

This project was built using the [Better-Hono](https://github.com/alwaysnomads/better-hono) template by [@alwaysnomads](https://github.com/alwaysnomads).

---

**Happy Coding! 🚀**
