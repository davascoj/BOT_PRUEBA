# BOT-ARQ V4.5.1 - Tickers Actualizados

## Objetivo

Limpiar errores repetidos de Yahoo/yfinance causados por tickers problemáticos.

## Cambios

- `CYBR` se retira del universo activo. CyberArk fue adquirido por Palo Alto Networks; `PANW` ya está incluido.
- `FI` se reemplaza por `FISV` para compatibilidad con Yahoo/yfinance.
- `WOLF` se omite temporalmente. El ticker sigue activo, pero el bot actual requiere historial suficiente para cálculo de medias largas y yfinance lo reportó sin datos en la ejecución.

## Archivos modificados

- `analizador_acciones.py`
- `config/system_config.json`
- `config/VERSION_ACTUAL.json`
- `data/ticker_health.json`
- `datos_acciones.json`
- `README.md`

## Seguridad

No se modifica el motor de señales.
No se modifica el paper trading.
No se activa broker real.
