const pool = require('../db/pool');

// Haversine formula — calculates distance between two GPS coordinates in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// POST /api/location/ping
// Called by the mobile app every 60 seconds with member's current GPS coords
const pingLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  const memberId = req.member.id;
  const churchId = req.member.churchId;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'latitude and longitude required' });
  }

  const client = await pool.connect();

  try {
    // 1. Get all active geofences for this church
    const geofencesResult = await client.query(
      'SELECT * FROM geofences WHERE church_id = $1 AND is_active = true',
      [churchId]
    );

    const geofences = geofencesResult.rows;

    // 2. Check if member is inside ANY geofence
    let insideGeofence = null;
    for (const zone of geofences) {
      const distance = getDistanceMeters(
        latitude,
        longitude,
        parseFloat(zone.center_lat),
        parseFloat(zone.center_lng)
      );
      if (distance <= zone.radius_meters) {
        insideGeofence = zone;
        break;
      }
    }

    // 3. Get member's current state (were they inside or outside before this ping?)
    const stateResult = await client.query(
      'SELECT * FROM member_location_state WHERE member_id = $1',
      [memberId]
    );

    const state = stateResult.rows[0];
    const wasInside = state?.is_inside || false;
    const currentAttendanceId = state?.current_attendance_id;

    let event = null;

    // 4. ENTRY — Member just arrived (was outside, now inside)
    if (insideGeofence && !wasInside) {
      // Create attendance log
      const attendanceResult = await client.query(
        `INSERT INTO attendance_logs (member_id, geofence_id, church_id, service_date)
         VALUES ($1, $2, $3, CURRENT_DATE)
         RETURNING *`,
        [memberId, insideGeofence.id, churchId]
      );

      const attendance = attendanceResult.rows[0];

      // Update member state to "inside"
      await client.query(
        `UPDATE member_location_state 
         SET is_inside = true, last_ping = NOW(), last_lat = $2, last_lng = $3, current_attendance_id = $4
         WHERE member_id = $1`,
        [memberId, latitude, longitude, attendance.id]
      );

      event = 'ENTERED';
      console.log(`✅ ENTRY: Member ${memberId} entered ${insideGeofence.name}`);
    }

    // 5. EXIT — Member just left (was inside, now outside)
    else if (!insideGeofence && wasInside && currentAttendanceId) {
      // Update the attendance log with exit time
      await client.query(
        'UPDATE attendance_logs SET exited_at = NOW() WHERE id = $1',
        [currentAttendanceId]
      );

      // Update member state to "outside"
      await client.query(
        `UPDATE member_location_state 
         SET is_inside = false, last_ping = NOW(), last_lat = $2, last_lng = $3, current_attendance_id = NULL
         WHERE member_id = $1`,
        [memberId, latitude, longitude]
      );

      event = 'EXITED';
      console.log(`👋 EXIT: Member ${memberId} left the campus`);
    }

    // 6. No change — just update the last ping time and coordinates
    else {
      await client.query(
        `UPDATE member_location_state 
         SET last_ping = NOW(), last_lat = $2, last_lng = $3
         WHERE member_id = $1`,
        [memberId, latitude, longitude]
      );
    }

    res.json({
      status: 'ok',
      isInsideGeofence: !!insideGeofence,
      geofenceName: insideGeofence?.name || null,
      event, // 'ENTERED', 'EXITED', or null
    });

  } catch (err) {
    console.error('Location ping error:', err);
    res.status(500).json({ error: 'Failed to process location' });
  } finally {
    client.release();
  }
};

module.exports = { pingLocation };
