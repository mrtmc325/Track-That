import { Router } from 'express';
import * as geoController from '../controllers/geo.controller.js';

const router = Router();

// GET /api/v1/geo/stores?lat=&lng=&radius=&type=
router.get('/stores', geoController.nearbyStores);

// GET /api/v1/geo/distance?from_lat=&from_lng=&store_id=
router.get('/distance', geoController.distanceToStore);

// POST /api/v1/geo/geocode
router.post('/geocode', geoController.geocodeAddress);

// GET /api/v1/geo/reverse?lat=&lng=
router.get('/reverse', geoController.reverseGeocode);

export default router;
