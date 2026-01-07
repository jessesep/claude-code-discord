# 🎛️ OSC Bridge Integration Handoff

This document outlines the architecture and integration of the **OSC (Open Sound Control) Bridge** for the **one agent discord** system.

## 🏗️ Architecture
The system uses a **Bridge Pattern** where an `OSCManager` acts as a translator between the TouchOSC protocol (UDP/OSC) and the internal bot handlers.

### 1. The Bridge (`osc/index.ts`)
The bridge is a standalone class that:
-   **Listens** for UDP packets on port `9000` (default).
-   **Decodes** OSC messages using `osc-js`.
-   **Dispatches** commands to the bot's handlers (`gitHandlers`, `agentHandlers`, etc.).
-   **Sends Feedback** (Status labels, logs) back to the control surface on port `9001`.

### 2. Native UDP Binding
Due to Deno's strict security and the nature of the `npm:osc-js` UDP plugin (which can be unreliable in Deno), we use **`Deno.listenDatagram`** for the core socket.
-   **Requirement**: You MUST run with the `--unstable-net` flag.
-   **Binding**: Binds to `0.0.0.0:9000` to allow connections from local and Tailscale networks.

## 📂 File Structure
-   `osc/index.ts`: The core `OSCManager` implementation.
-   `index.ts`: Integration point where the manager is initialized and started.
-   `one_agent_iphone.tosc`: (In `one-OSC` repo) The V5/V6 TouchOSC layout.

## 🔌 Integration Point
In the main `index.ts`, the bridge is initialized alongside the other managers:

```typescript
// Start OSC Server
try {
  const phoneIP = Deno.env.get("OSC_PHONE_IP");
  const remoteHosts = ["127.0.0.1"];
  if (phoneIP && phoneIP !== "127.0.0.1") {
    remoteHosts.push(phoneIP);
  }

  const oscManager = new OSCManager(
    { 
      port: 9000, 
      remoteHosts: remoteHosts, 
      remotePort: 9001 
    },
    { 
      gitHandlers, 
      primaryHandlers, 
      agentHandlers, 
      shellHandlers, 
      utilsHandlers 
    }
  );
  oscManager.start();
} catch (error) {
  console.error("Failed to start OSC Server:", error);
}
```

## 🎮 Protocol Mapping
| OSC Address | Bot Action | Feedback Sent |
| :--- | :--- | :--- |
| `/ping` | Connectivity Check | `/pong`, `/label/console` |
| `/git/status` | Fetches Git Status | `/label/git_branch`, `/label/console` |
| `/github/sync` | `git pull` then `git push` | `/label/console`, `/label/git_branch` |
| `/agent/select/*` | Swaps the active agent | `/label/agent_name`, `/label/console` |
| `/github/issue/new` | Creates a bug issue | `/label/console` |

## 🚀 How to Run & Test

### Running the Bot
```bash
deno run --allow-all --unstable-net --env-file=.env index.ts
```

### Connectivity Checklist
1.  **Tailscale**: Ensure both the host and the phone are on the same Tailscale network.
2.  **Environment**: Set `OSC_PHONE_IP` in your `.env` or as an environment variable.
3.  **Port Mapping**:
    -   Bot Listening Port: `9000` (UDP)
    -   Phone Listening Port: `9001` (UDP)
4.  **TouchOSC Config**:
    -   Connection 1: `UDP`
    -   Host: `[Laptop IP]`
    -   Port (Send): `9000`
    -   Port (Receive): `9001`

## 🛠️ Troubleshooting
If the bot is not receiving messages:
1.  Run `lsof -nP -iUDP:9000` to verify the port is bound.
2.  Check `bot_output.log` for `[OSC] Received: ...` entries.
3.  Verify the layout file on your phone is **V6**, as earlier versions lacked the internal OSC routing logic.
