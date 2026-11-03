import express from 'express';
import rateLimit from 'express-rate-limit';
import { AIService } from '../ai/aiService.js';
import { authenticate } from '../middleware/authAndError.js';
import { validateBody, aiChatSchema, createConversationSchema } from '../validators/schemas.js';

export const aiRouter = express.Router();

// Specific rate limit for AI generation to protect API quota and prevent abuse
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 AI prompts per minute per IP
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment before sending another prompt.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All AI endpoints require authentication
aiRouter.use(authenticate);

// POST /api/ai/chat
aiRouter.post('/chat', aiRateLimiter, validateBody(aiChatSchema), async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    const result = await AIService.chat(req.user, message, conversationId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/history
aiRouter.get('/history', async (req, res, next) => {
  try {
    const conversations = await AIService.getConversations(req.user.id);
    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/conversations
aiRouter.post('/conversations', validateBody(createConversationSchema), async (req, res, next) => {
  try {
    const conversation = await AIService.createConversation(req.user.id, req.body.title);
    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/conversations/:id
aiRouter.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await AIService.getConversationById(req.user.id, req.params.id);
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/ai/conversations/:id
aiRouter.delete('/conversations/:id', async (req, res, next) => {
  try {
    const result = await AIService.deleteConversation(req.user.id, req.params.id);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

