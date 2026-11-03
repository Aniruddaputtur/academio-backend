import { prisma } from '../config/database.js';
import { config } from '../config/environment.js';
import { getOpenAIClient, isOpenAIConfigured } from './openaiClient.js';
import { ContextBuilder } from './contextBuilder.js';

export class AIService {
  /**
   * Process a chat message with role-aware context and persist in SQLite
   */
  static async chat(user, messageContent, conversationId = null) {
    if (!messageContent || typeof messageContent !== 'string' || messageContent.trim() === '') {
      const err = new Error('Message content is required');
      err.statusCode = 400;
      throw err;
    }

    // 1. Resolve or create AIConversation with strict ownership check
    let conversation;
    if (conversationId) {
      conversation = await prisma.aIConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            take: 10,
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!conversation) {
        const err = new Error('Conversation not found');
        err.statusCode = 404;
        throw err;
      }

      // Ownership verification
      if (conversation.userId !== user.id) {
        const err = new Error('Access denied. You do not own this conversation.');
        err.statusCode = 403;
        throw err;
      }
    } else {
      // Create fresh conversation
      const previewTitle = messageContent.trim().slice(0, 35) + (messageContent.length > 35 ? '...' : '');
      conversation = await prisma.aIConversation.create({
        data: {
          userId: user.id,
          title: previewTitle
        },
        include: { messages: true }
      });
    }

    // 2. Save incoming user message in SQLite
    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: messageContent.trim()
      }
    });

    // 3. Build role-aware academic context strictly authorized for this user
    const academicContext = await ContextBuilder.buildContextForUser(user);

    // 4. Check OpenAI Configuration
    if (!isOpenAIConfigured()) {
      const fallbackResponse = `[Academio AI Service Notice]: OpenAI API Key is not configured on this server. To activate full AI responses, set OPENAI_API_KEY in the backend .env configuration. (Your message has been safely saved in conversation history).`;
      
      const assistantMessage = await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: fallbackResponse
        }
      });

      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
        aiConfigured: false
      };
    }

    // 5. Query OpenAI with system prompt and role context
    const openai = getOpenAIClient();
    const systemPrompt = `You are ACADEMIO AI, an intelligent, empathetic academic co-pilot and advisor for college students, faculty, and administrators.
You provide accurate, explainable guidance strictly based on the authenticated user's official academic records.

User Information & Role:
- Name: ${user.name}
- Role: ${user.role}
- Department: ${user.department || 'N/A'}

Verified Academic Context (Database Records):
${JSON.stringify(academicContext, null, 2)}

Strict Rules:
1. Ground your answers strictly in the verified academic context above.
2. If the user asks for information not present in the context (e.g. grades of another student, or unknown schedules), politely and clearly explain that the data is not available in their official records. Never invent or hallucinate grades, attendance, or university policies.
3. Students must only be discussed with respect to their own performance. Never disclose unauthorized institutional or peer data.
4. Keep explanations concise, professional, clear, and actionable.`;

    const chatHistory = (conversation.messages || []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    try {
      const response = await openai.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: messageContent.trim() }
        ],
        temperature: 0.4,
        max_tokens: 1000
      });

      const replyContent = response.choices[0]?.message?.content || 'I could not generate a response. Please try again.';
      const tokensUsed = response.usage?.total_tokens || null;

      // 6. Save assistant message in SQLite
      const assistantMessage = await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: replyContent,
          tokensUsed
        }
      });

      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
        aiConfigured: true,
        model: config.openaiModel
      };
    } catch (openaiError) {
      console.error('[OpenAI Error]', openaiError.message);
      
      // If OpenAI call fails (e.g. invalid key, quota, timeout, network), save graceful error in chat history
      const fallbackResponse = `[Academio AI Service Notice]: Unable to retrieve AI response (${openaiError.message}). Your prompt has been safely recorded in your conversation history.`;
      const assistantMessage = await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: fallbackResponse
        }
      });

      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
        aiConfigured: false,
        apiError: openaiError.message
      };
    }
  }

  /**
   * Get all conversations for authenticated user
   */
  static async getConversations(userId) {
    return prisma.aIConversation.findMany({
      where: { userId },
      include: {
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Get conversation details and message history
   */
  static async getConversationById(userId, conversationId) {
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (conversation.userId !== userId) {
      const err = new Error('Access denied. You do not have permission to view this conversation.');
      err.statusCode = 403;
      throw err;
    }

    return conversation;
  }

  /**
   * Create a new empty conversation
   */
  static async createConversation(userId, title = 'New Conversation') {
    return prisma.aIConversation.create({
      data: {
        userId,
        title: title || 'New Conversation'
      }
    });
  }

  /**
   * Delete conversation (ownership protected)
   */
  static async deleteConversation(userId, conversationId) {
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (conversation.userId !== userId) {
      const err = new Error('Access denied. You do not have permission to delete this conversation.');
      err.statusCode = 403;
      throw err;
    }

    await prisma.aIConversation.delete({
      where: { id: conversationId }
    });

    return { success: true, message: 'Conversation deleted successfully' };
  }
}

