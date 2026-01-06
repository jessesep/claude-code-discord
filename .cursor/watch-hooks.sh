#!/bin/bash
# Real-time hook monitoring dashboard

WORKER_URL="http://localhost:37777"
LOG_FILE="$HOME/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log"

echo "═══════════════════════════════════════════════════════════"
echo "  🔍 Claude-Mem Hooks Monitor"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Watching for hook activity..."
echo "Try using Cursor now (submit prompt, edit file, run command)"
echo ""
echo "Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════"
echo ""

LAST_OBS=0
LAST_LOG_LINE=""

while true; do
  # Get observation count
  OBS_DATA=$(curl -s "$WORKER_URL/api/observations?limit=100" 2>/dev/null)
  if [ $? -eq 0 ]; then
    OBS_COUNT=$(echo "$OBS_DATA" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('items', [])))" 2>/dev/null || echo "0")
    
    if [ "$OBS_COUNT" != "$LAST_OBS" ]; then
      if [ "$OBS_COUNT" -gt "$LAST_OBS" ]; then
        echo "✅ [$(date +%H:%M:%S)] NEW OBSERVATION! Count: $LAST_OBS → $OBS_COUNT"
      fi
      LAST_OBS=$OBS_COUNT
    fi
  fi
  
  # Watch log file for hook activity
  if [ -f "$LOG_FILE" ]; then
    CURRENT_LINE=$(tail -1 "$LOG_FILE" 2>/dev/null)
    if [ "$CURRENT_LINE" != "$LAST_LOG_LINE" ] && [ ! -z "$CURRENT_LINE" ]; then
      if echo "$CURRENT_LINE" | grep -qE "HOOK|session|observation|beforeSubmit|afterFile|beforeShell|beforeMCP|stop"; then
        echo "🔥 [$(date +%H:%M:%S)] $CURRENT_LINE"
      fi
      LAST_LOG_LINE="$CURRENT_LINE"
    fi
  fi
  
  sleep 1
done
