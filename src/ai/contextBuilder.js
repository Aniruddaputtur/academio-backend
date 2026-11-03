import { prisma } from '../config/database.js';

/**
 * Role-Aware Context Builder:
 * Fetches strictly authorized academic records from SQLite based on verified user identity and role.
 * Sanitizes and strips sensitive data (passwords, tokens, internal IDs).
 */
export class ContextBuilder {
  static async buildContextForUser(user) {
    const role = user.role;
    const context = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    };

    if (role === 'STUDENT') {
      // 1. Fetch Student Profile
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        include: {
          college: { select: { name: true, code: true } },
          enrollments: { include: { class: true } }
        }
      });

      if (!student) {
        context.academicProfile = 'No active student profile linked to this account.';
        return context;
      }

      context.student = {
        usn: student.usn,
        college: student.college?.name,
        branch: student.branch,
        mentor: student.mentorName,
        overallAttendance: `${student.overallAttendance}% (${student.totalClassesAttended}/${student.totalClassesHeld} classes attended)`,
        enrolledClass: student.enrollments[0]?.class?.name || 'Unassigned'
      };

      // 2. Attendance Summary
      const attendance = await prisma.attendance.findMany({
        where: { studentId: student.id },
        include: {
          session: {
            include: { subject: { select: { code: true, name: true } } }
          }
        },
        take: 10,
        orderBy: { session: { sessionDate: 'desc' } }
      });
      context.recentAttendance = attendance.map(a => ({
        subject: `${a.session.subject.name} (${a.session.subject.code})`,
        status: a.status,
        date: a.session.sessionDate.toISOString().split('T')[0]
      }));

      // 3. Internal Marks
      const marks = await prisma.internalMarks.findMany({
        where: { studentId: student.id },
        include: { subject: { select: { code: true, name: true } } }
      });
      context.internalMarks = marks.map(m => ({
        subject: `${m.subject.name} (${m.subject.code})`,
        ia1: m.ia1Marks,
        ia2: m.ia2Marks,
        ia3: m.ia3Marks,
        assignment: m.assignmentMarks,
        total: m.totalIAMarks
      }));

      // 4. Assignments & Submissions
      const assignments = await prisma.assignment.findMany({
        where: {
          class: { enrollments: { some: { studentId: student.id } } }
        },
        include: {
          subject: { select: { name: true, code: true } },
          submissions: { where: { studentId: student.id } }
        }
      });
      context.assignments = assignments.map(asg => ({
        title: asg.title,
        subject: asg.subject.name,
        dueDate: asg.dueDate.toISOString().split('T')[0],
        maxMarks: asg.maxMarks,
        submissionStatus: asg.submissions.length > 0 ? asg.submissions[0].status : 'Pending',
        marksObtained: asg.submissions[0]?.marksObtained ?? 'Not Graded'
      }));

      // 5. Academic Alerts
      const alerts = await prisma.academicAlert.findMany({
        where: { studentId: student.id },
        select: { title: true, reason: true, severity: true, status: true, recommendedAction: true }
      });
      context.academicAlerts = alerts;

      // 6. Announcements
      const announcements = await prisma.announcement.findMany({
        where: { targetRole: { in: ['all', 'students'] } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { title: true, content: true, priority: true, category: true }
      });
      context.recentAnnouncements = announcements;
    } else if (role === 'TEACHER' || role === 'CLASS_TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        include: {
          college: { select: { name: true } },
          department: { select: { name: true } },
          classTeacherOf: { include: { class: true } },
          assignmentsTaught: { include: { class: true, subject: true } }
        }
      });

      if (!teacher) {
        context.teacherProfile = 'No active faculty profile linked.';
        return context;
      }

      context.faculty = {
        college: teacher.college?.name,
        department: teacher.department?.name,
        designation: teacher.designation,
        classTeacherFor: teacher.classTeacherOf.map(c => c.class.name),
        teachingSubjects: teacher.assignmentsTaught.map(t => `${t.subject.name} (${t.class.name})`)
      };

      // Assigned Classes alerts
      const classIds = [
        ...teacher.classTeacherOf.map(c => c.classId),
        ...teacher.assignmentsTaught.map(t => t.classId)
      ];

      const alerts = await prisma.academicAlert.findMany({
        where: { classId: { in: classIds } },
        include: {
          student: { include: { user: { select: { name: true } } } },
          subject: { select: { name: true } }
        },
        take: 10
      });
      context.classAlerts = alerts.map(a => ({
        studentName: a.student.user.name,
        subject: a.subject?.name,
        severity: a.severity,
        title: a.title,
        status: a.status
      }));

      const announcements = await prisma.announcement.findMany({
        where: { targetRole: { in: ['all', 'teachers'] } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { title: true, content: true, priority: true }
      });
      context.recentAnnouncements = announcements;
    } else if (role === 'ADMIN') {
      // Platform-wide overview
      const totalColleges = await prisma.college.count();
      const totalStudents = await prisma.student.count();
      const totalTeachers = await prisma.teacher.count();
      const activeAlerts = await prisma.academicAlert.count({ where: { status: 'open' } });

      context.adminMetrics = {
        totalColleges,
        totalStudents,
        totalTeachers,
        openCriticalAlerts: activeAlerts
      };

      const colleges = await prisma.college.findMany({
        select: { name: true, code: true, affiliation: true }
      });
      context.colleges = colleges;
    }

    return context;
  }
}

