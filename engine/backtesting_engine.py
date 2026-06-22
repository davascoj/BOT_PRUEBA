"""
BOT-ARQ V4.7 - Backtesting Engine

Evalua historicamente las operaciones simuladas ya cerradas.
No descarga datos externos y no ejecuta operaciones reales.
"""
from pathlib import Path
from collections import defaultdict
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


def _metrics(rows):
    rows = list(rows or [])
    n = len(rows)
    pnls = [_num(r.get("pnl_usd_estimado"), 0) for r in rows]
    pcts = [_num(r.get("ganancia_pct_final"), _num(r.get("ganancia_pct_neta_estimada"), _num(r.get("ganancia_pct"), 0))) for r in rows]
    wins = [x for x in pnls if x > 0]
    losses = [x for x in pnls if x < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    win_rate = (len(wins) / n * 100) if n else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss else (gross_profit if gross_profit else 0)
    avg_win = (sum(wins) / len(wins)) if wins else 0
    avg_loss = (sum(losses) / len(losses)) if losses else 0
    expectancy = (sum(pnls) / n) if n else 0
    avg_pct = (sum(pcts) / n) if n else 0
    return {
        "operaciones": n,
        "ganadas": len(wins),
        "perdidas": len(losses),
        "win_rate_pct": _round(win_rate),
        "profit_factor": _round(profit_factor),
        "pnl_total_usd": _round(sum(pnls)),
        "pnl_promedio_usd": _round(expectancy),
        "ganancia_promedio_usd": _round(avg_win),
        "perdida_promedio_usd": _round(avg_loss),
        "rentabilidad_promedio_pct": _round(avg_pct),
        "mejor_pnl_usd": _round(max(pnls) if pnls else 0),
        "peor_pnl_usd": _round(min(pnls) if pnls else 0),
    }


def _group_metrics(rows, key):
    groups = defaultdict(list)
    for r in rows:
        val = r.get(key) or "SIN DATO"
        groups[str(val)].append(r)
    out = []
    for name, items in groups.items():
        m = _metrics(items)
        m[key] = name
        out.append(m)
    return sorted(out, key=lambda x: (x.get("pnl_total_usd") or 0), reverse=True)


def _month_key(op):
    f = str(op.get("fecha_cierre") or op.get("fecha_entrada") or "")
    return f[:7] if len(f) >= 7 else "SIN FECHA"


def _equity_curve(closed, capital_inicial):
    ordered = sorted(closed, key=lambda r: (str(r.get("fecha_cierre") or r.get("fecha_entrada") or ""), str(r.get("accion") or "")))
    capital = _num(capital_inicial, 5000)
    peak = capital
    max_dd = 0
    curve = []
    for op in ordered:
        pnl = _num(op.get("pnl_usd_estimado"), 0)
        before = _num(op.get("capital_antes_operacion"), capital)
        after = _num(op.get("capital_despues_operacion"), before + pnl)
        capital = after
        peak = max(peak, capital)
        dd = ((peak - capital) / peak * 100) if peak else 0
        max_dd = max(max_dd, dd)
        curve.append({
            "fecha": op.get("fecha_cierre") or op.get("fecha_entrada"),
            "accion": op.get("accion"),
            "capital": _round(capital),
            "pnl_usd": _round(pnl),
            "drawdown_pct": _round(dd),
        })
    return curve, _round(max_dd)


def build_backtest_report(historial, resultados=None, mercado=None, config=None):
    historial = historial or {}
    config = config or {}
    ops = list(historial.get("operaciones", []) or [])
    closed = [op for op in ops if str(op.get("estado", "")).upper() == "CERRADA"]
    open_ops = [op for op in ops if str(op.get("estado", "")).upper() == "ABIERTA"]
    capital_inicial = _num(config.get("capital_inicial"), 5000)
    curve, max_dd = _equity_curve(closed, capital_inicial)
    by_sector = _group_metrics(closed, "sector")
    by_signal = _group_metrics(closed, "senal_bot_entrada")
    by_month_groups = defaultdict(list)
    for op in closed:
        by_month_groups[_month_key(op)].append(op)
    by_month = []
    for month, items in by_month_groups.items():
        m = _metrics(items)
        m["month"] = month
        by_month.append(m)
    by_month = sorted(by_month, key=lambda x: x["month"])
    best = sorted(closed, key=lambda r: _num(r.get("pnl_usd_estimado"), 0), reverse=True)[:10]
    worst = sorted(closed, key=lambda r: _num(r.get("pnl_usd_estimado"), 0))[:10]
    summary = _metrics(closed)
    summary.update({
        "version": "V4.7",
        "evaluacion": "BACKTEST_HISTORICO_SIMULADO",
        "operaciones_totales_historial": len(ops),
        "operaciones_abiertas": len(open_ops),
        "operaciones_cerradas_evaluadas": len(closed),
        "capital_inicial_usd": _round(capital_inicial),
        "capital_final_estimado_usd": _round(curve[-1]["capital"] if curve else capital_inicial),
        "max_drawdown_pct": max_dd,
        "mercado_actual": (mercado or {}).get("estado", "SIN DATO"),
        "nota": "Backtesting sobre operaciones simuladas guardadas. No es recomendación financiera ni ejecución real.",
    })
    return {
        "updated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "version": "V4.7",
        "status": {"health": "OK", "closed_trades_evaluated": len(closed), "open_trades": len(open_ops)},
        "summary": summary,
        "by_sector": by_sector,
        "by_signal": by_signal,
        "by_month": by_month,
        "equity_curve": curve[-120:],
        "best_trades": [{"ticker": x.get("accion"), "sector": x.get("sector"), "pnl_usd": _round(x.get("pnl_usd_estimado")), "pnl_pct": _round(x.get("ganancia_pct_final")), "tipo_cierre": x.get("tipo_cierre"), "fecha_cierre": x.get("fecha_cierre")} for x in best],
        "worst_trades": [{"ticker": x.get("accion"), "sector": x.get("sector"), "pnl_usd": _round(x.get("pnl_usd_estimado")), "pnl_pct": _round(x.get("ganancia_pct_final")), "tipo_cierre": x.get("tipo_cierre"), "fecha_cierre": x.get("fecha_cierre")} for x in worst],
    }


def export_backtest_reports(historial, resultados=None, mercado=None, config=None):
    report = build_backtest_report(historial, resultados, mercado, config)
    REPORTS_DIR.mkdir(exist_ok=True)
    _write_json(REPORTS_DIR / "backtest_summary.json", report)
    _write_json(REPORTS_DIR / "backtest_by_sector.json", report.get("by_sector", []))
    _write_json(REPORTS_DIR / "backtest_by_signal.json", report.get("by_signal", []))
    _write_json(REPORTS_DIR / "backtest_by_month.json", report.get("by_month", []))
    return report
