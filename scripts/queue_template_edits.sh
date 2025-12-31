#!/bin/bash
# Queue template edits with delays for demo purposes
# Usage: ./scripts/queue_template_edits.sh <template-name> [num-edits] [delay-ms] [initial-delay-ms]

TEMPLATE_NAME=${1:-srtd_demo_greet.sql}
NUM_EDITS=${2:-3}
DELAY_MS=${3:-2000}
INITIAL_DELAY_MS=${4:-3000}

DELAY_S=$(echo "scale=2; $DELAY_MS / 1000" | bc)
INITIAL_S=$(echo "scale=2; $INITIAL_DELAY_MS / 1000" | bc)

TEMPLATE="supabase/migrations-templates/$TEMPLATE_NAME"
GREETINGS=("Hello" "Hey" "Howdy" "Greetings" "Hi" "Yo" "Hola" "Aloha")

echo "Queuing $NUM_EDITS edits to $TEMPLATE_NAME"
echo "  First in ${INITIAL_S}s, then every ${DELAY_S}s"
echo "  Hello → Hey → Howdy → Greetings"

CURRENT="Hello"
for ((i=1; i<=NUM_EDITS; i++)); do
  NEXT="${GREETINGS[$i]}"
  if [ $i -eq 1 ]; then
    WAIT="$INITIAL_S"
  else
    WAIT=$(echo "scale=2; $INITIAL_S + ($i - 1) * $DELAY_S" | bc)
  fi
  (
    sleep $WAIT
    sed -i '' "s/$CURRENT/$NEXT/" "$TEMPLATE"
  ) &
  CURRENT="$NEXT"
done
