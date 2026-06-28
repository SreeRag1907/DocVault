import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * No hardcoded credentials - see backend/.env.example. In production
 * this picks up temporary credentials from the EC2 instance's IAM
 * role automatically.
 *
 * Modified to support S3_ENDPOINT for local development via MinIO.
 */
const s3Config: any = { region: process.env.AWS_REGION || "us-east-1" };

if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
  };
}

const s3 = new S3Client(s3Config);
const BUCKET = process.env.S3_BUCKET as string;

export async function createUploadUrl(originalFilename: string, contentType: string) {
  const extension = originalFilename.split(".").pop() || "bin";
  const key = `documents/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

/**
 * Documents are private by default - there is no public bucket policy.
 * Every "view" or "download" goes through a short-lived presigned GET
 * URL minted on demand, whether the request came from an authenticated
 * dashboard user or someone following a /share/:token link.
 */
export async function createDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Pulls the object fully into memory as a Buffer - used only for PDF
 * text extraction, where the backend needs the actual bytes rather
 * than just a link to hand to the browser. Fine for the PDF sizes a
 * personal document vault deals with; would need streaming/chunking
 * for a tool meant to handle very large files.
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  const stream = response.Body as NodeJS.ReadableStream;

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
