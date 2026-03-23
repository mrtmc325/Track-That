// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';

const router = Router();

// Cart
router.get('/cart', cartController.getCart);
router.post('/cart/items', cartController.addItem);
router.patch('/cart/items/:id', cartController.updateQuantity);
router.delete('/cart/items/:id', cartController.removeItem);

// Checkout
router.post('/checkout/initiate', cartController.initiateCheckout);
router.post('/checkout/fulfillment', cartController.setFulfillment);
router.post('/checkout/pay', cartController.processPayment);
router.post('/checkout/complete', cartController.completeCheckout);

// Orders
router.get('/orders', cartController.getOrders);
router.get('/orders/:id', cartController.getOrder);

export default router;
