require('dotenv').config();
const pool = require('./pool');

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔧 Setting up database...');

    // Enable PostGIS extension for geospatial queries
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log('✅ PostGIS enabled');

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
    console.log('✅ churches table ready');

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
    console.log('✅ members table ready');

    // Geofences table (uses PostGIS geography type)
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
    console.log('✅ geofences table ready');

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
    console.log('✅ attendance_logs table ready');

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
    console.log('✅ member_location_state table ready');

    // Seed a default church for development
    await client.query(`
      INSERT INTO churches (name, invite_code, address)
      VALUES ('Grace Community Church', $1, '123 Faith Avenue, Lagos')
      ON CONFLICT (invite_code) DO NOTHING;
    `, [process.env.CHURCH_INVITE_CODE || 'GRACE2024']);
    console.log('✅ Default church seeded');

    console.log('\n🎉 Database setup complete! Ready to go.\n');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

setupDatabase();
