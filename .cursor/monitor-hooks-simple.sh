#!/bin/bash
# Simple hook monitoring - shows activity in real-time

echo "🔍 Monitoring claude-mem hooks..."
echo "Watching for hook activity..."
echo ""

LOG_FILE="$HOME/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log"
LAST_OBS_COUNT=0

while true; do
  # Check observations count
  OBS_RESPONSE=$(curl -s 'http://localhost:37777/api/observations?limit=100' 2>/dev/null)
  OBS_COUNT=$(echo "$OBS_RESPONSE" | grep -o '"items":\[.*\]' | grep -o '{' | wc -l | tr -d ' ')
  
  if [ "$OBS_COUNT" != "$LAST_OBS_COUNT" ] && [ "$OBS_COUNT" -gt "$LAST_OBS_COUNT" ]; then
    echo "✅ NEW OBSERVATION! Count: $LAST_OBS_COUNT → $OBS_COUNT"
    LAST_OBS_COUNT=$OBS_COUNT
  fi
  
  # Check for hook activity in logs
  if [ -f "$LOG_FILE" ]; then
    RECENT_HOOK=$(tail -20 "$LOG_FILE" 2>/dev/null | grep -E "HOOK|session.*init|observation" | tail -1)
    if [ ! -z "$RECENT_HOOK" ]; then
      echo "🔥 $RECENT_HOOK"
    fi
  fi
  
  sleep 2
done
