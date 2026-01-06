#!/bin/bash
# Monitor claude-mem hooks activity

echo "🔍 Monitoring claude-mem hooks..."
echo "Press Ctrl+C to stop"
echo ""

LOG_FILE="$HOME/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log"
WORKER_URL="http://localhost:37777"

# Function to check observations count
check_observations() {
  local count=$(curl -s "$WORKER_URL/api/observations?limit=1" 2>/dev/null | grep -o '"items":\[.*\]' | grep -o '\]' | wc -l | tr -d ' ')
  echo "[$(date +%H:%M:%S)] Observations: $count"
}

# Function to check sessions
check_sessions() {
  local response=$(curl -s "$WORKER_URL/api/sessions?limit=1" 2>/dev/null)
  if echo "$response" | grep -q "items"; then
    local count=$(echo "$response" | grep -o '"items":\[.*\]' | grep -o '{' | wc -l | tr -d ' ')
    echo "[$(date +%H:%M:%S)] Sessions: $count"
  fi
}

# Monitor log file
if [ -f "$LOG_FILE" ]; then
  echo "📝 Watching log file: $LOG_FILE"
  tail -f "$LOG_FILE" 2>/dev/null | while read line; do
    if echo "$line" | grep -qE "HOOK|session|observation|cursor|beforeSubmit|afterFile|beforeShell|beforeMCP|stop"; then
      echo "🔥 HOOK ACTIVITY: $line"
    fi
  done &
  LOG_PID=$!
fi

# Monitor API every 5 seconds
echo "📊 Polling API every 5 seconds..."
while true; do
  check_observations
  check_sessions
  sleep 5
done
