import { OpenAI } from 'openai';

const apiKey = (process.env.NVIDIA_API_KEY || process.env.MISTRAL_API_KEY)?.trim().replace(/^["']|["']$/g, '');

export const aiClient = apiKey ? new OpenAI({ 
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
  timeout: 120000 
}) : null;
