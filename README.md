# BOT-ARQ v4.5 - Position Sizing Pro

BOT-ARQ es un sistema gratuito basado en GitHub Pages + GitHub Actions + Python + JSON + JavaScript para análisis de acciones, señales BUY/HOLD/SELL, simulación, paper trading, auditoría de bloqueos y reglas operativas.

## Estado de esta versión

V4.4.5 acumula:

- V4.4.3: profesionalización visual del dashboard.
- V4.4.4: refresh inteligente, cache-busting por versión y `paper_state.json` ligero.
- V4.4.5: limpieza de archivos generados, menos conflictos y documentación actualizada.

## Archivos que usa directamente la web

- `index.html`
- `script.js`
- `style.css`
- `datos_acciones.json`
- `paper/paper_state.json`

## Archivos de persistencia y auditoría que se conservan

- `historial_senales.json` mantiene la continuidad del paper trading entre ejecuciones de GitHub Actions.
- `paper/paper_audit.json` resume bloqueos.
- `paper/paper_operational_rules.json` resume reglas operativas.

## Archivos que ya no se deben commitear

- `analisis_acciones.xlsx`
- `historial_senales.xlsx`
- `paper/paper_orders.json`
- `paper/paper_trades.json`
- `paper/paper_portfolio.json`
- `paper/paper_risk.json`
- `paper/paper_status.json`

El bot puede generarlos durante una ejecución, pero quedan ignorados para reducir conflictos.

## Seguridad

No ejecuta órdenes reales. Broker real permanece OFF. El sistema sigue siendo paper trading / simulación.


## V4.4.6 Ticker Health Filter

Agrega control de tickers fallidos y panel de salud de datos.


## V4.5 Position Sizing Pro

Limita posiciones por riesgo, capital disponible, reserva de efectivo y exposición por sector.
