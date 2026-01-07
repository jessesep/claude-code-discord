import { listAvailableModels } from "./util/list-models.ts";

async function main() {
  console.log("Fetching available models...");
  try {
    const models = await listAvailableModels();
    console.log("Available Models:");
    models.forEach(m => {
      console.log(`- ${m.name} (${m.displayName})`);
    });
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
