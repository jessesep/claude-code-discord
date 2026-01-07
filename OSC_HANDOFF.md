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
### Core Files
-   `osc/index.ts`: The core `OSCManager` implementation.
-   `osc/osc-discord-channel.ts`: Discord channel manager for OSC testing.
-   `osc/osc-commands.ts`: `!osc` Discord command handler.
-   `index.ts`: Integration point where the manager is initialized and started.
-   `one_agent_iphone.tosc`: (In `one-OSC` repo) The V5/V6 TouchOSC layout.

### Test Files
-   `tests/osc/osc-test-client.ts`: Bidirectional OSC test client.
-   `tests/osc/osc-e2e.test.ts`: E2E test suite (8 tests).
-   `tests/osc/osc-live-test.ts`: Interactive CLI test tool.
-   `tests/osc/osc-diagnostics.ts`: Health check diagnostics.

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

## 💬 Discord Integration

When the bot starts, it creates a **🎛️ OSC Testing** category with two channels:

### Channels
| Channel | Purpose |
| :--- | :--- |
| `#osc-control` | Send OSC commands, see feedback |
| `#osc-log` | Real-time log of all OSC traffic |

### Discord Commands (`!osc`)
| Command | Description |
| :--- | :--- |
| `!osc ping` | Test OSC connectivity |
| `!osc status` | Show bridge status and stats |
| `!osc send <addr> [args]` | Send custom OSC message |
| `!osc git status` | Request git status via OSC |
| `!osc git sync` | Trigger git pull/push |
| `!osc agent <name>` | Select agent (coder, architect, etc.) |
| `!osc help` | Show all commands |

### Example Usage
```
!osc ping                    # Test connectivity
!osc status                  # Show stats
!osc send /git/status 1      # Custom OSC
!osc agent coder             # Switch to coder agent
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

## 🧪 Testing Infrastructure

### E2E Test Suite
Located in `tests/osc/`:

```bash
# Run full E2E test suite
deno test --allow-all --unstable-net tests/osc/osc-e2e.test.ts

# Run diagnostics
deno run --allow-all --unstable-net tests/osc/osc-diagnostics.ts

# Live test against running bot
deno run --allow-all --unstable-net tests/osc/osc-live-test.ts ping
deno run --allow-all --unstable-net tests/osc/osc-live-test.ts git-status
deno run --allow-all --unstable-net tests/osc/osc-live-test.ts agent coder
deno run --allow-all --unstable-net tests/osc/osc-live-test.ts monitor
deno run --allow-all --unstable-net tests/osc/osc-live-test.ts stress 100
```

### Test Files
| File | Purpose |
| :--- | :--- |
| `osc-test-client.ts` | Bidirectional OSC test client simulating TouchOSC |
| `osc-e2e.test.ts` | E2E tests with mock server (8 tests including stress) |
| `osc-live-test.ts` | Interactive CLI tool for testing live bot |
| `osc-diagnostics.ts` | Health check for ports, UDP, OSC library |

### Test Coverage
- ✅ Ping/Pong connectivity
- ✅ Git status requests
- ✅ GitHub sync workflow
- ✅ Agent selection
- ✅ Issue creation
- ✅ Multiple rapid messages
- ✅ Stress test (50+ messages, 100% response rate)
- ✅ Value 0 filtering (button release)

## 🔬 OSC MCP Research

### MCP2OSC (NeurIPS 2025 Creative AI)
**Paper**: [arXiv:2508.10414](https://arxiv.org/html/2508.10414v1)  
**Repo**: [github.com/yyf/MCP2OSC](https://github.com/yyf/MCP2OSC)

A dedicated MCP server for OSC that enables:
- Natural language → OSC message generation
- OSC message interpretation/visualization
- Address pattern management
- Bidirectional validation and debugging

### Other OSC MCP Integrations
| Project | Purpose |
| :--- | :--- |
| **SuperColliderMCP** | Audio synthesis via OSC |
| **VRChat MCP OSC** | Avatar control in VR |
| **Ableton Live MCP** | DAW track/performance control |

### Potential Integration
The MCP2OSC approach could be adapted to allow Claude to:
- Generate OSC commands from natural language
- Debug OSC connectivity issues
- Visualize received OSC data
- Manage address patterns dynamically
