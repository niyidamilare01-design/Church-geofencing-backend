const pool = require('../db/pool');

// GET /api/attendance/today — Who is on campus right now + today's log
const getTodayAttendance = async (req, res) => {
  const churchId = req.member.churchId;

  try {
    // Members currently on campus (inside geofence)
    const liveResult = await pool.query(
      `SELECT m.id, m.name, m.email, m.phone, m.family_group,
              mls.last_ping, mls.last_lat, mls.last_lng,
              al.entered_at, g.name as geofence_name
       FROM member_location_state mls
       JOIN members m ON mls.member_id = m.id
       LEFT JOIN attendance_logs al ON mls.current_attendance_id = al.id
       LEFT JOIN geofences g ON al.geofence_id = g.id
       WHERE m.church_id = $1 AND mls.is_inside = true
       ORDER BY al.entered_at DESC`,
      [churchId]
    );

    // All members who attended today (including those who already left)
    const todayResult = await pool.query(
      `SELECT m.id, m.name, m.email, m.family_group,
              al.entered_at, al.exited_at, g.name as geofence_name
       FROM attendance_logs al
       JOIN members m ON al.member_id = m.id
       LEFT JOIN geofences g ON al.geofence_id = g.id
       WHERE al.church_id = $1 AND al.service_date = CURRENT_DATE
       ORDER BY al.entered_at DESC`,
      [churchId]
    );

    res.json({
      currentlyOnCampus: liveResult.rows,
      totalOnCampus: liveResult.rows.length,
      todayAttendance: todayResult.rows,
      totalToday: todayResult.rows.length,
      date: new Date().toISOString().split('T')[0],
    });

  } catch (err) {
    console.error('Today attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// GET /api/attendance/history?memberId=xxx — Member's personal history
const getMemberHistory = async (req, res) => {
  // Admins can query any member; regular members only see their own
  const memberId = req.query.memberId || req.member.id;

  if (req.member.role === 'member' && memberId !== req.member.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await pool.query(
      `SELECT al.id, al.entered_at, al.exited_at, al.service_date,
              g.name as geofence_name,
              EXTRACT(EPOCH FROM (COALESCE(al.exited_at, NOW()) - al.entered_at)) / 60 as duration_minutes
       FROM attendance_logs al
       LEFT JOIN geofences g ON al.geofence_id = g.id
       WHERE al.member_id = $1
       ORDER BY al.entered_at DESC
       LIMIT 50`,
      [memberId]
    );

    res.json({
      history: result.rows,
      totalAttendances: result.rows.length,
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

// GET /api/attendance/report?startDate=2024-01-01&endDate=2024-12-31
const getReport = async (req, res) => {
  const churchId = req.member.churchId;
  const { startDate, endDate } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
         al.service_date,
         COUNT(DISTINCT al.member_id) as unique_members,
         COUNT(al.id) as total_checkins,
         json_agg(json_build_object(
           'name', m.name,
           'entered_at', al.entered_at,
           'exited_at', al.exited_at,
           'family_group', m.family_group
         ) ORDER BY al.entered_at) as members
       FROM attendance_logs al
       JOIN members m ON al.member_id = m.id
       WHERE al.church_id = $1
         AND al.service_date BETWEEN $2 AND $3
       GROUP BY al.service_date
       ORDER BY al.service_date DESC`,
      [churchId, startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]]
    );

    res.json({ report: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

module.exports = { getTodayAttendance, getMemberHistory, getReport };
