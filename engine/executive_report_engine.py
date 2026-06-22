"""
BOT-ARQ V4.8 - Executive Report Engine

Genera un resumen ejecutivo automatico para lectura rapida.
No ejecuta dinero real y no modifica el motor de senales.
"""
from pathlib import Path
import json
from datetime import datetime

REPORTS_DIR = Path("reports")


def _num(v, default=0.0):
    try:
        if v is None or v == "":
            return float(default)
        return float(v)
    except Exception:
        return float(default)


def _round(v, d=2):
    try:
        return round(float(v), d)
    except Exception:
        return None


def _write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _top_opportunities(resultados, limit=5):
    rows = [r for r in (resultados or []) if str(r.get("Senal Bot", "")).upper() in ("BUY STRONG", "BUY")]
    rows = sorted(rows, key=lambda r: (_num(r.get("Score calidad")), _num(r.get("R/R"))), reverse=True)[:limit]
    return [{
        "ticker": r.get("Accion"),
        "sector": r.get("Sector"),
        "senal_bot": r.get("Senal Bot"),
        "score": _round(r.get("Score calidad"), 1),
        "riesgo": r.get("Riesgo"),
        "rr": _round(r.get("R/R"), 2),
        "precio": _round(r.get("Precio actual"), 2),
        "objetivo": _round(r.get("Objetivo"), 2),
    } for r in rows]


def build_executive_report(historial, resultados=None, mercado=None, config=None, paper_state=None, backtest=None, ticker_health=None):
    historial = historial or {}
    resultados = resultados or []
    mercado = mercado or {}
    paper_state = paper_state or {}
    backtest = backtest or {}
    ticker_health = ticker_health or {}
    resumen = historial.get("resumen", {}) or {}
    reglas = resumen.get("reglas_operativas", {}) or paper_state.get("operational_rules", {}) or {}
    risk = resumen.get("riesgo", {}) or {}
    sim = resumen.get("simulacion", {}) or {}
    bt_summary = backtest.get("summary", {}) or {}
    estado_operativo = reglas.get("estado") or resumen.get("diagnostico_bot", {}).get("modo") or "NORMAL"
    warnings = []
    if estado_operativo != "NORMAL":
        warnings.append(f"Estado operativo {estado_operativo}: {reglas.get('motivo_principal','sin motivo')}")
    if _num(risk.get("exposicion_abierta_pct")) > _num((config or {}).get("max_exposicion_total_pct"), 80):
        warnings.append("Exposicion abierta por encima del limite configurado.")
    if _num(ticker_health.get("omitidos_en_ejecucion")) > 0:
        warnings.append(f"{int(_num(ticker_health.get('omitidos_en_ejecucion')))} tickers omitidos por fallos de datos.")
    if paper_state.get("status", {}).get("warnings"):
        warnings.extend([str(x) for x in paper_state.get("status", {}).get("warnings", [])[:3]])
    top = _top_opportunities(resultados, 5)
    open_ops = [op for op in (historial.get("operaciones", []) or []) if str(op.get("estado","")).upper() == "ABIERTA"][:8]
    if estado_operativo == "BLOQUEADO":
        conclusion = "No abrir nuevas posiciones hasta que bajen riesgo, exposicion o drawdown. Mantener seguimiento de cartera abierta."
    elif estado_operativo == "DEFENSIVO":
        conclusion = "Operar con cautela: priorizar BUY STRONG con riesgo bajo, buena R/R y exposicion controlada."
    else:
        conclusion = "Sistema en estado operativo normal: priorizar oportunidades con score alto, riesgo bajo y R/R favorable."
    report = {
        "updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "version": "V4.8",
        "status": estado_operativo,
        "headline": f"BOT-ARQ en modo {estado_operativo}. Mercado {mercado.get('estado','SIN DATO')}.",
        "summary": {
            "mercado": mercado.get("estado", "SIN DATO"),
            "estado_operativo": estado_operativo,
            "capital_total_estimado_usd": _round(sim.get("capital_actual_total_estimado")),
            "ganancia_total_estimada_usd": _round(sim.get("ganancia_total_estimada_usd")),
            "operaciones_abiertas": risk.get("operaciones_abiertas", len(open_ops)),
            "exposicion_abierta_pct": _round(risk.get("exposicion_abierta_pct", reglas.get("exposicion_abierta_pct"))),
            "riesgo_abierto_pct": _round(risk.get("riesgo_total_abierto_pct", reglas.get("riesgo_abierto_pct"))),
            "drawdown_pct": _round(risk.get("max_drawdown_pct", reglas.get("drawdown_pct"))),
            "backtest_win_rate_pct": _round(bt_summary.get("win_rate_pct")),
            "backtest_profit_factor": _round(bt_summary.get("profit_factor")),
            "backtest_operaciones": bt_summary.get("operaciones_cerradas_evaluadas", bt_summary.get("operaciones", 0)),
        },
        "top_opportunities": top,
        "open_positions": [{
            "ticker": op.get("accion"),
            "sector": op.get("sector"),
            "pnl_usd": _round(op.get("pnl_usd_estimado")),
            "pnl_pct": _round(op.get("ganancia_pct_neta_estimada", op.get("ganancia_pct"))),
            "senal_actual": op.get("senal_bot_actual"),
            "riesgo": op.get("riesgo_actual"),
        } for op in open_ops],
        "alerts": warnings[:8],
        "conclusion": conclusion,
        "recommendations": [
            "Revisar primero estado operativo y limites de exposicion/riesgo.",
            "Usar Top oportunidades como lista de vigilancia, no como orden real.",
            "Validar tickers omitidos antes de interpretar ausencia de senales.",
        ],
        "nota": "Reporte ejecutivo automatico para paper trading simulado. No es asesoria financiera.",
    }
    return report


