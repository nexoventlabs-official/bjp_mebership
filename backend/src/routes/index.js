import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import {
  postSendOtp, postVerifyOtp, postLookupVoter,
  postSubmitApplication, getApplication,
  postUploadMedia, postOrganiserMessage, getMediaProxy,
} from '../controllers/chatController.js'

const router = Router()

// In-memory storage — buffers are streamed straight to Backblaze B2.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (videos)
})

// Tighter limit on OTP send to avoid SMS abuse
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
})

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/send-otp', otpLimiter, postSendOtp)
router.post('/verify-otp', generalLimiter, postVerifyOtp)
router.post('/lookup-voter', generalLimiter, postLookupVoter)
router.post('/submit-application', generalLimiter, postSubmitApplication)
router.get('/application/:id', generalLimiter, getApplication)
router.post('/upload/media', generalLimiter, upload.single('file'), postUploadMedia)
router.post('/organiser-message', generalLimiter, postOrganiserMessage)
// Public read-only media proxy (streams private B2 objects). Key may contain
// slashes, so use a wildcard. Left unthrottled — responses are cache-friendly.
router.get('/media/*', getMediaProxy)

export default router
