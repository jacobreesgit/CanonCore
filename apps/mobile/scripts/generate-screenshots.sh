#!/usr/bin/env bash
set -euo pipefail

# Generate store listing screenshots using Maestro
# Requires: Maestro CLI, running iOS Simulator and/or Android Emulator
#
# Usage:
#   ./scripts/generate-screenshots.sh ios      # iOS only
#   ./scripts/generate-screenshots.sh android  # Android only
#   ./scripts/generate-screenshots.sh          # Both platforms

PLATFORM="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCREENSHOTS_DIR="$PROJECT_DIR/screenshots"
FLOWS_DIR="$PROJECT_DIR/.maestro/screenshots"

echo "=== CanonCore Screenshot Generation ==="
echo "Platform: $PLATFORM"
echo "Output:   $SCREENSHOTS_DIR"
echo ""

run_flows() {
  local platform="$1"
  local output_dir="$SCREENSHOTS_DIR/$platform"

  mkdir -p "$output_dir"

  echo "--- Running screenshot flows for $platform ---"

  for flow in "$FLOWS_DIR"/screenshot-*.yaml; do
    local name
    name=$(basename "$flow" .yaml)
    echo "  Running: $name"

    # Run Maestro flow — takeScreenshot saves to ~/.maestro/tests/
    maestro test "$flow" 2>&1 | tail -1
  done

  # Copy screenshots from Maestro's default output to our screenshots dir
  echo "  Copying screenshots to: $output_dir"
  find ~/.maestro/tests/ -name "*.png" -newer "$FLOWS_DIR" -exec cp {} "$output_dir/" \;

  echo ""
}

if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "all" ]]; then
  run_flows "ios"
fi

if [[ "$PLATFORM" == "android" || "$PLATFORM" == "all" ]]; then
  run_flows "android"
fi

echo "=== Done ==="
echo ""
echo "Screenshots are in: $SCREENSHOTS_DIR"
echo ""
echo "Required sizes for stores:"
echo "  iOS:     iPhone 6.9\" (1320x2868), 6.5\" (1284x2778)"
echo "  Android: Phone (min 320px-3840px per side, 16:9 ratio)"
echo ""
echo "Upload screenshots to App Store Connect and Google Play Console."
