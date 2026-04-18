const pool = require('../db/pool');

// POST /api/geofences — Admin creates a geofence zone
const createGeofence = async (req, res) => {
  const { name, centerLat, centerLng, radiusMeters } = req.body;
  const churchId = req.member.churchId;

  try {
    const result = await pool.query(
      `INSERT INTO geofences (church_id, name, center_lat, center_lng, radius_meters)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [churchId, name, centerLat, centerLng, radiusMeters || 100]
    );

    res.status(201).json({ geofence: result.rows[0] });
  } catch (err) {
    console.error('Create geofence error:', err);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
};

// GET /api/geofences — Get all geofences for this church
const getGeofences = async (req, res) => {
  const churchId = req.member.churchId;

  try {
    const result = await pool.query(
      'SELECT * FROM geofences WHERE church_id = $1 AND is_active = true ORDER BY created_at DESC',
      [churchId]
    );

    res.json({ geofences: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
};

// DELETE /api/geofences/:id — Admin deactivates a geofence
const deleteGeofence = async (req, res) => {
  const { id } = req.params;
  const churchId = req.member.churchId;

  try {
    await pool.query(
      'UPDATE geofences SET is_active = false WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    res.json({ message: 'Geofence removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove geofence' });
  }
};

module.exports = { createGeofence, getGeofences, deleteGeofence };
