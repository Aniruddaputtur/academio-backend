import { prisma } from '../config/database.js';

export class AcademicService {
  // Colleges
  static async getColleges() {
    return prisma.college.findMany({
      include: {
        _count: {
          select: {
            departments: true,
            students: true,
            teachers: true
          }
        }
      }
    });
  }

  static async getCollegeById(id) {
    const college = await prisma.college.findUnique({
      where: { id },
      include: {
        departments: {
          include: {
            courses: true
          }
        },
        academicYears: true
      }
    });
    if (!college) {
      const err = new Error('College not found');
      err.statusCode = 404;
      throw err;
    }
    return college;
  }

  static async createCollege(data) {
    return prisma.college.create({ data });
  }

  // Departments
  static async getDepartments(collegeId) {
    return prisma.department.findMany({
      where: collegeId ? { collegeId } : {},
      include: {
        college: true,
        courses: true,
        _count: { select: { teachers: true, classes: true } }
      }
    });
  }

  // Courses
  static async getCourses(departmentId) {
    return prisma.course.findMany({
      where: departmentId ? { departmentId } : {},
      include: {
        department: true,
        semesters: true
      }
    });
  }

  // Academic Years
  static async getAcademicYears(collegeId) {
    return prisma.academicYear.findMany({
      where: collegeId ? { collegeId } : {},
      include: {
        college: true,
        _count: { select: { classes: true } }
      },
      orderBy: { year: 'desc' }
    });
  }

  // Semesters
  static async getSemesters(courseId) {
    return prisma.semester.findMany({
      where: courseId ? { courseId } : {},
      include: {
        course: true,
        _count: { select: { classes: true, subjects: true } }
      },
      orderBy: { number: 'asc' }
    });
  }

  // Classes
  static async getClasses(user) {
    // If Teacher/Class Teacher: show only assigned classes; If Admin: show all
    if (user.role === 'ADMIN') {
      return prisma.class.findMany({
        include: {
          department: true,
          semester: true,
          classTeacherAssignments: { include: { teacher: { include: { user: true } } } },
          _count: { select: { enrollments: true, assignments: true } }
        }
      });
    }

    if (user.role === 'CLASS_TEACHER' || user.role === 'TEACHER') {
      return prisma.class.findMany({
        where: {
          OR: [
            { classTeacherAssignments: { some: { teacher: { userId: user.id } } } },
            { teacherAssignments: { some: { teacher: { userId: user.id } } } }
          ]
        },
        include: {
          department: true,
          semester: true,
          classTeacherAssignments: { include: { teacher: { include: { user: true } } } },
          _count: { select: { enrollments: true, assignments: true } }
        }
      });
    }

    if (user.role === 'STUDENT') {
      return prisma.class.findMany({
        where: {
          enrollments: { some: { student: { userId: user.id } } }
        },
        include: {
          department: true,
          semester: true,
          classTeacherAssignments: { include: { teacher: { include: { user: true } } } }
        }
      });
    }

    return [];
  }

  // Subjects
  static async getSubjects(semesterId) {
    return prisma.subject.findMany({
      where: semesterId ? { semesterId } : {},
      include: {
        semester: true
      }
    });
  }

  // Students
  static async getStudents(user, query = {}) {
    const { classId, search } = query;
    const where = {};

    if (classId) {
      where.enrollments = { some: { classId } };
    }

    if (search) {
      where.OR = [
        { usn: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } }
      ];
    }

    // Role filtering: Student sees only their own profile
    if (user.role === 'STUDENT') {
      where.userId = user.id;
    } else if (user.role === 'TEACHER' || user.role === 'CLASS_TEACHER') {
      // Must belong to classes teacher teaches or is class teacher for
      where.enrollments = {
        some: {
          class: {
            OR: [
              { classTeacherAssignments: { some: { teacher: { userId: user.id } } } },
              { teacherAssignments: { some: { teacher: { userId: user.id } } } }
            ]
          }
        }
      };
    }

