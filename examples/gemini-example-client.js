
import { GoogleGenAI, setDefaultBaseUrls } from '@google/genai';

const API_KEY = 'llm-emulator';
const CUSTOM_ENDPOINT = 'http://localhost:11434';

setDefaultBaseUrls({ geminiUrl: CUSTOM_ENDPOINT });
const genAI = new GoogleGenAI({ apiKey: API_KEY });

const prompts = [
  "my name is Joe",
  "my address is 123 something lane"
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