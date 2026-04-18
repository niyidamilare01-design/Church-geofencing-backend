const express = require('express');
const router = express.Router();
const { pingLocation } = require('../controllers/locationController');
const { getTodayAttendance, getMemberHistory, getReport } = require('../controllers/attendanceController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Location ping from mobile app
router.post('/ping', authenticate, pingLocation);

// Attendance endpoints
router.get('/today', authenticate, requireAdmin, getTodayAttendance);
router.get('/history', authenticate, getMemberHistory);
router.get('/report', authenticate, requireAdmin, getReport);

module.exports = router;