    return prisma.student.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, department: true }
        },
        college: { select: { id: true, name: true, code: true } },
        enrollments: {
          include: {
            class: true
          }
        },
        _count: {
          select: { alerts: true }
        }
      }
    });
  }

  static async getStudentById(user, studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        college: true,
        enrollments: { include: { class: true } },
        internalMarks: { include: { subject: true } },
        alerts: true,
        submissions: { include: { assignment: true } }
      }
    });

    if (!student) {
      const err = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    if (user.role === 'STUDENT' && student.userId !== user.id) {
      const err = new Error('Access denied. You can only view your own student profile.');
      err.statusCode = 403;
      throw err;
    }

    return student;
  }

  // Teachers
  static async getTeachers(collegeId) {
    return prisma.teacher.findMany({
      where: collegeId ? { collegeId } : {},
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, department: true } },
        college: { select: { id: true, name: true, code: true } },
        department: true,
        classTeacherOf: { include: { class: true } },
        assignmentsTaught: { include: { class: true, subject: true } }
      }
    });
  }

  // Attendance
  static async getAttendanceRecords(user, query = {}) {
    const { studentId, classId, subjectId } = query;
    const where = {};

    if (user.role === 'STUDENT') {
      where.student = { userId: user.id };
    } else if (studentId) {
      where.studentId = studentId;
    }

    if (classId || subjectId) {
      where.session = {};
      if (classId) where.session.classId = classId;
      if (subjectId) where.session.subjectId = subjectId;
    }

    return prisma.attendance.findMany({
      where,
      include: {
        session: {
          include: {
            class: true,
            subject: true,
            teacher: { include: { user: { select: { name: true } } } }
          }
        },
        student: {
          include: { user: { select: { name: true, email: true } } }
        }
      },
      orderBy: { session: { sessionDate: 'desc' } }
    });
  }

  static async recordAttendanceSession(user, data) {
    // Only TEACHER or CLASS_TEACHER or ADMIN can record attendance
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id }
    });

    if (user.role !== 'ADMIN' && !teacher) {
      const err = new Error('Only faculty can record attendance');
      err.statusCode = 403;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.create({
        data: {
          classId: data.classId,
          subjectId: data.subjectId,
          teacherId: teacher ? teacher.id : data.teacherId,
          topic: data.topic || null
        }
      });

      if (data.records && data.records.length > 0) {
        await tx.attendance.createMany({
          data: data.records.map(r => ({
            sessionId: session.id,
            studentId: r.studentId,
            status: r.status || 'PRESENT',
            remarks: r.remarks || null
          }))
        });

        // Recalculate attendance percentages for students
        for (const r of data.records) {
          const totalSessions = await tx.attendance.count({ where: { studentId: r.studentId } });
          const attended = await tx.attendance.count({
            where: { studentId: r.studentId, status: { in: ['PRESENT', 'EXCUSED'] } }
          });
          const percentage = totalSessions > 0 ? (attended / totalSessions) * 100 : 100.0;
          await tx.student.update({
            where: { id: r.studentId },
            data: {
              totalClassesHeld: totalSessions,
              totalClassesAttended: attended,
              overallAttendance: Math.round(percentage * 10) / 10
            }
          });
        }
      }

      return session;
    });
  }

  // Assignments
  static async getAssignments(user, classId) {
    const where = {};
    if (classId) where.classId = classId;

    if (user.role === 'STUDENT') {
      where.class = {
        enrollments: { some: { student: { userId: user.id } } }
      };
    }

    return prisma.assignment.findMany({
      where,
      include: {
        class: true,
        subject: true,
        teacher: { include: { user: { select: { name: true } } } },
        _count: { select: { submissions: true } }
      },
      orderBy: { dueDate: 'asc' }
    });
  }

  static async createAssignment(user, data) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
    if (user.role !== 'ADMIN' && !teacher) {
      const err = new Error('Only faculty can create assignments');
      err.statusCode = 403;
      throw err;
    }

    return prisma.assignment.create({
      data: {
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: teacher ? teacher.id : data.teacherId,
        title: data.title,
        description: data.description,
        maxMarks: data.maxMarks || 20,
        dueDate: new Date(data.dueDate)
      }
    });
  }

  static async submitAssignment(user, assignmentId, data) {
    if (user.role !== 'STUDENT') {
      const err = new Error('Only students can submit assignments');
      err.statusCode = 403;
      throw err;
    }

    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      const err = new Error('Student record not found');
      err.statusCode = 404;
      throw err;
    }

    return prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: student.id
        }
      },
      update: {
        content: data.content,
        fileUrl: data.fileUrl,
        submittedAt: new Date()
      },
      create: {
        assignmentId,
        studentId: student.id,
        content: data.content,
        fileUrl: data.fileUrl
      }
    });
  }

  // Internal Marks
  static async getInternalMarks(user, studentId) {
    const where = {};
    if (user.role === 'STUDENT') {
      where.student = { userId: user.id };
    } else if (studentId) {
      where.studentId = studentId;
    }

    return prisma.internalMarks.findMany({
      where,
      include: {
        subject: true,
        student: { include: { user: { select: { name: true, email: true } } } }
      }
    });
  }

  static async updateInternalMarks(user, id, data) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot modify internal marks');
      err.statusCode = 403;
      throw err;
    }

    return prisma.internalMarks.update({
      where: { id },
      data: {
        ia1Marks: data.ia1Marks,
        ia2Marks: data.ia2Marks,
        ia3Marks: data.ia3Marks,
        assignmentMarks: data.assignmentMarks,
        totalIAMarks: data.totalIAMarks
      }
    });
  }

  // Academic Alerts
  static async getAlerts(user) {
    const where = {};
    if (user.role === 'STUDENT') {
      where.student = { userId: user.id };
    }

    return prisma.academicAlert.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } }
          }
        },
        subject: true,
        college: { select: { name: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async resolveAlert(user, alertId, notes) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot resolve academic alerts');
      err.statusCode = 403;
      throw err;
    }

    return prisma.academicAlert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedById: user.id,
        resolvedAt: new Date(),
        resolutionNotes: notes || 'Resolved by faculty/admin'
      }
    });
  }

  // Announcements
  static async getAnnouncements(user) {
    const where = {};
    if (user.role === 'STUDENT') {
      where.targetRole = { in: ['all', 'students'] };
    } else if (user.role === 'TEACHER' || user.role === 'CLASS_TEACHER') {
      where.targetRole = { in: ['all', 'teachers'] };
    }

    return prisma.announcement.findMany({
      where,
      include: {
        author: { select: { name: true, role: true } },
        college: { select: { name: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createAnnouncement(user, data) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot post announcements');
      err.statusCode = 403;
      throw err;
    }

    return prisma.announcement.create({
      data: {
        collegeId: data.collegeId,
        authorId: user.id,
        title: data.title,
        content: data.content,
        targetRole: data.targetRole || 'all',
        priority: data.priority || 'medium',
        category: data.category || 'General'
      }
    });
  }

  // Notifications
  static async getNotifications(user) {
    return prisma.notificationRecipient.findMany({
      where: { userId: user.id },
      include: {
        notification: {
          include: { sender: { select: { name: true, role: true } } }
        }
      },
      orderBy: { notification: { createdAt: 'desc' } }
    });
  }

  static async sendNotification(user, data) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot send mass notifications');
      err.statusCode = 403;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const notif = await tx.notification.create({
        data: {
          senderId: user.id,
          title: data.title,
          message: data.message,
          type: data.type || 'info',
          link: data.link || null
        }
      });

      if (data.recipientUserIds && data.recipientUserIds.length > 0) {
        await tx.notificationRecipient.createMany({
          data: data.recipientUserIds.map(uid => ({
            notificationId: notif.id,
            userId: uid,
            read: false
          }))
        });
      }

      return notif;
    });
  }

  // Exams
  static async getExams(subjectId) {
    const where = subjectId ? { subjectId } : {};
    return prisma.exam.findMany({
      where,
      include: {
        subject: true,
        _count: { select: { grades: true } }
      },
      orderBy: { examDate: 'asc' }
    });
  }

  static async createExam(user, data) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot schedule exams');
      err.statusCode = 403;
      throw err;
    }

    return prisma.exam.create({
      data: {
        subjectId: data.subjectId,
        name: data.name,
        examDate: new Date(data.examDate),
        maxMarks: data.maxMarks || 100,
        passingMarks: data.passingMarks || 40
      }
    });
  }

  // Grades
  static async getGrades(user, examId) {
    const where = {};
    if (examId) where.examId = examId;

    if (user.role === 'STUDENT') {
      where.student = { userId: user.id };
    }

    return prisma.grade.findMany({
      where,
      include: {
        exam: { include: { subject: true } },
        student: { include: { user: { select: { name: true, email: true } } } }
      }
    });
  }

  static async recordGrade(user, data) {
    if (user.role === 'STUDENT') {
      const err = new Error('Students cannot record exam grades');
      err.statusCode = 403;
      throw err;
    }

    return prisma.grade.upsert({
      where: {
        examId_studentId: {
          examId: data.examId,
          studentId: data.studentId
        }
      },
      update: {
        marksObtained: data.marksObtained,
        gradeLetter: data.gradeLetter,
        comments: data.comments || null
      },
      create: {
        examId: data.examId,
        studentId: data.studentId,
        marksObtained: data.marksObtained,
        gradeLetter: data.gradeLetter,
        comments: data.comments || null
      }
    });
  }
}

