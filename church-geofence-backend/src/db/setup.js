require('dotenv').config();
const pool = require('./pool');

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('Setting up database...');

    // Enable PostGIS extension for geospatial queries
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log('PostGIS enabled');

    // Churches / Campuses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS churches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        invite_code VARCHAR(50) UNIQUE NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('churches table ready');

    // Members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'pastor')),
        family_group VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('members table ready');

    // Geofences table (radius is stored in meters for database compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS geofences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        center_lat DECIMAL(10, 8) NOT NULL,
        center_lng DECIMAL(11, 8) NOT NULL,
        radius_meters INTEGER NOT NULL DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('geofences table ready');

    // Attendance logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID REFERENCES members(id) ON DELETE CASCADE,
        geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        entered_at TIMESTAMP DEFAULT NOW(),
        exited_at TIMESTAMP,
        service_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('attendance_logs table ready');

    // Member location state table (tracks inside/outside status to prevent duplicate logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS member_location_state (
        member_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        is_inside BOOLEAN DEFAULT false,
        last_ping TIMESTAMP DEFAULT NOW(),
        last_lat DECIMAL(10, 8),
        last_lng DECIMAL(11, 8),
        current_attendance_id UUID REFERENCES attendance_logs(id)
      );
    `);
    console.log('member_location_state table ready');

    const inviteCode = process.env.CHURCH_INVITE_CODE || 'GRACE2024';

    // Seed the church for development
    await client.query(`
      INSERT INTO churches (name, invite_code, address)
      VALUES (
        'Grace Community Church',
        $1,
        '3100 Avalon Ridge Pl NW, Peachtree Corners, GA 30071'
      )
      ON CONFLICT (invite_code) DO UPDATE
      SET address = EXCLUDED.address;
    `, [inviteCode]);
    console.log('Default church seeded');

    // 0.1-mile geofence centered on the Avalon Ridge address.
    await client.query(`
      INSERT INTO geofences (
        church_id,
        name,
        center_lat,
        center_lng,
        radius_meters
      )
      SELECT
        churches.id,
        'Avalon Ridge Campus',
        33.9637183,
        -84.1925473,
        161
      FROM churches
      WHERE churches.invite_code = $1
        AND NOT EXISTS (
          SELECT 1
          FROM geofences
          WHERE geofences.church_id = churches.id
            AND geofences.name = 'Avalon Ridge Campus'
        );
    `, [inviteCode]);
    console.log('Avalon Ridge geofence seeded (0.1 miles)');

    console.log('\nDatabase setup complete! Ready to go.\n');
  } catch (err) {
    console.error('Setup failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

setupDatabase();
