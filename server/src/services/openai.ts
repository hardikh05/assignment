import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Single AI client using Groq for all AI features
// Groq provides an OpenAI-compatible API with very fast inference
const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const AI_MODEL = "llama-3.3-70b-versatile";

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

    const completion = await groq.chat.completions.create({
      model: AI_MODEL,
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

export const convertNaturalLanguageToRules = async (description: string): Promise<any[]> => {
  try {
    const prompt = `Convert the following customer segment description into structured rules:
    Description: ${description}
    Requirements:
    - Return only valid JSON array of rules
    - Each rule should have 'field', 'operator', and 'value' properties
    - Supported operators: equals, not_equals, contains, not_contains, greater_than, less_than
    - Use proper data types for values (string, number, boolean)
    - Return ONLY the JSON array, no extra text or markdown
    Example format:
    [
      {
        "field": "age",
        "operator": "greater_than",
        "value": 25
      }
    ]`;

    const completion = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: "You are a JSON generator. Return only valid JSON arrays with no extra text, no markdown, no code fences." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '[]';
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error converting rules:', error);
    throw new Error('Failed to convert natural language to rules');
  }
};
