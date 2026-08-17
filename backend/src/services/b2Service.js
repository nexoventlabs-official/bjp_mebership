import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import crypto from 'crypto'

// Backblaze B2 via its S3-compatible API. Images are optimised with sharp
// before upload; other files (video, pdf/docx) are stored as-is.
let _client = null
function client() {
  if (_client) return _client
  const endpoint = process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com'
  const keyId = process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID || ''
  const appKey = process.env.B2_APP_KEY || process.env.B2_APPLICATION_KEY || ''
  _client = new S3Client({
    endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
    region: process.env.B2_REGION || 'us-east-005',
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: appKey,
    },
    forcePathStyle: true,
  })
  return _client
}

export function b2Configured() {
  const keyId = process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID || ''
  const appKey = process.env.B2_APP_KEY || process.env.B2_APPLICATION_KEY || ''
  const bucketName = process.env.B2_BUCKET_NAME || ''
  return !!(keyId && appKey && bucketName)
}

function publicUrl(key) {
  if (process.env.B2_PUBLIC_BASE) {
    const base = process.env.B2_PUBLIC_BASE.replace(/\/+$/, '')
    return `${base}/${key}`
  }
  return `/api/media/${key}`
}

const rand = () => crypto.randomBytes(6).toString('hex')
const extFromName = (name = '') => {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]{1,5})$/)
  return m ? m[1] : ''
}

// Upload a single file buffer. Images are resized/compressed to JPEG.
// Returns { url, key, contentType, bytes }.
export async function uploadMedia({ buffer, originalName, mimeType, folder = 'uploads' }) {
  if (!b2Configured()) throw new Error('B2_NOT_CONFIGURED')
  const isImage = (mimeType || '').startsWith('image/')

  let outBuffer = buffer
  let contentType = mimeType || 'application/octet-stream'
  let ext = extFromName(originalName) || 'bin'

  if (isImage) {
    // Downscale large photos and normalise to JPEG (keeps files small/consistent).
    outBuffer = await sharp(buffer)
      .rotate() // respect EXIF orientation
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    contentType = 'image/jpeg'
    ext = 'jpg'
  }

  const key = `${folder}/${Date.now()}-${rand()}.${ext}`
  await client().send(new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    Body: outBuffer,
    ContentType: contentType,
  }))

  return { url: publicUrl(key), key, contentType, bytes: outBuffer.length }
}

// Fetch a stored object for streaming back through our own domain (so the
// bucket can stay private — no public-bucket requirement). Forwards an optional
// HTTP Range header so browsers can seek within videos.
export async function getMedia(key, range) {
  if (!b2Configured()) throw new Error('B2_NOT_CONFIGURED')
  const out = await client().send(new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    Range: range || undefined,
  }))
  return {
    body: out.Body, // Node.js Readable stream
    contentType: out.ContentType || 'application/octet-stream',
    contentLength: out.ContentLength,
    contentRange: out.ContentRange,
    acceptRanges: out.AcceptRanges,
    lastModified: out.LastModified,
    etag: out.ETag,
  }
}
