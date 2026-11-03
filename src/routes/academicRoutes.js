import express from 'express';
import { AcademicService } from '../services/academicService.js';
import { authenticate, authorize } from '../middleware/authAndError.js';
import {
  validateBody,
  createCollegeSchema,
  createAssignmentSchema,
  submitAssignmentSchema,
  createAnnouncementSchema
} from '../validators/schemas.js';

export const academicRouter = express.Router();

// All academic routes require authenticated users
academicRouter.use(authenticate);

// ----------------------------------------------------
// Colleges
// ----------------------------------------------------
academicRouter.get('/colleges', async (req, res, next) => {
  try {
    const colleges = await AcademicService.getColleges();
    res.json({ success: true, count: colleges.length, data: colleges });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/colleges/:id', async (req, res, next) => {
  try {
    const college = await AcademicService.getCollegeById(req.params.id);
    res.json({ success: true, data: college });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/colleges', authorize(['ADMIN']), validateBody(createCollegeSchema), async (req, res, next) => {
  try {
    const college = await AcademicService.createCollege(req.body);
    res.status(201).json({ success: true, data: college });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Departments & Courses
// ----------------------------------------------------
academicRouter.get('/departments', async (req, res, next) => {
  try {
    const depts = await AcademicService.getDepartments(req.query.collegeId);
    res.json({ success: true, count: depts.length, data: depts });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/courses', async (req, res, next) => {
  try {
    const courses = await AcademicService.getCourses(req.query.departmentId);
    res.json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    next(error);
  }
});

// Academic Years & Semesters
academicRouter.get('/academic-years', async (req, res, next) => {
  try {
    const years = await AcademicService.getAcademicYears(req.query.collegeId);
    res.json({ success: true, count: years.length, data: years });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/semesters', async (req, res, next) => {
  try {
    const semesters = await AcademicService.getSemesters(req.query.courseId);
    res.json({ success: true, count: semesters.length, data: semesters });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Classes & Subjects
// ----------------------------------------------------
academicRouter.get('/classes', async (req, res, next) => {
  try {
    const classes = await AcademicService.getClasses(req.user);
    res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/subjects', async (req, res, next) => {
  try {
    const subjects = await AcademicService.getSubjects(req.query.semesterId);
    res.json({ success: true, count: subjects.length, data: subjects });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Students
// ----------------------------------------------------
academicRouter.get('/students', async (req, res, next) => {
  try {
    const students = await AcademicService.getStudents(req.user, req.query);
    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/students/:id', async (req, res, next) => {
  try {
    const student = await AcademicService.getStudentById(req.user, req.params.id);
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Teachers
// ----------------------------------------------------
academicRouter.get('/teachers', async (req, res, next) => {
  try {
    const teachers = await AcademicService.getTeachers(req.query.collegeId);
    res.json({ success: true, count: teachers.length, data: teachers });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Attendance
// ----------------------------------------------------
academicRouter.get('/attendance', async (req, res, next) => {
  try {
    const records = await AcademicService.getAttendanceRecords(req.user, req.query);
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/attendance/session', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const session = await AcademicService.recordAttendanceSession(req.user, req.body);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Assignments & Submissions
// ----------------------------------------------------
academicRouter.get('/assignments', async (req, res, next) => {
  try {
    const assignments = await AcademicService.getAssignments(req.user, req.query.classId);
    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/assignments', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), validateBody(createAssignmentSchema), async (req, res, next) => {
  try {
    const assignment = await AcademicService.createAssignment(req.user, req.body);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/assignments/:id/submit', authorize(['STUDENT']), validateBody(submitAssignmentSchema), async (req, res, next) => {
  try {
    const submission = await AcademicService.submitAssignment(req.user, req.params.id, req.body);
    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Internal Marks
// ----------------------------------------------------
academicRouter.get('/internal-marks', async (req, res, next) => {
  try {
    const marks = await AcademicService.getInternalMarks(req.user, req.query.studentId);
    res.json({ success: true, count: marks.length, data: marks });
  } catch (error) {
    next(error);
  }
});

academicRouter.patch('/internal-marks/:id', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const updated = await AcademicService.updateInternalMarks(req.user, req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Academic Alerts
// ----------------------------------------------------
academicRouter.get('/alerts', async (req, res, next) => {
  try {
    const alerts = await AcademicService.getAlerts(req.user);
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    next(error);
  }
});

academicRouter.patch('/alerts/:id/resolve', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const alert = await AcademicService.resolveAlert(req.user, req.params.id, req.body.notes);
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Announcements
// ----------------------------------------------------
academicRouter.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await AcademicService.getAnnouncements(req.user);
    res.json({ success: true, count: announcements.length, data: announcements });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/announcements', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), validateBody(createAnnouncementSchema), async (req, res, next) => {
  try {
    const announcement = await AcademicService.createAnnouncement(req.user, req.body);
    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Notifications
// ----------------------------------------------------
academicRouter.get('/notifications', async (req, res, next) => {
  try {
    const notifs = await AcademicService.getNotifications(req.user);
    res.json({ success: true, count: notifs.length, data: notifs });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/notifications', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const notif = await AcademicService.sendNotification(req.user, req.body);
    res.status(201).json({ success: true, data: notif });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// Exams & Grades
// ----------------------------------------------------
academicRouter.get('/exams', async (req, res, next) => {
  try {
    const exams = await AcademicService.getExams(req.query.subjectId);
    res.json({ success: true, count: exams.length, data: exams });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/exams', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const exam = await AcademicService.createExam(req.user, req.body);
    res.status(201).json({ success: true, data: exam });
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/grades', async (req, res, next) => {
  try {
    const grades = await AcademicService.getGrades(req.user, req.query.examId);
    res.json({ success: true, count: grades.length, data: grades });
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/grades', authorize(['TEACHER', 'CLASS_TEACHER', 'ADMIN']), async (req, res, next) => {
  try {
    const grade = await AcademicService.recordGrade(req.user, req.body);
    res.status(201).json({ success: true, data: grade });
  } catch (error) {
    next(error);
  }
});
