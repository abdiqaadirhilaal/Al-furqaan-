const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'furqaan-secret-key-2026';
let pool = null;

// Lazy connect to database
async function getPool() {
  if (pool) return pool;
  const { Pool } = require('pg');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  // Try to init schema
  try {
    const schemaPath = path.join(__dirname, '..', 'backend', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
    }
  } catch (e) { /* schema may already exist */ }
  return pool;
}

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

function generateToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role, class: user.class || null }, JWT_SECRET, { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}

app.get('/api/health', async (req, res) => {
  try {
    const db = await getPool();
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'disconnected', detail: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const db = await getPool();
    const { username, password, role } = req.body;
    if (role === 'manager') {
      const r = await db.query('SELECT * FROM manager WHERE username = $1 AND password = $2', [username, password]);
      if (r.rows.length === 0) return res.status(401).json({ error: 'Invalid manager credentials' });
      const m = r.rows[0];
      return res.json({ success: true, token: generateToken({ id: m.id, name: m.name, role: 'manager' }), user: { id: m.id, name: m.name, role: 'manager' } });
    }
    if (role === 'teacher') {
      const r = await db.query('SELECT * FROM teachers WHERE id = $1 AND password = $2', [username, password]);
      if (r.rows.length === 0) return res.status(401).json({ error: 'Invalid teacher ID or password' });
      const t = r.rows[0];
      return res.json({ success: true, token: generateToken({ id: t.id, name: t.name, role: 'teacher', class: t.class }), user: { id: t.id, name: t.name, role: 'teacher', class: t.class, phone: t.phone, email: t.email } });
    }
    res.status(400).json({ error: 'Invalid role' });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { class: c, search } = req.query;
    let q = 'SELECT * FROM students WHERE 1=1'; const p = [];
    if (c) { p.push(c); q += ` AND class = $${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (name ILIKE $${p.length} OR id ILIKE $${p.length})`; }
    q += ' ORDER BY registration_date DESC';
    res.json((await db.query(q, p)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/students', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { id, name, class: c, phone, parent, registrationDate, status } = req.body;
    let sid = id;
    if (!sid) { const cnt = await db.query('SELECT COUNT(*) FROM students'); sid = `STU${String(parseInt(cnt.rows[0].count) + 1).padStart(4, '0')}`; }
    const r = await db.query(`INSERT INTO students (id,name,class,phone,parent,registration_date,status) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, class=EXCLUDED.class, phone=EXCLUDED.phone, parent=EXCLUDED.parent, registration_date=EXCLUDED.registration_date, status=EXCLUDED.status RETURNING *`,
      [sid, name, c, phone||'', parent||'', registrationDate||new Date().toISOString().split('T')[0], status||'active']);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.query('DELETE FROM students WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers', authMiddleware, async (req, res) => {
  try { const db = await getPool(); res.json((await db.query('SELECT * FROM teachers ORDER BY id')).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/teachers', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { id, name, password, class: c, phone, email } = req.body;
    if ((await db.query('SELECT id FROM teachers WHERE id != $1 AND class = $2', [id, c])).rows.length && !(await db.query('SELECT id FROM teachers WHERE id = $1 AND class = $2', [id, c])).rows.length) return res.status(400).json({ error: `Class ${c} already has a teacher` });
    const r = await db.query(`INSERT INTO teachers (id,name,password,class,phone,email) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, password=EXCLUDED.password, class=EXCLUDED.class, phone=EXCLUDED.phone, email=EXCLUDED.email RETURNING *`, [id, name, password, c, phone||'-', email||'']);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/teachers/:id', authMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.query('DELETE FROM teachers WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/classes', authMiddleware, async (req, res) => {
  try { const db = await getPool(); res.json((await db.query('SELECT * FROM classes ORDER BY name')).rows.map(r => r.name)); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance/teacher', authMiddleware, async (req, res) => {
  try { const db = await getPool(); const { date, teacherId } = req.query; let q = 'SELECT * FROM teacher_attendance WHERE 1=1'; const p = []; if (date) { p.push(date); q += ` AND date = $${p.length}`; } if (teacherId) { p.push(teacherId); q += ` AND teacher_id = $${p.length}`; } q += ' ORDER BY timestamp DESC'; res.json((await db.query(q, p)).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/teacher', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { teacherId, teacherName, className, date: rd, time: rt, status: rs, session: rsession } = req.body;
    const now = new Date(); const date = rd || now.toISOString().split('T')[0]; const time = rt || now.toTimeString().split(' ')[0].slice(0, 5);
    if (rs) { await db.query('INSERT INTO teacher_attendance (teacher_id,teacher_name,class_name,date,time,session,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (teacher_id,date,session) DO NOTHING', [teacherId, teacherName, className, date, time, rsession||'subax', rs]); return res.json({ synced: true }); }
    if ((await db.query('SELECT * FROM teacher_attendance WHERE teacher_id=$1 AND date=$2 AND session=$3', [teacherId, date, rsession||'subax'])).rows.length) return res.status(400).json({ error: 'Already marked' }));
    const session = rsession || 'subax';
    const lateMap = { subax: '06:40', barqo: '09:40', galab: '14:40' };
    const lateTime = lateMap[session] || '06:40';
    const [lh, lm] = lateTime.split(':').map(Number); const [h, m] = time.split(':').map(Number);
    const status = (h < lh || (h === lh && m <= lm)) ? 'WAQTIGIISA YIMID' : 'SOO DAAHAY';
    const r = await db.query('INSERT INTO teacher_attendance (teacher_id,teacher_name,class_name,date,time,session,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [teacherId, teacherName, className, date, time, session, status]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance/student', authMiddleware, async (req, res) => {
  try { const db = await getPool(); const { date, class: c, studentId } = req.query; let q = 'SELECT * FROM student_attendance WHERE 1=1'; const p = []; if (date) { p.push(date); q += ` AND date = $${p.length}`; } if (c) { p.push(c); q += ` AND class = $${p.length}`; } if (studentId) { p.push(studentId); q += ` AND student_id = $${p.length}`; } q += ' ORDER BY timestamp DESC'; res.json((await db.query(q, p)).rows); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/student', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { records, date: rd, time: rt } = req.body;
    const now = new Date(); const date = rd || now.toISOString().split('T')[0]; const time = rt || now.toTimeString().split(' ')[0].slice(0, 5);
    if (records && records.length === 1 && records[0].date) {
      const r = records[0]; await db.query('INSERT INTO student_attendance (student_id,student_name,class,date,time,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id,date) DO NOTHING', [r.studentId, r.studentName, r.class, r.date, r.time||time, r.status]);
      return res.json({ synced: true });
    }
    if (records && records.length > 0 && !records[0]._syncDate) await db.query('DELETE FROM student_attendance WHERE date=$1 AND class=$2', [date, records[0].class]);
    const ins = [];
    for (const r of records) {
      const x = await db.query('INSERT INTO student_attendance (student_id,student_name,class,date,time,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id,date) DO NOTHING RETURNING *',
        [r.studentId, r.studentName, r.class, r.date||date, r.time||time, r.status]);
      if (x.rows.length > 0) ins.push(x.rows[0]);
    }
    res.json(ins);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/payments', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { period, startDate, endDate } = req.query; let q = 'SELECT * FROM payments WHERE 1=1'; const p = [];
    if (period === 'daily') { p.push(new Date().toISOString().split('T')[0]); q += ` AND date = $${p.length}`; }
    else if (period === 'weekly') { const d = new Date(); d.setDate(d.getDate()-7); p.push(d.toISOString().split('T')[0]); q += ` AND date >= $${p.length}`; }
    else if (period === 'monthly') { const d = new Date(); d.setDate(d.getDate()-30); p.push(d.toISOString().split('T')[0]); q += ` AND date >= $${p.length}`; }
    if (startDate) { p.push(startDate); q += ` AND date >= $${p.length}`; }
    if (endDate) { p.push(endDate); q += ` AND date <= $${p.length}`; }
    q += ' ORDER BY timestamp DESC'; res.json((await db.query(q, p)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/payments', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const { studentId, studentName, className, amount, date, recordedBy } = req.body;
    if ((await db.query('SELECT id FROM payments WHERE student_id=$1 AND date=$2 AND amount=$3', [studentId, date, amount])).rows.length) return res.status(400).json({ error: 'Duplicate payment' });
    const cnt = await db.query('SELECT COUNT(*) FROM payments');
    const id = `PAY${String(parseInt(cnt.rows[0].count)+1).padStart(4,'0')}`;
    const r = await db.query('INSERT INTO payments (id,student_id,student_name,class_name,amount,date,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, studentId, studentName, className, amount, date, recordedBy||'Manager']);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const [s, t, p, ta] = await Promise.all([
      db.query('SELECT COUNT(*) FROM students'), db.query('SELECT COUNT(*) FROM teachers'),
      db.query('SELECT COUNT(*) FROM payments'), db.query("SELECT COUNT(*) FROM teacher_attendance WHERE date=CURRENT_DATE AND status='PRESENT'")]);
    const ma = new Date(); ma.setDate(ma.getDate()-30);
    const mi = await db.query('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE date>=$1', [ma.toISOString().split('T')[0]]);
    res.json({ totalStudents: parseInt(s.rows[0].count), totalTeachers: parseInt(t.rows[0].count), totalPayments: parseInt(p.rows[0].count), todayAttendance: parseInt(ta.rows[0].count), monthlyIncome: parseFloat(mi.rows[0].t) });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/init', async (req, res) => {
  try {
    const db = await getPool();
    const schema = fs.readFileSync(path.join(__dirname, '..', 'backend', 'db', 'schema.sql'), 'utf8');
    await db.query(schema);
    res.json({ success: true, message: 'Database initialized' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;
