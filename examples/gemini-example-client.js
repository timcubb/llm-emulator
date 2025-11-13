
import { GoogleGenAI, setDefaultBaseUrls } from '@google/genai';

const API_KEY = 'llm-emulator';
const CUSTOM_ENDPOINT = 'http://localhost:11434';

setDefaultBaseUrls({ geminiUrl: CUSTOM_ENDPOINT });
const genAI = new GoogleGenAI({ apiKey: API_KEY });

const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "what is the square root of 5",
  });
  console.log(response.text);

const prompts = [
  "priming",
  "find me a red jacket under $100",
  "What is the square root of 100",
  "what do I have planned this weekend.",
  "summarize the events I have planned this weekend.",
  "what are my weekend plans.",
  "what is the capital city of New York",
  "what is the capital city of New Jersey",
  "what is the capital city of Alaska"
];

// Now you can interact with your Gemini model through the custom endpoint
async function textPrompt(prompt) {
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  console.log(response.text);
}

prompts.forEach(async function (prompt) {
  await textPrompt(prompt);
})