# Claude CLI Output Format Research

## Overview

The Claude CLI (`/opt/homebrew/bin/claude --print`) supports three distinct output formats for non-interactive use:
- **text** (default)
- **json** (single result)
- **stream-json** (realtime streaming)

This document details the output format, structure, and parsing requirements for each mode.

---

## Output Format Modes

### 1. Text Format (Default)

**Usage:**
```bash
echo "What is 2+2?" | claude --print --output-format text
```

**Output:**
```
2 + 2 = 4
```

**Characteristics:**
- Plain text output only
- No metadata or structure
- No JSON parsing needed
- Simple newline-separated responses
- Fastest and simplest for non-parsing use cases

---

### 2. JSON Format (Single Result)

**Usage:**
```bash
echo "What is 2+2?" | claude --print --output-format json
```

**Output (formatted for readability):**
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 4490,
  "duration_api_ms": 5745,
  "num_turns": 1,
  "result": "2 + 2 = 4",
  "session_id": "e55bad98-585a-4a02-ba3c-8df87d5e83c6",
  "total_cost_usd": 0.022896049999999998,
  "uuid": "c01be12e-891e-4ce3-9092-403edbe338be",
  "usage": {
    "input_tokens": 2,
    "cache_creation_input_tokens": 4005,
    "cache_read_input_tokens": 18541,
    "output_tokens": 13,
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 0,
      "ephemeral_5m_input_tokens": 4005
    }
  },
  "modelUsage": {
    "claude-haiku-4-5-20251001": {
      "inputTokens": 1494,
      "outputTokens": 124,
      "cacheReadInputTokens": 0,
      "cacheCreationInputTokens": 0,
      "webSearchRequests": 0,
      "costUSD": 0.002114,
      "contextWindow": 200000
    },
    "claude-sonnet-4-5-20250929": {
      "inputTokens": 2,
      "outputTokens": 13,
      "cacheReadInputTokens": 18541,
      "cacheCreationInputTokens": 4005,
      "webSearchRequests": 0,
      "costUSD": 0.020782049999999996,
      "contextWindow": 200000
    }
  },
  "permission_denials": []
}
```

**Key Fields:**
- **type**: "result" (indicates final response)
- **subtype**: "success" or error type
- **is_error**: boolean indicating error status
- **result**: The actual response text (may be multi-line)
- **duration_ms**: Total time from start to finish
- **duration_api_ms**: Time spent in API calls
- **num_turns**: Number of conversation turns
- **session_id**: Unique session identifier (UUID)
- **total_cost_usd**: Cost of the operation
- **usage**: Token usage statistics
  - **input_tokens**: Tokens in the prompt
  - **output_tokens**: Tokens in the response
  - **cache_creation_input_tokens**: Tokens cached for future use
  - **cache_read_input_tokens**: Tokens read from cache
  - **server_tool_use**: API request counts
  - **service_tier**: API tier used (standard, etc.)
- **modelUsage**: Breakdown by model used (multiple models may be invoked)
- **uuid**: Unique message identifier
- **permission_denials**: Array of denied permissions (if any)

**Characteristics:**
- Single JSON object per response
- Always valid JSON on one line
- Complete response with metadata
- No streaming - full response arrives at once
- Ideal for parsing and logging

---

### 3. Stream-JSON Format (Realtime Streaming)

**Usage:**
```bash
echo "What is 2+2?" | claude --print --output-format stream-json --verbose
```

**Note:** Requires `--verbose` flag to work with `--print`

**Output (one JSON object per line):**
```json
{"type":"system","subtype":"hook_response","session_id":"...","hook_name":"SessionStart:startup",...}
{"type":"system","subtype":"init","cwd":"/path/to/cwd","tools":[...],"model":"claude-sonnet-4-5-20250929",...}
{"type":"assistant","message":{"model":"claude-sonnet-4-5-20250929","id":"msg_01...","type":"message",...}}
{"type":"result","subtype":"success","is_error":false,"duration_ms":4937,...,"result":"2+2 = 4",...}
```

**Message Types in Stream:**

#### System Messages
- **Type**: "system"
- **Subtype**: "hook_response" | "init"
- **hook_response**: Session hook execution (SessionStart, etc.)
- **init**: Session initialization with available tools and models

#### Assistant Messages
- **Type**: "assistant"
- **Contains**: Complete message object with content and metadata
- **Structure**:
  ```json
  {
    "type": "assistant",
    "message": {
      "model": "claude-sonnet-4-5-20250929",
      "id": "msg_...",
      "type": "message",
      "role": "assistant",
      "content": [{"type": "text", "text": "..."}],
      "stop_reason": null,
      "stop_sequence": null,
      "usage": {
        "input_tokens": 2,
        "output_tokens": 11,
        ...
      }
    },
    "session_id": "...",
    "uuid": "..."
  }
  ```

#### Tool Use Messages
- **Type**: "tool_use"
- **Contains**: Tool invocation details
- **Note**: When tool_use occurs, a following "user" message contains the tool result

#### User Messages
- **Type**: "user"
- **Contains**: Tool results or user input acknowledgments
- **Structure**:
  ```json
  {
    "type": "user",
    "message": {
      "role": "user",
      "content": [
        {
          "tool_use_id": "toolu_...",
          "type": "tool_result",
          "content": "..."
        }
      ]
    },
    "session_id": "...",
    "uuid": "..."
  }
  ```

#### Result Messages
- **Type**: "result"
- **Subtype**: "success" (or error type)
- **Final message** in the stream
- **Same structure as JSON format's result object**

**Parsing Stream-JSON:**

```javascript
// Node.js example
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

