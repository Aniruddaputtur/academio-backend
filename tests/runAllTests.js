import http from 'http';
import { app } from '../src/app.js';
import { prisma, checkDatabaseHealth } from '../src/config/database.js';

let server;
const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('====================================================');
  console.log('🧪 STARTING ACADEMIO BACKEND AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // Start HTTP server and wait for listening event
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Test Harness] Server listening at ${BASE_URL}\n`);
      resolve();
    });
  });

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
      failedTests++;
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    }
  };

  try {
    // ----------------------------------------------------
    // 1. Database & Persistence Tests
    // ----------------------------------------------------
    console.log('[GROUP 1] Database & Prisma SQLite Persistence:');
    
    await test('SQLite raw query connectivity', async () => {
      const res = await prisma.$queryRawUnsafe('SELECT 1 as result;');
      if (!res || res.length === 0 || Number(res[0].result) !== 1) {
        throw new Error('Raw query failed');
      }
    });

    await test('Database health check passes', async () => {
      const health = await checkDatabaseHealth();
      if (!health.connected) throw new Error(health.message);
    });

    await test('Colleges exist and seed count is correct', async () => {
      const count = await prisma.college.count();
      if (count < 2) throw new Error(`Expected at least 2 colleges, got ${count}`);
    });

    await test('Students, users, and enrollments properly linked', async () => {
      const student = await prisma.student.findUnique({
        where: { usn: '1RV22CS084' },
        include: { user: true, college: true, enrollments: true }
      });
      if (!student) throw new Error('Student 1RV22CS084 not found');
      if (student.user.email !== 'rahul.cs22@rvce.edu.in') throw new Error('User relationship mismatch');
      if (student.enrollments.length === 0) throw new Error('Student has no enrollments');
    });

    // ----------------------------------------------------
    // 2. Health & Base Endpoints
    // ----------------------------------------------------
    console.log('\n[GROUP 2] Health & Base Endpoints:');

    await test('GET / returns service metadata', async () => {
      const res = await fetch(`${BASE_URL}/`);
      const data = await res.json();
      if (res.status !== 200 || data.name !== 'Academio API Platform') {
        throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
      }
    });

    await test('GET /api/health returns healthy SQLite status', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const data = await res.json();
      if (res.status !== 200 || data.status !== 'healthy' || !data.database.connected) {
        throw new Error(`Health check failed: ${JSON.stringify(data)}`);
      }
    });

    // ----------------------------------------------------
    // 3. Authentication Tests
    // ----------------------------------------------------
    console.log('\n[GROUP 3] Authentication & JWT Tests:');

    let adminToken, teacherToken, studentToken, student2Token;

    await test('POST /api/auth/login fails on missing credentials', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('POST /api/auth/login fails on wrong password', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@college.edu', password: 'WrongPassword123' })
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('POST /api/auth/login succeeds for Admin with bcrypt verification', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@college.edu', password: 'Academio@123' })
      });
      const data = await res.json();
      if (res.status !== 200 || !data.token || data.user.role !== 'ADMIN') {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
      }
      adminToken = data.token;
    });

    await test('POST /api/auth/login succeeds for Teacher', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ananya.sharma@rvce.edu.in', password: 'Academio@123' })
      });
      const data = await res.json();
      if (res.status !== 200 || !data.token || data.user.role !== 'TEACHER') {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
      }
      teacherToken = data.token;
    });

    await test('POST /api/auth/login succeeds for Student 1 (Rahul)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rahul.cs22@rvce.edu.in', password: 'Academio@123' })
      });
      const data = await res.json();
      if (res.status !== 200 || !data.token || data.user.role !== 'STUDENT') {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
      }
      studentToken = data.token;
    });

    await test('POST /api/auth/login succeeds for Student 2 (Karthik)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'karthik.cs22@rvce.edu.in', password: 'Academio@123' })
      });
      const data = await res.json();
      if (res.status !== 200 || !data.token) {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
      }
      student2Token = data.token;
    });

    await test('GET /api/auth/me returns user profile with verified token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.user.email !== 'rahul.cs22@rvce.edu.in') {
        throw new Error(`Failed to get profile: ${JSON.stringify(data)}`);
      }
    });

    await test('GET /api/auth/me rejects invalid token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' }
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // ----------------------------------------------------
    // 4. Role-Based Access Control (RBAC) Tests
    // ----------------------------------------------------
    console.log('\n[GROUP 4] Role-Based Access Control & Ownership Tests:');

    await test('Student CANNOT create a College (Admin only)', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/colleges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ name: 'Hacked College', code: 'HACK' })
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Student CANNOT post announcements (Faculty/Admin only)', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          collegeId: 'any',
          title: 'Fake Announcement',
          content: 'No classes today'
        })
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Student CANNOT resolve academic alerts', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/alerts/fake-id/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ notes: 'Self resolved' })
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Student CANNOT update internal marks', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/internal-marks/fake-id`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ totalIAMarks: 50 })
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await test('Student only retrieves their own alerts', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/alerts`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200) throw new Error(`Failed to fetch alerts`);
      // Rahul has 0 alerts, Karthik has 1 alert
      if (data.data.length !== 0) {
        throw new Error(`Expected 0 alerts for Rahul, got ${data.data.length}`);
      }
    });

    // ----------------------------------------------------
    // 5. Academic Modules & Operations Tests
    // ----------------------------------------------------
    console.log('\n[GROUP 5] Academic Modules & CRUD Tests:');

    await test('GET /api/academic/colleges lists colleges', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/colleges`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.count < 2) throw new Error(`Failed to list colleges`);
    });

    await test('GET /api/academic/departments lists departments', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/departments`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.count < 1) throw new Error(`Failed to list departments`);
    });

    await test('GET /api/academic/academic-years returns academic years', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/academic-years`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.count < 1) throw new Error(`Failed to list academic years`);
    });

    await test('GET /api/academic/semesters returns semesters', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/semesters`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.count < 1) throw new Error(`Failed to list semesters`);
    });

    await test('GET /api/academic/classes returns authorized classes', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/classes`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.data.length !== 1) throw new Error(`Expected 1 enrolled class`);
    });

    await test('GET /api/academic/assignments returns assignments', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/assignments`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.data.length < 1) throw new Error(`Expected at least 1 assignment`);
    });

    let createdAssignmentId;
    await test('Teacher can create an assignment', async () => {
      const classes = await prisma.class.findMany();
      const subjects = await prisma.subject.findMany();
      const res = await fetch(`${BASE_URL}/api/academic/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          classId: classes[0].id,
          subjectId: subjects[0].id,
          title: 'Automated Test Assignment',
          description: 'Testing assignment creation in SQLite',
          maxMarks: 25,
          dueDate: '2026-12-15'
        })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Creation failed: ${JSON.stringify(data)}`);
      createdAssignmentId = data.data.id;
    });

    await test('Student can submit assignment', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/assignments/${createdAssignmentId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          content: 'My test submission text content for the assignment'
        })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Submission failed: ${JSON.stringify(data)}`);
    });

    let createdExamId;
    await test('Teacher can create an Exam', async () => {
      const subjects = await prisma.subject.findMany();
      const res = await fetch(`${BASE_URL}/api/academic/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          subjectId: subjects[0].id,
          name: 'Midterm Evaluation Exam',
          examDate: '2026-11-25',
          maxMarks: 100,
          passingMarks: 40
        })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Exam creation failed: ${JSON.stringify(data)}`);
      createdExamId = data.data.id;
    });

    await test('Student CANNOT record exam grades (Teacher/Admin only)', async () => {
      const student = await prisma.student.findFirst({ where: { usn: '1RV22CS084' } });
      const res = await fetch(`${BASE_URL}/api/academic/grades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          examId: createdExamId,
          studentId: student.id,
          marksObtained: 92,
          gradeLetter: 'S'
        })
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await test('Teacher can record an exam grade', async () => {
      const student = await prisma.student.findFirst({ where: { usn: '1RV22CS084' } });
      const res = await fetch(`${BASE_URL}/api/academic/grades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          examId: createdExamId,
          studentId: student.id,
          marksObtained: 92,
          gradeLetter: 'S'
        })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Grade recording failed: ${JSON.stringify(data)}`);
    });

    await test('Teacher can send a mass notification', async () => {
      const studentUser = await prisma.user.findUnique({ where: { email: 'rahul.cs22@rvce.edu.in' } });
      const res = await fetch(`${BASE_URL}/api/academic/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          title: 'Class Notice: Lab schedule change',
          message: 'Tomorrow lab session will start at 10 AM',
          recipientUserIds: [studentUser.id]
        })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Notification failed: ${JSON.stringify(data)}`);
    });

    await test('Student can view their notifications', async () => {
      const res = await fetch(`${BASE_URL}/api/academic/notifications`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.data.length < 1) throw new Error('Expected at least 1 notification');
    });

    // ----------------------------------------------------
    // 6. Academio AI Chatbot & Ownership Tests
    // ----------------------------------------------------
    console.log('\n[GROUP 6] Academio AI Chatbot Tests:');

    let studentConvId;

    await test('POST /api/ai/conversations creates a new conversation', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ title: 'Student AI Study Chat' })
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data.id) throw new Error(`Failed to create conversation`);
      studentConvId = data.data.id;
    });

    await test('POST /api/ai/chat processes message and saves to SQLite history', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          conversationId: studentConvId,
          message: 'What is my current overall attendance and do I have any academic alerts?'
        })
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.assistantMessage) {
        throw new Error(`Chat request failed: ${JSON.stringify(data)}`);
      }
    });

    await test('GET /api/ai/history returns conversation list for user', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/history`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.count === 0) throw new Error('History list empty');
    });

    await test('GET /api/ai/conversations/:id returns message history', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/conversations/${studentConvId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || data.data.messages.length < 2) {
        throw new Error(`Expected saved messages in SQLite`);
      }
    });

    await test('Cross-user conversation access is strictly DENIED (Student 2 cannot view Student 1 chat)', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/conversations/${studentConvId}`, {
        headers: { Authorization: `Bearer ${student2Token}` }
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    await test('Cross-user conversation deletion is strictly DENIED', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/conversations/${studentConvId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${student2Token}` }
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    await test('Owner CAN delete their own conversation', async () => {
      const res = await fetch(`${BASE_URL}/api/ai/conversations/${studentConvId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const data = await res.json();
      if (res.status !== 200 || !data.success) {
        throw new Error(`Deletion failed: ${JSON.stringify(data)}`);
      }
    });

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`📊 TEST SUITE FINISHED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  } catch (globalError) {
    console.error('Fatal test error:', globalError);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests();
