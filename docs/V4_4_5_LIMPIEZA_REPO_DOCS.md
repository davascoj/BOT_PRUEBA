# BOT-ARQ V4.4.5 - Limpieza de repo y documentación

Esta versión reduce conflictos de GitHub Desktop al dejar fuera del commit automático los reportes XLSX y los JSON grandes de detalle paper que no consume la web.

Se conservan:
- `datos_acciones.json`
- `historial_senales.json`
- `paper/paper_state.json`
- `paper/paper_audit.json`
- `paper/paper_operational_rules.json`

No se commitean:
- XLSX
- `paper_orders.json`
- `paper_trades.json`
- `paper_portfolio.json`
- `paper_risk.json`
- `paper_status.json`
