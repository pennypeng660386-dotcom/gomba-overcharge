# GOMBA OVERDRIVE V0.2

Standalone relaxing block-clear puzzle for GOMBA.

PLACE → CLEAR → OVERDRIVE

## What works

- 8×8 industrial board
- 3 draggable energy pieces
- Row and column clears
- Core charge and OVERDRIVE
- Offline-ready PWA (after first load)
- Local best score / combo / overdrive stats
- Optional email or phone CTA (not stored, not sent)

## Intentionally NOT connected yet

- No FUNLE CRM
- No Shopify changes
- No paid API/SaaS

## Run

```powershell
python -m http.server 8080
```

Then open http://localhost:8080

## V0.9 production cabinet skin

- Shell bitmap: `assets/ui/cabinet-skin.jpg` (also `assets/reference/v09/03_cabinet_skin_production.png` preferred in CSS)
- Live DOM openings (HUD / board / trays) align over the skin; decorative CSS rim/bolts/pipes are hidden
- Cache bump via `service-worker.js` (`gomba-overdrive-v0.9.3`) so clients pick up new CSS/assets
