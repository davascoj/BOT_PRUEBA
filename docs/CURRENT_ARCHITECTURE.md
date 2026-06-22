# Arquitectura actual BOT-ARQ V4.4.5

## Flujo
GitHub Actions ejecuta `analizador_acciones.py`, actualiza `historial_senales.json`, exporta `datos_acciones.json` y genera `paper/paper_state.json` ligero para GitHub Pages.

## Frontend
La web consume únicamente:
- `datos_acciones.json`
- `paper/paper_state.json`

## Persistencia crítica
`historial_senales.json` se conserva porque mantiene continuidad entre ejecuciones.

## Archivos no versionados
Los XLSX y detalles grandes de paper trading se generan localmente en Actions, pero no se commitean.
