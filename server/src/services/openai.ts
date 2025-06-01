import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Site URL for rankings on openrouter.ai
    "X-Title": "Mini CRM", // Site title for rankings on openrouter.ai
  },
});

export const generateCampaignMessage = async (
  segmentName: string,
  campaignName: string,
  campaignDescription: string
): Promise<string> => {
  try {
    const prompt = `You are creating a marketing campaign message for a segment named "${segmentName}" for a campaign called "${campaignName}".
    
    Campaign description: ${campaignDescription}
    
    Your task is to write a highly targeted marketing message that speaks directly to this customer segment.
    The message should:
    - Be personalized for the "${segmentName}" segment
    - Highlight the value proposition of the "${campaignName}" campaign
    - Include a clear call-to-action
    - Be professional, engaging, and persuasive
    - VERY IMPORTANT: The entire message must be exactly 2 lines maximum
    
    Write only the message content, without any explanations or notes.`;

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-8b-instruct:free",
      messages: [
        { role: "system", content: "You are a professional marketing copywriter." },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || 'Unable to generate message';
  } catch (error) {
    console.error('Error generating campaign message:', error);
    throw new Error('Failed to generate campaign message');
  }
};
