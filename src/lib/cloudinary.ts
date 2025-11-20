import { v2 as cloudinary } from "cloudinary"
import { Environment } from "@/env"

export function configureCloudinary(env: Environment) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })

  return cloudinary
}

export async function uploadToCloudinary(
  file: File,
  folder: string,
  env: Environment
): Promise<{ url: string; publicId: string }> {
  const cloudinary = configureCloudinary(env)

  // Convert File to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) {
            reject(error)
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            })
          } else {
            reject(new Error("Upload failed: no result"))
          }
        }
      )
      .end(buffer)
  })
}
