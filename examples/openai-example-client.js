
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: "llm-emulator",
  baseURL: "http://localhost:11434"
});

const prompts = [
  "my name is Joe",
  "my address is 123 something lane"
];


async function textPrompt(prompt) {
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: 'system', content: 'You are an AI assistant' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  });

  console.log(r.choices?.[0]?.message?.content);
}

prompts.forEach(async function (prompt) {
  await textPrompt(prompt);
})