let messageCount = 0;
let finalResult = null;

rl.on('line', (line) => {
  if (!line.trim()) return; // Skip empty lines

  try {
    const msg = JSON.parse(line);
    messageCount++;

    if (msg.type === 'system' && msg.subtype === 'hook_response') {
      console.log(`Hook: ${msg.hook_name}`);
    } else if (msg.type === 'system' && msg.subtype === 'init') {
      console.log(`Model: ${msg.model}, Tools: ${msg.tools.length}`);
    } else if (msg.type === 'assistant') {
      console.log(`Assistant response received`);
    } else if (msg.type === 'user') {
      // User message contains tool results
      if (msg.message.content[0]?.type === 'tool_result') {
        console.log('Tool result received');
      }
    } else if (msg.type === 'result') {
      finalResult = msg;
      console.log(`Final result: ${msg.result}`);
      console.log(`Cost: $${msg.total_cost_usd}`);
      console.log(`Duration: ${msg.duration_ms}ms`);
    }
  } catch (e) {
    console.error('JSON parse error:', line);
  }
});
```

**Characteristics:**
- NDJSON format (one JSON object per line)
- Requires `--verbose` flag with `--print`
- Real-time message streaming
- Multiple message types during execution
- Final message is always type="result"
- Supports `--include-partial-messages` to get intermediate streaming chunks

---

## Response Completion Detection

### For Text Format:
- Response ends when stdout ends
- Simple EOF detection

### For JSON Format:
- Single JSON object on one line
- Look for `"type": "result"` to detect final response
- Check `"is_error"` field for errors

### For Stream-JSON Format:
- Final message has `"type": "result"`
- This is the completion marker
- Can safely close stream after receiving result message

**Example completion detection (pseudocode):**
```
while (read line from stdout):
  if format == "stream-json":
    parse as JSON
    if msg.type == "result":
      we're done, this is the final message
      return msg.result
  else if format == "json":
    parse entire output as one JSON object
    if obj.type == "result":
      return obj.result
  else if format == "text":
    collect all lines until EOF
    return combined text
