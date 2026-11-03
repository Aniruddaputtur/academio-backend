import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['STUDENT', 'TEACHER', 'CLASS_TEACHER', 'ADMIN']).optional(),
  department: z.string().optional()
});

export const createCollegeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  affiliation: z.string().optional(),
  establishedYear: z.number().int().optional()
});

export const createAssignmentSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(5),
  maxMarks: z.number().positive().default(20),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
});

export const submitAssignmentSchema = z.object({
  content: z.string().optional(),
  fileUrl: z.string().url().optional()
}).refine(data => data.content || data.fileUrl, {
  message: 'Either content or fileUrl must be provided'
});

export const createAnnouncementSchema = z.object({
  collegeId: z.string().min(1),
  title: z.string().min(3),
  content: z.string().min(5),
  targetRole: z.enum(['all', 'students', 'teachers']).default('all'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().default('General')
});

export const createAlertSchema = z.object({
  collegeId: z.string().min(1),
  studentId: z.string().min(1),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  type: z.string().min(2),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(3),
  reason: z.string().min(5),
  thresholdValue: z.number().optional(),
  currentValue: z.number().optional(),
  recommendedAction: z.string().optional()
});

export const aiChatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message cannot exceed 4000 characters')
});

export const createConversationSchema = z.object({
  title: z.string().min(1).max(100).optional()
});

export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

