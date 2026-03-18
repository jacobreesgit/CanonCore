#!/usr/bin/env bash
# setup-simulator.sh — Prepare iOS simulator for Maestro E2E testing.
# Disables system dialogs and autofill that interfere with automated tests.
#
# Usage: ./scripts/setup-simulator.sh [SIMULATOR_UDID]
# If no UDID is given, uses the first booted simulator.

set -euo pipefail

UDID="${1:-$(xcrun simctl list devices booted -j | python3 -c "
import sys, json
devs = json.load(sys.stdin)['devices']
for runtime, devices in devs.items():
    for d in devices:
        if d['state'] == 'Booted':
            print(d['udid'])
            sys.exit(0)
print('', end='')
")}"

if [ -z "$UDID" ]; then
  echo "Error: No booted simulator found. Boot one first."
  exit 1
fi

echo "Configuring simulator $UDID for E2E testing..."

# Disable Passwords AutoFill (prevents the "Passwords" bar above the keyboard
# which interferes with secureTextEntry fields in Maestro).
xcrun simctl spawn "$UDID" defaults write com.apple.Preferences AutoFillPasswords -bool NO
xcrun simctl spawn "$UDID" defaults write -g AutoFillPasswords -bool NO
xcrun simctl spawn "$UDID" defaults write -g kPasswordAutoFillIsEnabled -bool NO
xcrun simctl spawn "$UDID" defaults write com.apple.Passwords AutoFillPasswords -bool NO

# Disable keyboard tutorials / tips that block automation.
xcrun simctl spawn "$UDID" defaults write com.apple.Preferences DidShowContinuousPathIntroduction -bool YES
xcrun simctl spawn "$UDID" defaults write com.apple.Preferences DidShowGestureKeyboardIntroduction -bool YES

echo "Simulator $UDID configured for E2E testing."
