import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { config } from '../config/environment.js';

export class AuthService {
  static async login(email, password) {
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        studentProfile: true,
        teacherProfile: true
      }
    });

    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== 'ACTIVE') {
      const err = new Error(`Account is ${user.status.toLowerCase()}. Please contact admin.`);
      err.statusCode = 403;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Sign JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        studentId: user.studentProfile?.id || null,
        teacherId: user.teacherProfile?.id || null
      }
    };
  }

  static async register(data) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() }
    });

    if (existing) {
      const err = new Error('User with this email already exists');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        name: data.name,
        role: data.role || 'STUDENT',
        department: data.department || null,
        status: 'ACTIVE'
      }
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department
    };
  }

  static async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        phone: true,
        avatar: true,
        status: true,
        createdAt: true,
        studentProfile: {
          include: {
            college: true,
            enrollments: {
              include: { class: true }
            }
          }
        },
        teacherProfile: {
          include: {
            college: true,
            classTeacherOf: {
              include: { class: true }
            },
            assignmentsTaught: {
              include: { class: true, subject: true }
            }
          }
        }
      }
    });

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }
}

