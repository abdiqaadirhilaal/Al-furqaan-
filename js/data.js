const DB = {
  _prefix: 'furqaan_',
  _version: 3,
  // Somali time slot configs
  _sessions: {
    subax: { label: 'Subax', start: '06:30', lateAfter: '06:40' },
    barqo: { label: 'Barqo', start: '09:30', lateAfter: '09:40' },
    galab: { label: 'Galab', start: '14:30', lateAfter: '14:40' }
  },

  init() {
    const savedVersion = parseInt(localStorage.getItem(this._prefix + 'version')) || 0;
    if (!localStorage.getItem(this._prefix + 'initialized') || savedVersion < this._version) {
      this.seed();
      localStorage.setItem(this._prefix + 'initialized', 'true');
      localStorage.setItem(this._prefix + 'version', String(this._version));
    }
  },

  seed() {
    if (!localStorage.getItem('furqaan_api_url')) {
      localStorage.setItem('furqaan_api_url', '');
    }
    const classes = ['1', '2', '3', '4'];
    localStorage.setItem(this._prefix + 'classes', JSON.stringify(classes));
    const manager = {
      id: 'M001', username: 'manager', password: 'admin123',
      name: 'School Manager', role: 'manager'
    };
    localStorage.setItem(this._prefix + 'manager', JSON.stringify(manager));
    const teachers = [
      { id: 'T001', name: 'Teacher 1', password: 'furqaan1234', class: '1', phone: '0611111111', email: 'teacher1@furqaan.edu' },
      { id: 'T002', name: 'Teacher 2', password: 'furqaan1234', class: '2', phone: '0612222222', email: 'teacher2@furqaan.edu' },
      { id: 'T003', name: 'Teacher 3', password: 'furqaan1234', class: '3', phone: '0613333333', email: 'teacher3@furqaan.edu' },
      { id: 'T004', name: 'Teacher 4', password: 'furqaan1234', class: '4', phone: '0614444444', email: 'teacher4@furqaan.edu' }
    ];
    localStorage.setItem(this._prefix + 'teachers', JSON.stringify(teachers));
    localStorage.setItem(this._prefix + 'students', JSON.stringify([]));
    localStorage.setItem(this._prefix + 'student_attendance', JSON.stringify([]));
    localStorage.setItem(this._prefix + 'teacher_attendance', JSON.stringify([]));
    localStorage.setItem(this._prefix + 'payments', JSON.stringify([]));
    const sampleStudents = this._getSampleStudents();
    localStorage.setItem(this._prefix + 'students', JSON.stringify(sampleStudents));
  },

  _getSampleStudents() {
    const students = [];
    const names = [
      { name: 'Ahmed Mohamed', parent: 'Mohamed Ali' },
      { name: 'Fatima Hassan', parent: 'Hassan Omar' },
      { name: 'Abdullah Ibrahim', parent: 'Ibrahim Ahmed' },
      { name: 'Aisha Ali', parent: 'Ali Yusuf' },
      { name: 'Omar Abdi', parent: 'Abdi Hassan' },
      { name: 'Maryam Hussein', parent: 'Hussein Ali' },
      { name: 'Hassan Farah', parent: 'Farah Ahmed' },
      { name: 'Khadija Ahmed', parent: 'Ahmed Mohamed' },
      { name: 'Ali Omar', parent: 'Omar Hassan' },
      { name: 'Zainab Mohamed', parent: 'Mohamed Ali' },
      { name: 'Yusuf Ismail', parent: 'Ismail Abdi' },
      { name: 'Safia Aden', parent: 'Aden Mohamed' },
      { name: 'Mohamed Hassan', parent: 'Hassan Mohamed' },
      { name: 'Hawa Ibrahim', parent: 'Ibrahim Ali' },
      { name: 'Ahmed Omar', parent: 'Omar Farah' },
      { name: 'Faisal Hussein', parent: 'Hussein Mohamed' },
      { name: 'Naima Ali', parent: 'Ali Hassan' },
      { name: 'Khalid Ahmed', parent: 'Ahmed Ibrahim' },
      { name: 'Rahma Hassan', parent: 'Hassan Ali' },
      { name: 'Ibrahim Mohamed', parent: 'Mohamed Farah' }
    ];
    const classes = ['1', '2', '3', '4'];
    const today = new Date();
    for (let i = 0; i < 20; i++) {
      const classIdx = i % 4;
      const regDate = new Date(today);
      regDate.setDate(regDate.getDate() - Math.floor(Math.random() * 90));
      students.push({
        id: `STU${String(i + 1).padStart(4, '0')}`,
        name: names[i].name, class: classes[classIdx],
        phone: `061${String(1000000 + i).slice(0, 7)}`,
        parent: names[i].parent,
        registrationDate: regDate.toISOString().split('T')[0],
        status: 'active'
      });
    }
    return students;
  },

  getCollection(name) { const d = localStorage.getItem(this._prefix + name); return d ? JSON.parse(d) : []; },
  saveCollection(name, data) { localStorage.setItem(this._prefix + name, JSON.stringify(data)); },

  getStudents() { return this.getCollection('students'); },
  getStudentsByClass(className) { return this.getStudents().filter(s => s.class === className); },
  addStudent(student) {
    const students = this.getStudents();
    student.id = student.id || `STU${String(students.length + 1).padStart(4, '0')}`;
    students.push(student); this.saveCollection('students', students);
    return student;
  },
  updateStudent(id, data) {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) { students[idx] = { ...students[idx], ...data }; this.saveCollection('students', students); return students[idx]; }
    return null;
  },
  deleteStudent(id) { this.saveCollection('students', this.getStudents().filter(s => s.id !== id)); },
  getStudentById(id) { return this.getStudents().find(s => s.id === id); },

  getTeachers() { return this.getCollection('teachers'); },
  getTeacherById(id) { return this.getTeachers().find(t => t.id === id); },
  getTeacherByClass(className) { return this.getTeachers().find(t => t.class === className); },
  addTeacher(teacher) {
    const teachers = this.getTeachers();
    if (teachers.find(t => t.id === teacher.id)) return { error: `Teacher ID ${teacher.id} already exists` };
    if (teachers.find(t => t.class === teacher.class)) return { error: `Class ${teacher.class} already has a teacher assigned` };
    teachers.push(teacher); this.saveCollection('teachers', teachers);
    return { success: true, teacher };
  },
  updateTeacher(id, data) {
    const teachers = this.getTeachers();
    const idx = teachers.findIndex(t => t.id === id);
    if (idx !== -1) { teachers[idx] = { ...teachers[idx], ...data }; this.saveCollection('teachers', teachers); return teachers[idx]; }
    return null;
  },
  deleteTeacher(id) { this.saveCollection('teachers', this.getTeachers().filter(t => t.id !== id)); },

  getClasses() { return this.getCollection('classes'); },

  // ======================== TEACHER ATTENDANCE (New: Time Slot System) ========================
  getTeacherAttendance() { return this.getCollection('teacher_attendance'); },
  markTeacherAttendance(record) {
    const attendance = this.getTeacherAttendance();
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].slice(0, 5);
    const timestamp = now.toISOString();
    // Determine session based on current time
    const session = this._getCurrentSession(time);
    if (!session) return { error: 'Waqtiga shaqada ma aha (Subax 06:30, Barqo 09:30, Galab 14:30)' };
    // Check if already marked for this session today
    const existing = attendance.find(a => a.teacherId === record.teacherId && a.date === date && a.session === session.key);
    if (existing) return { error: `Waxaad hore ugu diiwaangashanayd ${session.label} maanta`, record: existing };
    // Determine status
    const status = (time <= session.lateAfter) ? 'WAQTIGIISA YIMID' : 'SOO DAAHAY';
    const entry = {
      teacherId: record.teacherId, teacherName: record.teacherName,
      className: record.className, date, time, session: session.key,
      status, timestamp
    };
    attendance.push(entry);
    this.saveCollection('teacher_attendance', attendance);
    return { success: true, entry };
  },
  _getCurrentSession(time) {
    const sessions = this._sessions;
    if (time >= '06:00' && time <= '08:00') return { key: 'subax', ...sessions.subax };
    if (time >= '09:00' && time <= '11:00') return { key: 'barqo', ...sessions.barqo };
    if (time >= '14:00' && time <= '16:00') return { key: 'galab', ...sessions.galab };
    return null;
  },
  getTeacherAttendanceByDate(date) { return this.getTeacherAttendance().filter(a => a.date === date); },
  getTeacherAttendanceByTeacher(teacherId) { return this.getTeacherAttendance().filter(a => a.teacherId === teacherId); },
  getTeacherAttendanceByTeacherAndDate(teacherId, date) { return this.getTeacherAttendance().filter(a => a.teacherId === teacherId && a.date === date); },
  getTeacherAttendanceStats(month, year) {
    const all = this.getTeacherAttendance();
    let filtered = all;
    if (month !== undefined && year !== undefined) {
      filtered = all.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
    }
    return {
      joogay: filtered.filter(a => a.status === 'WAQTIGIISA YIMID' || a.status === 'SOO DAAHAY').length,
      waqtigii: filtered.filter(a => a.status === 'WAQTIGIISA YIMID').length,
      sooDaahay: filtered.filter(a => a.status === 'SOO DAAHAY').length,
      total: filtered.length
    };
  },

  // ======================== STUDENT ATTENDANCE ========================
  getStudentAttendance() { return this.getCollection('student_attendance'); },
  markStudentAttendance(records) {
    const attendance = this.getStudentAttendance();
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].slice(0, 5);
    records.forEach(r => { r.date = date; r.time = time; r.timestamp = now.toISOString(); attendance.push(r); });
    this.saveCollection('student_attendance', attendance);
    return records;
  },
  getStudentAttendanceByDate(date) { return this.getStudentAttendance().filter(a => a.date === date); },
  getStudentAttendanceByStudent(studentId) { return this.getStudentAttendance().filter(a => a.studentId === studentId); },
  getStudentAttendanceByClass(className) { return this.getStudentAttendance().filter(a => a.class === className); },
  getStudentAttendanceStats(date, className) {
    let records = this.getStudentAttendance();
    if (date) records = records.filter(a => a.date === date);
    if (className) records = records.filter(a => a.class === className);
    return {
      total: records.length,
      present: records.filter(a => a.status === 'present').length,
      absent: records.filter(a => a.status === 'absent').length,
      leave: records.filter(a => a.status === 'leave').length,
      records
    };
  },
  getStudentAttendancePercentage(studentId) {
    const records = this.getStudentAttendanceByStudent(studentId);
    if (records.length === 0) return { percentage: 0, present: 0, total: 0, absent: 0, leave: 0 };
    const present = records.filter(a => a.status === 'present').length;
    const absent = records.filter(a => a.status === 'absent').length;
    const leave = records.filter(a => a.status === 'leave').length;
    return { percentage: Math.round((present / records.length) * 100), present, total: records.length, absent, leave };
  },

  // ======================== FINANCE ========================
  getPayments() { return this.getCollection('payments'); },
  addPayment(payment) {
    const payments = this.getPayments();
    const duplicate = payments.find(p => p.studentId === payment.studentId && p.date === payment.date && Number(p.amount) === Number(payment.amount));
    if (duplicate) return { error: 'Duplicate payment record: same student, date, and amount already exists' };
    payment.id = `PAY${String(payments.length + 1).padStart(4, '0')}`;
    payment.timestamp = new Date().toISOString();
    payments.push(payment); this.saveCollection('payments', payments);
    return { success: true, payment };
  },
  getPaymentsByDate(date) { return this.getPayments().filter(p => p.date === date); },
  getPaymentsByStudent(studentId) { return this.getPayments().filter(p => p.studentId === studentId); },
  getPaymentsByStudentAndMonth(studentId, month, year) {
    return this.getPayments().filter(p => {
      if (p.studentId !== studentId) return false;
      const d = new Date(p.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  },
  getFinanceStats(period) {
    const payments = this.getPayments();
    const now = new Date();
    let filtered = payments;
    if (period === 'daily') { const today = now.toISOString().split('T')[0]; filtered = payments.filter(p => p.date === today); }
    else if (period === 'weekly') { const wa = new Date(now); wa.setDate(wa.getDate() - 7); filtered = payments.filter(p => p.date >= wa.toISOString().split('T')[0]); }
    else if (period === 'monthly') { const ma = new Date(now); ma.setDate(ma.getDate() - 30); filtered = payments.filter(p => p.date >= ma.toISOString().split('T')[0]); }
    const total = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
    const byDate = {};
    filtered.forEach(p => { byDate[p.date] = (byDate[p.date] || 0) + Number(p.amount); });
    return { total, count: filtered.length, records: filtered, byDate };
  },

  getManager() { return JSON.parse(localStorage.getItem(this._prefix + 'manager')); },
  getLateTime() { return localStorage.getItem(this._prefix + 'late_time') || '06:30'; },
  setLateTime(time) { localStorage.setItem(this._prefix + 'late_time', time); }
};

const Auth = {
  login(username, password, role) {
    if (role === 'manager') {
      const manager = DB.getManager();
      if (username === manager.username && password === manager.password) {
        const session = { ...manager, role: 'manager' };
        localStorage.setItem(DB._prefix + 'session', JSON.stringify(session));
        return { success: true, user: session };
      }
      return { success: false, message: 'Login-ka waa qaldan yahay' };
    }
    if (role === 'teacher') {
      const teacher = DB.getTeachers().find(t => t.id === username && t.password === password);
      if (teacher) {
        const session = { ...teacher, role: 'teacher' };
        localStorage.setItem(DB._prefix + 'session', JSON.stringify(session));
        return { success: true, user: session };
      }
      return { success: false, message: 'Teacher ID-ga ama password-ka waa qaldan yahay' };
    }
    return { success: false, message: 'Doorasho aan sax ahayn' };
  },
  logout() { localStorage.removeItem(DB._prefix + 'session'); },
  getCurrentUser() { const s = localStorage.getItem(DB._prefix + 'session'); return s ? JSON.parse(s) : null; },
  isAuthenticated() { return this.getCurrentUser() !== null; },
  requireAuth(role) {
    const user = this.getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return false; }
    if (role && user.role !== role) {
      if (user.role === 'manager') window.location.href = 'manager-dashboard.html';
      else if (user.role === 'teacher') window.location.href = 'teacher-dashboard.html';
      return false;
    }
    return true;
  },
  checkAuth() {
    const user = this.getCurrentUser();
    const path = window.location.pathname;
    if (user) {
      if (path.includes('login.html')) {
        if (user.role === 'manager') window.location.href = 'manager-dashboard.html';
        else if (user.role === 'teacher') window.location.href = 'teacher-dashboard.html';
        return null;
      }
      return user;
    }
    if (!path.includes('login.html') && !path.includes('index.html') && !path.includes('about.html') && !path.includes('contact.html') && !path.endsWith('/')) {
      window.location.href = 'login.html';
      return null;
    }
    return null;
  }
};

const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  formatTime(timeStr) {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  },
  formatCurrency(amount) {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  generateId(prefix, existingIds) {
    let num = existingIds ? existingIds.length + 1 : 1;
    while (existingIds && existingIds.includes(`${prefix}${String(num).padStart(4, '0')}`)) num++;
    return `${prefix}${String(num).padStart(4, '0')}`;
  },
  getToday() { return new Date().toISOString().split('T')[0]; },
  getCurrentTime() { return new Date().toTimeString().split(' ')[0].slice(0, 5); },
  getMonthName(m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m]; },
  sessionLabel(s) { return { subax: 'Subax', barqo: 'Barqo', galab: 'Galab' }[s] || s; },
  showToast(message, type = 'success') {
    const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 ${colors[type] || 'bg-green-500'} text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3000);
  }
};

DB.init();
