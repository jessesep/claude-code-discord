#!/bin/bash
# Wrapper to run the Deno-based Antigravity mock
# Use this as the 'commandPath' in AntigravityClient options

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
/Users/jessesep/.deno/bin/deno run --allow-read --allow-env "$DIR/antigravity-mock.ts" "$@"
