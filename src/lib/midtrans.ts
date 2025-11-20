import midtransClient from "midtrans-client"
import { Environment } from "@/env"

// Type augmentation for midtrans-client
interface MidtransTransaction {
  notification(notificationJson: any): Promise<any>
  status(transactionId: string): Promise<any>
}

interface MidtransSnap {
  createTransaction(parameter: any): Promise<any>
  transaction: MidtransTransaction
}

export function createMidtransSnap(env: Environment): MidtransSnap {
  return new midtransClient.Snap({
    isProduction: env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: env.MIDTRANS_SERVER_KEY,
    clientKey: env.MIDTRANS_CLIENT_KEY,
  }) as any
}

export interface MidtransTransactionParams {
  orderId: string
  grossAmount: number
  customerDetails: {
    firstName: string
    email: string
    phone?: string
  }
  itemDetails: Array<{
    id: string
    price: number
    quantity: number
    name: string
  }>
}

export async function createSnapToken(
  params: MidtransTransactionParams,
  env: Environment
): Promise<{ token: string; redirectUrl: string }> {
  const snap = createMidtransSnap(env)

  const parameter = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerDetails.firstName,
      email: params.customerDetails.email,
      phone: params.customerDetails.phone,
    },
    item_details: params.itemDetails.map((item) => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity,
      name: item.name,
    })),
  }

  const transaction = await snap.createTransaction(parameter)

  return {
    token: transaction.token,
    redirectUrl: transaction.redirect_url,
  }
}

export interface MidtransNotification {
  orderId: string
  transactionStatus:
    | "capture"
    | "settlement"
    | "pending"
    | "deny"
    | "cancel"
    | "expire"
  fraudStatus: "accept" | "challenge" | "deny"
  transactionId: string
  paymentType: string
  grossAmount: string
}

export async function handleMidtransNotification(
  notificationJson: any,
  env: Environment
): Promise<MidtransNotification> {
  const snap = createMidtransSnap(env)

  const statusResponse = await snap.transaction.notification(notificationJson)

  return {
    orderId: statusResponse.order_id,
    transactionStatus: statusResponse.transaction_status,
    fraudStatus: statusResponse.fraud_status,
    transactionId: statusResponse.transaction_id,
    paymentType: statusResponse.payment_type,
    grossAmount: statusResponse.gross_amount,
  }
}
