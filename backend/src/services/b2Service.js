import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import crypto from 'crypto'

// Backblaze B2 via its S3-compatible API. Images are optimised with sharp
// before upload; other files (video, pdf/docx) are stored as-is.
let _client = null
function client() {
  if (_client) return _client
  const endpoint = process.env.B2_ENDPOINT || ''
  _client = new S3Client({
    endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
    region: process.env.B2_REGION || 'us-east-005',
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY,
    },
    forcePathStyle: true,
  })
  return _client
}

export function b2Configured() {
  return !!(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET_NAME)
}

function publicUrl(key) {
  const base = (process.env.B2_PUBLIC_BASE
    || `https://${process.env.B2_BUCKET_NAME}.${process.env.B2_ENDPOINT}`).replace(/\/+$/, '')
  return `${base}/${key}`
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
