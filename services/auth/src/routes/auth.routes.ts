import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// POST /api/v1/auth/register — Public
router.post('/register', validate(registerSchema), authController.register);

// POST /api/v1/auth/login — Public, rate-limited
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/logout — Requires auth (cookie-based)
router.post('/logout', authController.logout);

// POST /api/v1/auth/refresh — Requires refresh token cookie
router.post('/refresh', authController.refresh);

export default router;
