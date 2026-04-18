const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// POST /api/auth/signup
const signup = async (req, res) => {
  const { name, email, phone, password, inviteCode, familyGroup } = req.body;

  try {
    // 1. Verify invite code matches a church
    const churchResult = await pool.query(
      'SELECT * FROM churches WHERE invite_code = $1',
      [inviteCode]
    );

    if (churchResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid church invite code' });
    }

    const church = churchResult.rows[0];

    // 2. Check email not already registered
    const existing = await pool.query(
      'SELECT id FROM members WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Create member
    const result = await pool.query(
      `INSERT INTO members (church_id, name, email, phone, password_hash, family_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, church_id, created_at`,
      [church.id, name, email, phone, passwordHash, familyGroup || null]
    );

    const member = result.rows[0];

    // 5. Initialize location state record
    await pool.query(
      'INSERT INTO member_location_state (member_id) VALUES ($1)',
      [member.id]
    );

    // 6. Generate JWT
    const token = jwt.sign(
      { id: member.id, email: member.email, role: member.role, churchId: church.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: `Welcome to ${church.name}!`,
      token,
      member: { ...member, churchName: church.name },
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT m.*, c.name as church_name 
       FROM members m
       JOIN churches c ON m.church_id = c.id
       WHERE m.email = $1 AND m.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const member = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, member.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: member.id, email: member.email, role: member.role, churchId: member.church_id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        churchName: member.church_name,
        familyGroup: member.family_group,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.name, m.email, m.phone, m.role, m.family_group, m.created_at,
              c.name as church_name
       FROM members m
       JOIN churches c ON m.church_id = c.id
       WHERE m.id = $1`,
      [req.member.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ member: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { signup, login, getMe };
