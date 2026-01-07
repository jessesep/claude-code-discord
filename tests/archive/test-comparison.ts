import { OllamaProvider } from "./agent/providers/ollama-provider.ts";
import { sendToAntigravityCLI } from "./provider-clients/antigravity-client.ts";

async function runComparison() {
  const prompt = "System: You are a helpful assistant.\n\nTask: Explain the difference between a class and an interface in TypeScript in 3 short bullet points.";
  
  console.log("=== COMPARISON TEST ===");
  console.log(`Prompt: ${prompt}`);
  console.log("------------------------\n");

  // Load API key from .env manually for the test
  const envContent = await Deno.readTextFile(".env");
  const geminiMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
  if (geminiMatch) {
    Deno.env.set("GEMINI_API_KEY", geminiMatch[1].trim());
  }

  const ollama = new OllamaProvider();

  // Test Ollama
  console.log("Testing Ollama (llama3.2:latest)...");
  try {
    const ollamaResult = await ollama.execute(prompt, {
      model: "llama3.2:latest",
      streaming: false
    });
    console.log(`Ollama Response:\n${ollamaResult.response}`);
    console.log(`Duration: ${ollamaResult.duration}ms\n`);
  } catch (error) {
    console.error(`Ollama Error: ${error.message}`);
  }

  // Test Gemini 3 Flash
  console.log("Testing Gemini 3 Flash...");
  try {
    const controller = new AbortController();
    const geminiResult = await sendToAntigravityCLI(prompt, controller, {
      model: "gemini-2.0-flash",
      streamJson: false,
      authorized: false // Force API key strategy
    });
    console.log(`Gemini Response:\n${geminiResult.response}`);
    console.log(`Duration: ${geminiResult.duration}ms\n`);
  } catch (error) {
    console.error(`Gemini Error: ${error.message}`);
  }
}

runComparison();
