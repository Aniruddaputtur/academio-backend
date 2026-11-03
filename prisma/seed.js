import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seeding...');

  // 1. Password hashing
  const defaultPassword = await bcrypt.hash('Academio@123', 10);

  // 2. Colleges
  const rvce = await prisma.college.upsert({
    where: { code: 'RVCE' },
    update: {},
    create: {
      name: 'RV College of Engineering',
      code: 'RVCE',
      contactPerson: 'Dr. K. N. Subramanya',
      email: 'principal@rvce.edu.in',
      phone: '+91 80 6818 8100',
      address: 'Mysore Road, Bengaluru, Karnataka 560059',
      affiliation: 'Visvesvaraya Technological University (VTU)',
      establishedYear: 1963,
      status: 'active'
    }
  });

  const bmsce = await prisma.college.upsert({
    where: { code: 'BMSCE' },
    update: {},
    create: {
      name: 'BMS College of Engineering',
      code: 'BMSCE',
      contactPerson: 'Dr. S. Muralidhara',
      email: 'office@bmsce.ac.in',
      phone: '+91 80 2662 2130',
      address: 'Bull Temple Road, Basavanagudi, Bengaluru 560019',
      affiliation: 'Visvesvaraya Technological University (VTU)',
      establishedYear: 1946,
      status: 'active'
    }
  });

  // 3. Departments
  const cseDept = await prisma.department.upsert({
    where: {
      collegeId_code: {
        collegeId: rvce.id,
        code: 'CSE'
      }
    },
    update: {},
    create: {
      collegeId: rvce.id,
      code: 'CSE',
      name: 'Computer Science & Engineering',
      hodName: 'Dr. K. Srinivas'
    }
  });

  // 4. Course
  const btechCourse = await prisma.course.upsert({
    where: {
      collegeId_code: {
        collegeId: rvce.id,
        code: 'BE-CSE'
      }
    },
    update: {},
    create: {
      collegeId: rvce.id,
      departmentId: cseDept.id,
      code: 'BE-CSE',
      name: 'Bachelor of Engineering in Computer Science',
      durationYears: 4,
      totalSemesters: 8
    }
  });

  // 5. Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: {
      collegeId_year: {
        collegeId: rvce.id,
        year: '2026-2027'
      }
    },
    update: {},
    create: {
      collegeId: rvce.id,
      year: '2026-2027',
      isCurrent: true,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31')
    }
  });

  // 6. Semester 5
  const sem5 = await prisma.semester.upsert({
    where: {
      courseId_number: {
        courseId: btechCourse.id,
        number: 5
      }
    },
    update: {},
    create: {
      courseId: btechCourse.id,
      number: 5,
      name: '5th Semester'
    }
  });

  // 7. Class
  let classA = await prisma.class.findFirst({
    where: { collegeId: rvce.id, name: '5th Sem CSE - Section A' }
  });
  if (!classA) {
    classA = await prisma.class.create({
      data: {
        collegeId: rvce.id,
        departmentId: cseDept.id,
        courseId: btechCourse.id,
        semesterId: sem5.id,
        academicYearId: academicYear.id,
        name: '5th Sem CSE - Section A',
        section: 'A',
        roomNumber: 'CS-302',
        totalStudents: 64
      }
    });
  }

  // 8. Subjects
  const subjectCN = await prisma.subject.upsert({
    where: {
      semesterId_code: {
        semesterId: sem5.id,
        code: '21CS52'
      }
    },
    update: {},
    create: {
      semesterId: sem5.id,
      code: '21CS52',
      name: 'Computer Networks',
      credits: 4,
      totalHours: 52
    }
  });

  const subjectTOC = await prisma.subject.upsert({
    where: {
      semesterId_code: {
        semesterId: sem5.id,
        code: '21CS54'
      }
    },
    update: {},
    create: {
      semesterId: sem5.id,
      code: '21CS54',
      name: 'Theory of Computation',
      credits: 4,
      totalHours: 48
    }
  });

  // 9. Users
  // Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@college.edu' },
    update: {},
    create: {
      email: 'admin@college.edu',
      passwordHash: defaultPassword,
      name: 'Rehan (Platform Admin)',
      role: 'ADMIN',
      department: 'Central Academic Affairs',
      status: 'ACTIVE'
    }
  });

  // Class Teacher User
  const ctUser = await prisma.user.upsert({
    where: { email: 'srinivas.k@rvce.edu.in' },
    update: {},
    create: {
      email: 'srinivas.k@rvce.edu.in',
      passwordHash: defaultPassword,
      name: 'Dr. K. Srinivas',
      role: 'CLASS_TEACHER',
      department: 'Computer Science & Engineering',
      status: 'ACTIVE'
    }
  });

  // Teacher User
  const teacherUser = await prisma.user.upsert({
    where: { email: 'ananya.sharma@rvce.edu.in' },
    update: {},
    create: {
      email: 'ananya.sharma@rvce.edu.in',
      passwordHash: defaultPassword,
      name: 'Prof. Ananya Sharma',
      role: 'TEACHER',
      department: 'Computer Science & Engineering',
      status: 'ACTIVE'
    }
  });

  // Student User 1: Rahul Sharma
  const studentUser1 = await prisma.user.upsert({
    where: { email: 'rahul.cs22@rvce.edu.in' },
    update: {},
    create: {
      email: 'rahul.cs22@rvce.edu.in',
      passwordHash: defaultPassword,
      name: 'Rahul Sharma',
      role: 'STUDENT',
      department: 'Computer Science & Engineering',
      status: 'ACTIVE'
    }
  });

  // Student User 2: Karthik Gowda (with low attendance)
  const studentUser2 = await prisma.user.upsert({
    where: { email: 'karthik.cs22@rvce.edu.in' },
    update: {},
    create: {
      email: 'karthik.cs22@rvce.edu.in',
      passwordHash: defaultPassword,
      name: 'Karthik Gowda',
      role: 'STUDENT',
      department: 'Computer Science & Engineering',
      status: 'ACTIVE'
    }
  });

  // 10. Teacher Profiles
  const teacherProfileCT = await prisma.teacher.upsert({
    where: { userId: ctUser.id },
    update: {},
    create: {
      userId: ctUser.id,
      collegeId: rvce.id,
      departmentId: cseDept.id,
      designation: 'Professor & HOD',
      specialization: 'Theoretical Computer Science'
    }
  });

  const teacherProfileAnanya = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      collegeId: rvce.id,
      departmentId: cseDept.id,
      designation: 'Assistant Professor',
      specialization: 'Networking & Distributed Systems'
    }
  });

  // Class Teacher Assignment
  await prisma.classTeacher.upsert({
    where: {
      classId_teacherId: {
        classId: classA.id,
        teacherId: teacherProfileCT.id
      }
    },
    update: {},
    create: {
      classId: classA.id,
      teacherId: teacherProfileCT.id
    }
  });

  // Teacher Subject Assignments
  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_classId_subjectId: {
        teacherId: teacherProfileAnanya.id,
        classId: classA.id,
        subjectId: subjectCN.id
      }
    },
    update: {},
    create: {
      teacherId: teacherProfileAnanya.id,
      classId: classA.id,
      subjectId: subjectCN.id
    }
  });

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_classId_subjectId: {
        teacherId: teacherProfileCT.id,
        classId: classA.id,
        subjectId: subjectTOC.id
      }
    },
    update: {},
    create: {
      teacherId: teacherProfileCT.id,
      classId: classA.id,
      subjectId: subjectTOC.id
    }
  });

  // 11. Student Profiles
  const student1 = await prisma.student.upsert({
    where: { usn: '1RV22CS084' },
    update: {},
    create: {
      userId: studentUser1.id,
      collegeId: rvce.id,
      usn: '1RV22CS084',
      branch: 'Computer Science & Engineering',
      mentorName: 'Dr. K. Srinivas',
      overallAttendance: 84.6,
      totalClassesAttended: 176,
      totalClassesHeld: 208,
      avgIA: 88.5
    }
  });

  const student2 = await prisma.student.upsert({
    where: { usn: '1RV22CS086' },
    update: {},
    create: {
      userId: studentUser2.id,
      collegeId: rvce.id,
      usn: '1RV22CS086',
      branch: 'Computer Science & Engineering',
      mentorName: 'Dr. K. Srinivas',
      overallAttendance: 70.8,
      totalClassesAttended: 17,
      totalClassesHeld: 24,
      avgIA: 65.0
    }
  });

  // Enrollments
  await prisma.studentEnrollment.upsert({
    where: {
      studentId_classId: {
        studentId: student1.id,
        classId: classA.id
      }
    },
    update: {},
    create: {
      studentId: student1.id,
      classId: classA.id,
      rollNumber: '84'
    }
  });

  await prisma.studentEnrollment.upsert({
    where: {
      studentId_classId: {
        studentId: student2.id,
        classId: classA.id
      }
    },
    update: {},
    create: {
      studentId: student2.id,
      classId: classA.id,
      rollNumber: '86'
    }
  });

  // 12. Internal Marks
  await prisma.internalMarks.upsert({
    where: {
      studentId_subjectId: {
        studentId: student1.id,
        subjectId: subjectCN.id
      }
    },
    update: {},
    create: {
      studentId: student1.id,
      subjectId: subjectCN.id,
      ia1Marks: 23.5,
      ia2Marks: 24.0,
      ia3Marks: 25.0,
      assignmentMarks: 18.0,
      totalIAMarks: 48.5,
      semester: 5,
      academicYear: '2026-2027'
    }
  });

  await prisma.internalMarks.upsert({
    where: {
      studentId_subjectId: {
        studentId: student2.id,
        subjectId: subjectTOC.id
      }
    },
    update: {},
    create: {
      studentId: student2.id,
      subjectId: subjectTOC.id,
      ia1Marks: 14.0,
      ia2Marks: 15.0,
      ia3Marks: 16.0,
      assignmentMarks: 12.0,
      totalIAMarks: 30.5,
      semester: 5,
      academicYear: '2026-2027'
    }
  });

  // 13. Assignments
  let assignment1 = await prisma.assignment.findFirst({
    where: { title: 'Socket Programming & Wireshark Handshake Analysis' }
  });
  if (!assignment1) {
    assignment1 = await prisma.assignment.create({
      data: {
        classId: classA.id,
        subjectId: subjectCN.id,
        teacherId: teacherProfileAnanya.id,
        title: 'Socket Programming & Wireshark Handshake Analysis',
        description: 'Implement a multi-client chat server using TCP sockets in Python or C, and demonstrate Wireshark packet capture analysis.',
        maxMarks: 20.0,
        dueDate: new Date('2026-11-20'),
        status: 'active'
      }
    });
  }

  // Submission for student1
  await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment1.id,
        studentId: student1.id
      }
    },
    update: {},
    create: {
      assignmentId: assignment1.id,
      studentId: student1.id,
      content: 'GitHub repository: https://github.com/rahulsharma/tcp-chat-sockets with Wireshark .pcapng analysis attached.',
      status: 'submitted',
      marksObtained: 19.0
    }
  });

  // 14. Academic Alert
  let alert1 = await prisma.academicAlert.findFirst({
    where: { studentId: student2.id, title: 'Attendance Below 75% in TOC' }
  });
  if (!alert1) {
    alert1 = await prisma.academicAlert.create({
      data: {
        collegeId: rvce.id,
        classId: classA.id,
        studentId: student2.id,
        subjectId: subjectTOC.id,
        createdById: ctUser.id,
        type: 'attendance_critical',
        severity: 'critical',
        title: 'Attendance Below 75% in TOC',
        reason: 'Karthik has missed 7 of 24 classes. Current attendance: 70.8%, which violates VTU minimum eligibility criteria.',
        thresholdValue: 75.0,
        currentValue: 70.8,
        recommendedAction: 'Must attend the next 4 consecutive lectures without missing to recover to 75.0%.',
        status: 'open'
      }
    });
  }

  // 15. Announcements
  let ann1 = await prisma.announcement.findFirst({
    where: { title: 'Internal Assessment (CIE-2) Schedule Announced' }
  });
  if (!ann1) {
    ann1 = await prisma.announcement.create({
      data: {
        collegeId: rvce.id,
        authorId: adminUser.id,
        title: 'Internal Assessment (CIE-2) Schedule Announced',
        content: 'Continuous Internal Evaluation (CIE-2) for 5th semester BE will commence from October 27th to November 2nd, 2026. All students must maintain a minimum of 75% attendance to be eligible.',
        targetRole: 'all',
        priority: 'high',
        category: 'Exam'
      }
    });
  }

  console.log('[Seed] Database seeding completed successfully.');
  console.log(`- Seeded Colleges: 2 (RVCE, BMSCE)`);
  console.log(`- Seeded Users: 5 (Admin, Class Teacher, Teacher, 2 Students)`);
  console.log(`- Seeded Departments: 1, Courses: 1, Semesters: 1, Classes: 1, Subjects: 2`);
  console.log(`- Seeded Assignments: 1, Submissions: 1, Marks: 2, Alerts: 1, Announcements: 1`);
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

