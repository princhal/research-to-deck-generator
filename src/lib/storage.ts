import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFile } from "node:fs/promises";

const DECK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY is not set");
    }
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set");
  return bucket;
}

/** Uploads a locally-generated deck to R2 and returns its object key.
 * The worker (Railway) and API (Vercel) don't share a filesystem, so the
 * deck has to live in object storage between "assembling" and download. */
export async function uploadDeck(jobId: string, localPath: string): Promise<string> {
  const key = `decks/${jobId}.pptx`;
  const body = await readFile(localPath);
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: DECK_CONTENT_TYPE,
    })
  );
  return key;
}

/** Signed, time-limited URL the download route redirects to. */
export async function getDeckDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: 300 }
  );
}
