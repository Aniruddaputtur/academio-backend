import OpenAI from 'openai';
import { config } from '../config/environment.js';

let openaiClient = null;

export const getOpenAIClient = () => {
  if (!config.openaiApiKey || config.openaiApiKey.trim() === '') {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: 30000 // 30 seconds timeout
    });
  }

  return openaiClient;
};

export const isOpenAIConfigured = () => {
  return Boolean(config.openaiApiKey && config.openaiApiKey.trim() !== '');
};

