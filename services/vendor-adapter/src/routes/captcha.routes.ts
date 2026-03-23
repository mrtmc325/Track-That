// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Router } from 'express';
import * as captchaController from '../controllers/captcha.controller.js';

const router = Router();

router.get('/pending', captchaController.getPending);
router.get('/:id/screenshot', captchaController.getScreenshot);
router.get('/:id/status', captchaController.getStatus);
router.post('/:id/click', captchaController.sendClick);
router.post('/:id/hold', captchaController.sendHold);
router.post('/:id/type', captchaController.sendType);
router.post('/:id/done', captchaController.markDone);

export default router;
