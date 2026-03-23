// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/require-auth.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// POST /api/v1/auth/register — Public, rate-limited
router.post('/register', loginRateLimiter, validate(registerSchema), authController.register);

// POST /api/v1/auth/login — Public, rate-limited
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/logout — Requires auth
router.post('/logout', requireAuth, authController.logout);

// POST /api/v1/auth/refresh — Requires refresh token cookie
router.post('/refresh', authController.refresh);

// POST /api/v1/auth/forgot-password — Public, rate-limited
router.post('/forgot-password', loginRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

// POST /api/v1/auth/reset-password — Public (token-based)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
