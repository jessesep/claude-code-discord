import { OSCManager } from "./index.ts";

console.log("Starting standalone OSC test server...");
const manager = new OSCManager({ port: 9000 });
await manager.start();

// Keep process alive
setInterval(() => {}, 1000);