def _markdown(report):
    s = report.get("summary", {})
    top = report.get("top_opportunities", [])
    alerts = report.get("alerts", [])
    lines = [
        "# BOT-ARQ V4.8 - Reporte Ejecutivo Automatico",
        "",
        f"**Actualizado:** {report.get('updated')}",
        f"**Estado:** {report.get('status')}",
        f"**Titular:** {report.get('headline')}",
        "",
        "## Resumen",
        f"- Mercado: {s.get('mercado')}",
        f"- Capital total estimado USD: {s.get('capital_total_estimado_usd')}",
        f"- G/P total estimada USD: {s.get('ganancia_total_estimada_usd')}",
        f"- Operaciones abiertas: {s.get('operaciones_abiertas')}",
        f"- Exposicion abierta %: {s.get('exposicion_abierta_pct')}",
        f"- Riesgo abierto %: {s.get('riesgo_abierto_pct')}",
        f"- Backtest win rate %: {s.get('backtest_win_rate_pct')}",
        f"- Backtest profit factor: {s.get('backtest_profit_factor')}",
        "",
        "## Alertas",
    ]
    lines += [f"- {a}" for a in alerts] or ["- Sin alertas críticas."]
    lines += ["", "## Top oportunidades"]
    lines += [f"- {x.get('ticker')} · {x.get('senal_bot')} · score {x.get('score')} · R/R {x.get('rr')}" for x in top] or ["- Sin oportunidades BUY/BUY STRONG."]
    lines += ["", "## Conclusión", report.get("conclusion", "")]
    lines += ["", "_Sistema paper trading simulado. No ejecuta dinero real ni reemplaza asesoria financiera._"]
    return "\n".join(lines) + "\n"


def export_executive_report(historial, resultados=None, mercado=None, config=None, paper_state=None, backtest=None, ticker_health=None):
    report = build_executive_report(historial, resultados, mercado, config, paper_state, backtest, ticker_health)
    REPORTS_DIR.mkdir(exist_ok=True)
    _write_json(REPORTS_DIR / "executive_report.json", report)
    (REPORTS_DIR / "executive_report.md").write_text(_markdown(report), encoding="utf-8")
    return report
