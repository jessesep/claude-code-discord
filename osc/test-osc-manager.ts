import { OSCManager } from "./index.ts";

const mgr = new OSCManager({
  port: 9005,
  remoteHosts: ['127.0.0.1'],
  remotePort: 9001
}, {});

console.log("Starting manager...");
await mgr.start();
console.log("Manager started. Checking port 9005...");

// Keep alive for 5 seconds
setTimeout(() => {
  console.log("Done.");
  Deno.exit(0);
}, 5000);
