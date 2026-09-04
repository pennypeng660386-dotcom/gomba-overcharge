# GOMBA OVERCHARGE V0.1

Standalone local gameplay prototype for GOMBA.

## Goal

Validate the core loop before any Shopify production integration:

PACKAGE → /play → PLAY → HOLD/RELEASE → WIN/FAIL → RETRY → POST-WIN EMAIL INTEREST

## What works

- Mobile-first landing page
- One-thumb hold/release timing mechanic
- PERFECT / GOOD / BURNOUT
- 0–100% core charge
- 3 lives
- Win + fail result screens
- Retry
- Post-win email screen
- Prototype analytics events written to browser console

## Intentionally NOT connected yet

- No real email storage/submission
- No Shopify changes
- No production deployment
- No paid API/SaaS
- No leaderboard/accounts
- No second level/game

## Run on Windows PowerShell

From this project folder:

```powershell
python -m http.server 8080
```

Then open:

http://localhost:8080

For phone testing on the same Wi-Fi, use your PC LAN IP with port 8080 after Windows Firewall allows Python.

## Acceptance criteria for this prototype

PASS only if:

1. PLAY enters the game.
2. Holding/releasing changes the timing result.
3. PERFECT / GOOD add charge.
4. BURNOUT removes a life.
5. 100% reaches FULLY CHARGED.
6. Three burnouts reach SHORT CIRCUIT.
7. PLAY AGAIN starts a fresh game.
8. Post-win CTA opens the email interest screen.
9. No email is actually stored or sent yet.
