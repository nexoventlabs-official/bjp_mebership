import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAdmin } from '../middleware/adminAuth.js'
import {
  postLogin, getSession, postLogout,
  getDashboardStats, getApplications, getApplicationDetail,
} from '../controllers/adminController.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
})

router.post('/login', loginLimiter, postLogin)
router.get('/session', requireAdmin, getSession)
router.post('/logout', postLogout)

router.get('/stats', requireAdmin, getDashboardStats)
router.get('/applications', requireAdmin, getApplications)
router.get('/applications/:id', requireAdmin, getApplicationDetail)

export default router
