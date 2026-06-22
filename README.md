# BOT-ARQ v4.8 - Reporte Ejecutivo Automático

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


---

## V4.5.1 Tickers Actualizados

Corrección de universo de acciones para evitar errores repetidos de Yahoo/yfinance:

- `CYBR` se retira porque CyberArk fue adquirido por Palo Alto Networks; `PANW` ya está incluido en el universo.
- `FI` se reemplaza por `FISV` para compatibilidad con Yahoo/yfinance.
- `WOLF` se omite temporalmente: el ticker sigue existiendo, pero el bot exige suficiente historial para medias largas y yfinance lo reportó sin datos en la ejecución actual.

No se cambia el motor de señales, ni el risk engine, ni paper trading.


## V4.7 Backtesting histórico

Genera `reports/backtest_summary.json` y muestra win rate, profit factor, drawdown y desempeño por sector/señal/mes.


## V4.8 Reporte ejecutivo automático

Genera `reports/executive_report.json` y `reports/executive_report.md` con una lectura ejecutiva del estado del bot. Incluye V4.7 Backtesting histórico.