```

---

## Thinking and Output Separation

The Claude CLI **does not expose thinking** in its output formats. Thinking (if enabled on the model) is processed internally but not returned to the user.

- **No separate thinking field** in any output format
- **Result field** contains only the final text response
- **Thinking tokens** are included in `output_tokens` count
- **Cost calculation** includes thinking in total_cost_usd

---

## Tool Usage Pattern

When Claude uses tools (like Read, Bash, etc.), the stream-json output includes:

1. **assistant message** with tool_use block
2. **tool execution** (not shown in stream)
3. **user message** with tool_result block
4. **new assistant message** with response to tool result
5. **final result** message

Example flow:
```json
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_...","name":"Read",...}]}}
{"type":"user","message":{"content":[{"tool_use_id":"toolu_...","type":"tool_result","content":"file contents..."}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Based on the file..."}]}}
{"type":"result",...,"result":"Based on the file..."}
```

---

## Error Handling

### Error Response Structure

When an error occurs, the result message includes error information:

```json
{
  "type": "result",
  "subtype": "error_type",
  "is_error": true,
  "result": "Error message text",
  "error_details": {
    "code": "error_code",
    "message": "Detailed error message"
  },
  ...
}
```

### Common Error Subtypes:
- "permission_denied" - Permission checks failed
- "invalid_input" - Malformed input
- "api_error" - API call failed
- "timeout" - Operation timed out
- "rate_limit" - API rate limited

### Recovery:
- Check `is_error` field first
- Read `result` field for user-friendly error message
- Refer to `subtype` for error classification
- Use `session_id` and `uuid` for debugging

---

## Output Format Comparison

| Aspect | Text | JSON | Stream-JSON |
|--------|------|------|-------------|
| **Streaming** | No | No | Yes |
| **Metadata** | None | Complete | Incremental |
| **Parsing** | String | JSON | Line-by-line JSON |
| **Speed** | Fast (emit) | Fast (one parse) | Slower (multiple parses) |
| **Use Case** | Display/simple output | Logging, metrics | Real-time progress |
| **Error Detection** | Difficult | Easy (is_error field) | Easy (result message) |
| **Token Usage** | Not included | Included | Included |
| **Cost Tracking** | Not included | Included | Included |

---

## Best Practices

### 1. Choose the Right Format

```bash
# For simple scripts: use text
echo "prompt" | claude --print

# For logging/metrics: use json
echo "prompt" | claude --print --output-format json | jq '.result'

# For real-time monitoring: use stream-json
echo "prompt" | claude --print --output-format stream-json --verbose | while read line; do
  echo "$line" | jq .
done
```

### 2. Robust JSON Parsing

```bash
# Extract result safely with jq
echo "prompt" | claude --print --output-format json | jq -r '.result'

# Check for errors
echo "prompt" | claude --print --output-format json | jq 'if .is_error then .result else .result end'

# Get cost information
echo "prompt" | claude --print --output-format json | jq '.total_cost_usd'
```

### 3. Stream-JSON Line Processing

```bash
# Process stream line by line
claude --print --output-format stream-json --verbose <<< "prompt" | while IFS= read -r line; do
  # Skip empty lines
  [[ -z "$line" ]] && continue

  # Parse and process
  echo "$line" | jq '
    if .type == "result" then
      "DONE: \(.result)"
    elif .type == "assistant" then
      "Assistant response received"
    else
      .type
    end
  '
done
```

### 4. Cost and Token Tracking

```javascript
// Extract metrics from JSON response
const response = JSON.parse(stdout);

console.log('Metrics:');
console.log(`- Input tokens: ${response.usage.input_tokens}`);
console.log(`- Output tokens: ${response.usage.output_tokens}`);
console.log(`- Cache reads: ${response.usage.cache_read_input_tokens}`);
console.log(`- Cache writes: ${response.usage.cache_creation_input_tokens}`);
console.log(`- Cost: $${response.total_cost_usd}`);
console.log(`- Duration: ${response.duration_ms}ms`);
```

---

## Testing Commands

```bash
# Test basic text output
echo "What is 2+2?" | claude --print --dangerously-skip-permissions

# Test JSON output with pretty printing
echo "What is 2+2?" | claude --print --output-format json --dangerously-skip-permissions | jq .

# Test stream-json with type filtering
echo "What is 2+2?" | claude --print --output-format stream-json --verbose --dangerously-skip-permissions | jq -r '.type' | sort | uniq -c

# Test with tool usage
echo "List files in /tmp" | claude --print --output-format json --dangerously-skip-permissions | jq '.result'

# Test error handling
echo "" | claude --print --output-format json --dangerously-skip-permissions 2>&1

# Count messages in stream-json
echo "What is 2+2?" | claude --print --output-format stream-json --verbose --dangerously-skip-permissions 2>&1 | wc -l
```

---

## Summary

The Claude CLI provides three output formats:

1. **Text**: Simplest, no parsing needed, plain output
2. **JSON**: Single object with complete metadata, one-line output
3. **Stream-JSON**: Real-time streaming, line-by-line JSON objects, requires `--verbose`

For Discord bot integration parsing:
- Use `--output-format json` for reliable, parseable responses
- Detect completion: `msg.type === "result"`
- Extract output: `msg.result`
- Check errors: `msg.is_error`
- Track costs: `msg.total_cost_usd` and `msg.usage`

Stream-JSON is useful for monitoring long-running operations and showing real-time progress to users.
