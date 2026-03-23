import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { updateProfileSchema } from '../schemas/auth.schema.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// GET /api/v1/users/me — Requires auth
router.get('/me', requireAuth, userController.getProfile);

// PATCH /api/v1/users/me — Requires auth
router.patch('/me', requireAuth, validate(updateProfileSchema), userController.updateProfile);

export default router;
