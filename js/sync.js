/**
 * Al-Furqaan Quran School - PostgreSQL Sync Client
 * Syncs localStorage data to Neon PostgreSQL for permanent storage
 */

const Sync = {
  _apiUrl: localStorage.getItem('furqaan_api_url') || '',

  setApiUrl(url) {
    this._apiUrl = url;
    localStorage.setItem('furqaan_api_url', url);
  },

  getApiUrl() {
    return this._apiUrl;
  },

  isConfigured() {
    return this._apiUrl.length > 0;
  },

  async isAvailable() {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this._apiUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return data.database === 'connected';
    } catch {
      return false;
    }
  },

  getToken() {
    // Check for explicit backend token first (set by login page)
    const backendToken = localStorage.getItem('furqaan_backend_token');
    if (backendToken) return backendToken;
    // Fallback to session token
    const session = localStorage.getItem('furqaan_session');
    if (!session) return null;
    try {
      return JSON.parse(session).token || null;
    } catch {
      return null;
    }
  },

  async request(method, path, body = null) {
    const token = this.getToken();
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000)
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${this._apiUrl}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  // Login via backend
  async login(username, password, role) {
    return this.request('POST', '/api/login', { username, password, role });
  },

  // Sync all data to PostgreSQL
  async syncAll() {
    const results = { students: 0, teachers: 0, payments: 0, teacherAttendance: 0, studentAttendance: 0 };

    // Sync students
    const students = DB.getStudents();
    for (const s of students) {
      try {
        await this.request('POST', '/api/students', {
          id: s.id, name: s.name, class: s.class, phone: s.phone,
          parent: s.parent, registrationDate: s.registrationDate, status: s.status
        });
        results.students++;
      } catch (e) {
        if (!e.message.includes('already exists')) console.error('Student sync error:', e);
        results.students++;
      }
    }

    // Sync teachers
    const teachers = DB.getTeachers();
    for (const t of teachers) {
      try {
        await this.request('POST', '/api/teachers', {
          id: t.id, name: t.name, password: t.password,
          class: t.class, phone: t.phone, email: t.email
        });
        results.teachers++;
      } catch (e) {
        if (!e.message.includes('already exists')) console.error('Teacher sync error:', e);
        results.teachers++;
      }
    }

    // Sync payments
    const payments = DB.getPayments();
    for (const p of payments) {
      try {
        await this.request('POST', '/api/payments', {
          studentId: p.studentId, studentName: p.studentName,
          className: p.className || '', amount: p.amount,
          date: p.date, recordedBy: p.recordedBy || 'Manager'
        });
        results.payments++;
      } catch (e) {
        if (!e.message.includes('Duplicate')) console.error('Payment sync error:', e);
        results.payments++;
      }
    }

    return results;
  },

  // Sync students from PostgreSQL back to localStorage
  async restoreFromBackend() {
    try {
      const students = await this.request('GET', '/api/students');
      if (students && students.length > 0) {
        localStorage.setItem('furqaan_students', JSON.stringify(students));
      }
      const teachers = await this.request('GET', '/api/teachers');
      if (teachers && teachers.length > 0) {
        localStorage.setItem('furqaan_teachers', JSON.stringify(teachers));
      }
      return { students: students?.length || 0, teachers: teachers?.length || 0 };
    } catch (e) {
      console.error('Restore error:', e);
      throw e;
    }
  }
};
