const express = require('express');
const router = express.Router();
const { createGeofence, getGeofences, deleteGeofence } = require('../controllers/geofenceController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getGeofences);
router.post('/', authenticate, createGeofence);
router.delete('/:id', authenticate,  deleteGeofence);

module.exports = router;
