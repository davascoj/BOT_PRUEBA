# BOT-ARQ V4.4.6 - Ticker Health Filter

Esta versión detecta tickers que fallan al descargar datos con Yahoo/yfinance, registra sus fallos en `data/ticker_health.json` y los omite temporalmente cuando superan el umbral configurado.

## Qué mejora

- Menos errores repetidos en GitHub Actions.
- Menos tiempo perdido descargando símbolos problemáticos.
- Panel nuevo `Salud de tickers` en el dashboard.
- No modifica la lógica de señales, riesgo ni paper trading.

## Archivo nuevo

`data/ticker_health.json`

## Configuración

`config/system_config.json` → sección `ticker_health`.
