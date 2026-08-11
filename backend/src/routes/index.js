import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  postSendOtp, postVerifyOtp, postLookupVoter,
  postSubmitApplication, getApplication,
} from '../controllers/chatController.js'

const router = Router()

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

export default router
