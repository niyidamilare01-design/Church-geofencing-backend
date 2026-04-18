const express = require('express');
const router = express.Router();
const { createGeofence, getGeofences, deleteGeofence } = require('../controllers/geofenceController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getGeofences);
router.post('/', authenticate, requireAdmin, createGeofence);
router.delete('/:id', authenticate, requireAdmin, deleteGeofence);

module.exports = router;
