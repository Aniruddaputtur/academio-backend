import express from 'express';
import { AuthService } from '../services/authService.js';
import { authenticate } from '../middleware/authAndError.js';
import { validateBody, loginSchema, registerSchema } from '../validators/schemas.js';

export const authRouter = express.Router();

// POST /api/auth/login
authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register (Admin or public registration)
authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const user = await AuthService.register(req.body);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await AuthService.getMe(req.user.id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});
