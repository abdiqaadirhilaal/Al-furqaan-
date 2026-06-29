-- Al-Furqaan Quran School - PostgreSQL Schema
-- Run this on Neon to create all tables

CREATE TABLE IF NOT EXISTS manager (
  id VARCHAR(10) PRIMARY KEY DEFAULT 'M001',
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  name VARCHAR(50) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  class VARCHAR(50) REFERENCES classes(name),
  phone VARCHAR(20) DEFAULT '-',
  email VARCHAR(100) DEFAULT ''
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  class VARCHAR(50) REFERENCES classes(name),
  phone VARCHAR(20) DEFAULT '',
  parent VARCHAR(100) DEFAULT '',
  registration_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id SERIAL PRIMARY KEY,
  teacher_id VARCHAR(10) REFERENCES teachers(id),
  teacher_name VARCHAR(100) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  session VARCHAR(10) DEFAULT 'subax',
  status VARCHAR(30) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date, session)
);

CREATE TABLE IF NOT EXISTS student_attendance (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(10) REFERENCES students(id),
  student_name VARCHAR(100) NOT NULL,
  class VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(10) PRIMARY KEY,
  student_id VARCHAR(10) REFERENCES students(id),
  student_name VARCHAR(100) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  recorded_by VARCHAR(100) DEFAULT 'Manager',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_class ON student_attendance(class);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);

-- Seed default data
INSERT INTO manager (id, username, password, name) VALUES ('M001', 'manager', 'admin123', 'School Manager')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (name) VALUES ('1'), ('2'), ('3'), ('4')
ON CONFLICT (name) DO NOTHING;

INSERT INTO teachers (id, name, password, class, phone, email) VALUES
  ('T001', 'Aadam Abuukar Siidow', 'furqaan1234', '1', '+252612431691', ''),
  ('T002', 'Cali Nuur Sheeq', 'furqaan1234', '2', '+252619835757', ''),
  ('T003', 'Cali C. Raxman Xerow', 'furqaan1234', '3', '+252615539640', ''),
  ('T004', 'Xasan Salaad Naxris', 'furqaan1234', '4', '+252771063068', '')
ON CONFLICT (id) DO NOTHING;
