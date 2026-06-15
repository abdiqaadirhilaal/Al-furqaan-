/**
 * Al-Furqaan Quran School - Backend API Server
 * Built with Express + Neon PostgreSQL
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'furqaan-secret-key-2026';

// Database connection (Neon PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ======================== AUTH ========================
function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, class: user.class || null },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (role === 'manager') {
      const result = await pool.query('SELECT * FROM manager WHERE username = $1 AND password = $2', [username, password]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid manager credentials' });
      const m = result.rows[0];
      const token = generateToken({ id: m.id, name: m.name, role: 'manager' });
      return res.json({ success: true, token, user: { id: m.id, name: m.name, role: 'manager' } });
    }
    if (role === 'teacher') {
      const result = await pool.query('SELECT * FROM teachers WHERE id = $1 AND password = $2', [username, password]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid teacher ID or password' });
      const t = result.rows[0];
      const token = generateToken({ id: t.id, name: t.name, role: 'teacher', class: t.class });
      return res.json({ success: true, token, user: { id: t.id, name: t.name, role: 'teacher', class: t.class, phone: t.phone, email: t.email } });
    }
    return res.status(400).json({ error: 'Invalid role' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/verify - verify token
app.get('/api/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ======================== STUDENTS ========================
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const { class: className, search } = req.query;
    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    if (className) { params.push(className); query += ` AND class = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (name ILIKE $${params.length} OR id ILIKE $${params.length})`; }
    query += ' ORDER BY registration_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/students', authMiddleware, async (req, res) => {
  try {
    const { id, name, class: className, phone, parent, registrationDate, status } = req.body;
    // Auto-generate ID if not provided
    let studentId = id;
    if (!studentId) {
      const cnt = await pool.query('SELECT COUNT(*) FROM students');
      const nextNum = parseInt(cnt.rows[0].count) + 1;
      studentId = `STU${String(nextNum).padStart(4, '0')}`;
    }
    const result = await pool.query(
      'INSERT INTO students (id, name, class, phone, parent, registration_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [studentId, name, className, phone || '', parent || '', registrationDate || new Date().toISOString().split('T')[0], status || 'active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Student ID already exists' });
    console.error('Add student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== TEACHERS ========================
app.get('/api/teachers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Get teachers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/teachers', authMiddleware, async (req, res) => {
  try {
    const { id, name, password, class: className, phone, email } = req.body;
    // Check duplicate ID
    const exist = await pool.query('SELECT id FROM teachers WHERE id = $1', [id]);
    if (exist.rows.length > 0) return res.status(400).json({ error: `Teacher ID ${id} already exists` });
    // Check duplicate class
    const classTaken = await pool.query('SELECT id FROM teachers WHERE class = $1', [className]);
    if (classTaken.rows.length > 0) return res.status(400).json({ error: `Class ${className} already has a teacher` });
    const result = await pool.query(
      'INSERT INTO teachers (id, name, password, class, phone, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, name, password, className, phone || '-', email || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add teacher error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/teachers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM teachers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== CLASSES ========================
app.get('/api/classes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM classes ORDER BY name');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    console.error('Get classes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== TEACHER ATTENDANCE ========================
app.get('/api/attendance/teacher', authMiddleware, async (req, res) => {
  try {
    const { date, teacherId } = req.query;
    let query = 'SELECT * FROM teacher_attendance WHERE 1=1';
    const params = [];
    if (date) { params.push(date); query += ` AND date = $${params.length}`; }
    if (teacherId) { params.push(teacherId); query += ` AND teacher_id = $${params.length}`; }
    query += ' ORDER BY timestamp DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get teacher attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/attendance/teacher', authMiddleware, async (req, res) => {
  try {
    const { teacherId, teacherName, className } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].slice(0, 5);

    // Check if already marked today
    const existing = await pool.query(
      'SELECT * FROM teacher_attendance WHERE teacher_id = $1 AND date = $2',
      [teacherId, date]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already marked today', record: existing.rows[0] });
    }

    // Determine status
    const [hours, minutes] = time.split(':').map(Number);
    const status = (hours < 6 || (hours === 6 && minutes <= 30)) ? 'PRESENT' : 'LATE';

    const result = await pool.query(
      'INSERT INTO teacher_attendance (teacher_id, teacher_name, class_name, date, time, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [teacherId, teacherName, className, date, time, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark teacher attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== STUDENT ATTENDANCE ========================
app.get('/api/attendance/student', authMiddleware, async (req, res) => {
  try {
    const { date, class: className, studentId } = req.query;
    let query = 'SELECT * FROM student_attendance WHERE 1=1';
    const params = [];
    if (date) { params.push(date); query += ` AND date = $${params.length}`; }
    if (className) { params.push(className); query += ` AND class = $${params.length}`; }
    if (studentId) { params.push(studentId); query += ` AND student_id = $${params.length}`; }
    query += ' ORDER BY timestamp DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get student attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/attendance/student', authMiddleware, async (req, res) => {
  try {
    const { records } = req.body; // array of { studentId, studentName, class, status }
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].slice(0, 5);

    // Delete existing records for this date and class
    if (records.length > 0) {
      await pool.query('DELETE FROM student_attendance WHERE date = $1 AND class = $2', [date, records[0].class]);
    }

    // Insert new records
    const inserted = [];
    for (const r of records) {
      const result = await pool.query(
        'INSERT INTO student_attendance (student_id, student_name, class, date, time, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [r.studentId, r.studentName, r.class, date, time, r.status]
      );
      inserted.push(result.rows[0]);
    }
    res.json(inserted);
  } catch (err) {
    console.error('Mark student attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== PAYMENTS ========================
app.get('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];

    if (period === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      params.push(today); query += ` AND date = $${params.length}`;
    } else if (period === 'weekly') {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      params.push(weekAgo.toISOString().split('T')[0]); query += ` AND date >= $${params.length}`;
    } else if (period === 'monthly') {
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
      params.push(monthAgo.toISOString().split('T')[0]); query += ` AND date >= $${params.length}`;
    }
    if (startDate) { params.push(startDate); query += ` AND date >= $${params.length}`; }
    if (endDate) { params.push(endDate); query += ` AND date <= $${params.length}`; }

    query += ' ORDER BY timestamp DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { studentId, studentName, className, amount, date, recordedBy } = req.body;

    // Check duplicate (same student, date, amount)
    const dup = await pool.query(
      'SELECT id FROM payments WHERE student_id = $1 AND date = $2 AND amount = $3',
      [studentId, date, amount]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'Duplicate payment record: same student, date, and amount already exists' });
    }

    // Generate payment ID
    const cnt = await pool.query('SELECT COUNT(*) FROM payments');
    const payId = `PAY${String(parseInt(cnt.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await pool.query(
      'INSERT INTO payments (id, student_id, student_name, class_name, amount, date, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [payId, studentId, studentName, className, amount, date, recordedBy || 'Manager']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== STATS / DASHBOARD ========================
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [students, teachers, payments, tAtt] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM students'),
      pool.query('SELECT COUNT(*) FROM teachers'),
      pool.query('SELECT COUNT(*) FROM payments'),
      pool.query("SELECT COUNT(*) FROM teacher_attendance WHERE date = CURRENT_DATE AND status = 'PRESENT'")
    ]);

    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    const monthIncome = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date >= $1',
      [monthAgo.toISOString().split('T')[0]]
    );

    res.json({
      totalStudents: parseInt(students.rows[0].count),
      totalTeachers: parseInt(teachers.rows[0].count),
      totalPayments: parseInt(payments.rows[0].count),
      todayAttendance: parseInt(tAtt.rows[0].count),
      monthlyIncome: parseFloat(monthIncome.rows[0].total)
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================== HEALTH CHECK ========================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// ======================== INIT DB ENDPOINT ========================
app.post('/api/init', async (req, res) => {
  try {
    const schema = require('fs').readFileSync('./db/schema.sql', 'utf8');
    await pool.query(schema);
    res.json({ success: true, message: 'Database initialized' });
  } catch (err) {
    console.error('Init error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ======================== START SERVER ========================
app.listen(PORT, () => {
  console.log(`🔷 Al-Furqaan API running on port ${PORT}`);
  console.log(`🔷 Health check: http://localhost:${PORT}/api/health`);
});
