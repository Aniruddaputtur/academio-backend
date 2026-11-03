import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { prisma } from '../config/database.js';

/**
 * Authentication Middleware:
 * Verifies Bearer JWT, fetches fresh user & role from SQLite, and attaches to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or malformed Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Authentication token has expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
    }

    // Verify user still exists in database and account is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id || decoded.userId },
      include: {
        studentProfile: true,
        teacherProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: `Account is ${user.status.toLowerCase()}. Access denied.` });
    }

    // Attach verified identity and profiles to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // Derived strictly from verified DB record
      department: user.department,
      studentId: user.studentProfile?.id || null,
      teacherId: user.teacherProfile?.id || null,
      collegeId: user.studentProfile?.collegeId || user.teacherProfile?.collegeId || null
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Allows only specified roles to access an endpoint.
 * Roles: "STUDENT", "TEACHER", "CLASS_TEACHER", "ADMIN"
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource. Allowed: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Centralized Error Handler
 */
export const errorHandler = (err, req, res, next) => {
  // Never expose sensitive internals in production logs
  console.error(`[Error] ${req.method} ${req.url} - ${err.message}`);
  if (config.nodeEnv === 'development' && err.stack) {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {})
  });
};
