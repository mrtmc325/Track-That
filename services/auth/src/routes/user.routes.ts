import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../schemas/auth.schema.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// GET /api/v1/users/me — Requires auth
router.get('/me', userController.getProfile);

// PATCH /api/v1/users/me — Requires auth
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);

export default router;
