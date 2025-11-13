
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: "llm-emulator",
  baseURL: "http://localhost:11434"
});

const prompts = [
  "What is the square root of 5",
  "What is the square root of 50",
  "What is the square root of 100",
  "what do I have planned this weekend.",
  "summarize the events I have planned this weekend.",
  "what are my weekend plans.",
  "what is the capital city of New York",
  "what is the capital city of New Jersey",
  "what is the capital city of Alaska"
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