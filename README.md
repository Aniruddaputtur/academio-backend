# ACADEMIO API BACKEND DOCUMENTATION

## 1. Overview
The Academio backend is an independent, headless academic ERP and AI advising service built with Express.js (ES Modules), SQLite with Prisma ORM, and the official OpenAI SDK.

It is decoupled from any specific frontend and ready to serve web, mobile, or third-party systems through standard REST endpoints with JSON payloads.

---

## 2. Windows PowerShell Setup & Execution Commands

### Prerequisites
* Node.js v18+ (tested on Node.js v24)
* npm (bundled with Node)

### A. Navigate to Backend Directory
```powershell
Set-Location "c:\Users\dell\OneDrive\Desktop\collage pro\College-AI\backend"
```

### B. Install Dependencies
```powershell
npm install
```

### C. Environment Configuration
Copy `.env.example` to `.env` (or configure `.env` directly):
```powershell
Copy-Item .env.example .env
```
Ensure `.env` contains:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
JWT_SECRET=your_super_secure_jwt_secret_key_here
OPENAI_API_KEY=sk-... # Optional: add your OpenAI key to enable live AI responses
OPENAI_MODEL=gpt-4o-mini
```

### D. Generate Prisma Client & Run Migrations
```powershell
npx prisma generate
npx prisma migrate dev --name init
```

### E. Seed Initial Academic Database
Seeds default users (Admin, Faculty, Students), colleges (RVCE, BMSCE), classes, subjects, internal marks, and alerts:
```powershell
node prisma/seed.js
```

### F. Run Test Suite
Executes the comprehensive 32-test automated suite (authentication, RBAC, CRUD, AI conversation ownership):
```powershell
node tests/runAllTests.js
```

### G. Start Development Server
```powershell
npm run dev
```

### H. Start Production Server
```powershell
npm start
```

### I. Check Health
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get
```

### J. Database Backup & Restore
Backup SQLite database:
```powershell
Copy-Item "prisma\dev.db" "backups\dev_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
```
Restore SQLite database:
```powershell
Copy-Item "backups\your_backup_file.db" "prisma\dev.db" -Force
```

---

## 3. Seed Credentials & Roles

All seeded accounts use password: `Academio@123`

| Name | Email | Role | Accessible Scope |
|---|---|---|---|
| Rehan (Platform Admin) | `admin@college.edu` | `ADMIN` | System-wide admin, all colleges, classes, audit metrics |
| Dr. K. Srinivas | `srinivas.k@rvce.edu.in` | `CLASS_TEACHER` | Assigned 5th Sem CSE Class A, TOC Subject |
| Prof. Ananya Sharma | `ananya.sharma@rvce.edu.in` | `TEACHER` | Computer Networks Subject, Assignments |
| Rahul Sharma | `rahul.cs22@rvce.edu.in` | `STUDENT` | Self profile only, attendance (84.6%), marks, assignments |
| Karthik Gowda | `karthik.cs22@rvce.edu.in` | `STUDENT` | Self profile only, attendance alert (70.8%) |

---

## 4. API Endpoints Reference

### Authentication (`/api/auth`)
* `POST /api/auth/login` — Public. Returns JWT Bearer token and user payload.
* `POST /api/auth/register` — Public/Admin. Registers new user account.
* `GET /api/auth/me` — Authenticated (`STUDENT`, `TEACHER`, `CLASS_TEACHER`, `ADMIN`). Returns current user identity and linked profiles.

### Academic Management (`/api/academic`)
* `GET /api/academic/colleges` — Authenticated. Lists colleges.
* `POST /api/academic/colleges` — `ADMIN` only. Creates college.
* `GET /api/academic/departments` — Authenticated. Lists departments.
* `GET /api/academic/courses` — Authenticated. Lists courses.
* `GET /api/academic/classes` — Authenticated (scoped by role).
* `GET /api/academic/subjects` — Authenticated. Lists subjects.
* `GET /api/academic/students` — Authenticated (Students see only themselves; Faculty see assigned classes).
* `GET /api/academic/students/:id` — Authenticated (ownership enforced).
* `GET /api/academic/teachers` — Authenticated.
* `GET /api/academic/attendance` — Authenticated (Students see only themselves).
* `POST /api/academic/attendance/session` — `TEACHER`, `CLASS_TEACHER`, `ADMIN`. Records attendance session and auto-updates student attendance %.
* `GET /api/academic/assignments` — Authenticated (scoped by class).
* `POST /api/academic/assignments` — `TEACHER`, `CLASS_TEACHER`, `ADMIN`. Creates assignment.
* `POST /api/academic/assignments/:id/submit` — `STUDENT` only. Submits work.
* `GET /api/academic/internal-marks` — Authenticated (Students see only themselves).
* `PATCH /api/academic/internal-marks/:id` — `TEACHER`, `CLASS_TEACHER`, `ADMIN`. Modifies IA marks.
* `GET /api/academic/alerts` — Authenticated (Students see only their own alerts).
* `PATCH /api/academic/alerts/:id/resolve` — `TEACHER`, `CLASS_TEACHER`, `ADMIN`. Resolves alert.
* `GET /api/academic/announcements` — Authenticated (filtered by role).
* `POST /api/academic/announcements` — `TEACHER`, `CLASS_TEACHER`, `ADMIN`. Publishes announcements.

### Academio AI Chatbot (`/api/ai`)
* `POST /api/ai/chat` — Authenticated. Rate-limited (20/min). Sends prompt to Academio AI with role-aware verified context. Persists conversation and assistant replies in SQLite.
* `GET /api/ai/history` — Authenticated. Lists conversations belonging to user.
* `POST /api/ai/conversations` — Authenticated. Creates new conversation session.
* `GET /api/ai/conversations/:id` — Authenticated (Strict ownership check: 403 Forbidden for other users).
* `DELETE /api/ai/conversations/:id` — Authenticated (Strict ownership check).

