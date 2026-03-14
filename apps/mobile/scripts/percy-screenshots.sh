#!/usr/bin/env bash
set -euo pipefail

# Percy screenshot upload script
# Run after Maestro E2E flows have captured screenshots
#
# Prerequisites:
#   - PERCY_TOKEN environment variable set
#   - Maestro screenshots in apps/mobile/.maestro/screenshots/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCREENSHOTS_DIR="${SCRIPT_DIR}/../.maestro/screenshots"

if [ ! -d "$SCREENSHOTS_DIR" ]; then
  echo "No screenshots directory found at $SCREENSHOTS_DIR"
  echo "Run Maestro flows first to capture screenshots."
  exit 0
fi

# Count screenshots
SCREENSHOT_COUNT=$(find "$SCREENSHOTS_DIR" -name "*.png" | wc -l | tr -d ' ')
echo "Found $SCREENSHOT_COUNT screenshots to upload"

if [ "$SCREENSHOT_COUNT" -eq 0 ]; then
  echo "No screenshots to upload. Skipping Percy."
  exit 0
fi

# Upload screenshots to Percy (not `percy snapshot` which is for HTML pages)
npx percy upload "$SCREENSHOTS_DIR"

echo "Percy upload complete."
