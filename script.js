"use strict";

const APP_VERSION = "V4.5";
const APP_BUILD = "V4.5";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

let datosGlobales = [];
let datosOriginales = [];
let contextoMercado = null;
let historialOperaciones = [];
let historialResumen = {};
let metricasPro = {};
let simulacionPro = {};
let riesgoPro = {};
let equityCurve = [];
let rendimientoSectores = [];
let rendimientoMercados = [];
let mejoresOperaciones = [];
let peoresOperaciones = [];
let diagnosticoBot = {};
let benchmarkBot = {};
let paperTradingV4 = null;
let paperAuditV43 = null;
let operationalRulesV44 = null;
let configOperativa = null;
let tickerHealth = null;
let positionSizing = null;
let ultimaActualizacionDatos = "";
let rankingRenderizado = false;
let historialRenderizado = false;
let metricasRenderizadas = false;
let equityRenderizada = false;
let paperDetalleRenderizado = false;
let renderTimerRanking = null;
let renderTimerHistorial = null;
let autoRefreshActivo = true;

function $(id) { return document.getElementById(id); }

function safe(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(valor, dec = 2) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return n;
}

function numero(valor, dec = 2) {
  const n = num(valor);
  if (n === null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function money(valor, dec = 2) {
  const n = num(valor);
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function pct(valor, dec = 2) {
  const n = num(valor);
  if (n === null) return "—";
  return `${numero(n, dec)}%`;
}

function precio(valor) { return money(valor, 2).replace("$", ""); }

function campo(obj, claves, fallback = "") {
  for (const k of claves) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function claseValor(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "positive" : "negative";
}

function claseRiesgo(v) {
  const r = String(v || "").toUpperCase();
  if (r.includes("ALTO")) return "risk-high";
  if (r.includes("MEDIO")) return "risk-mid";
  if (r.includes("BAJO")) return "risk-low";
  return "risk-neutral";
}

function claseBot(v) {
  const b = String(v || "").toUpperCase();
  if (b === "BUY STRONG") return "buy-strong";
  if (b === "BUY") return "buy";
  if (b === "SELL") return "sell";
  if (b === "HOLD") return "hold";
  return "neutral-badge";
}

function scoreVisual(score) {
  const s = Number(score || 0);
  const pctFill = Math.max(0, Math.min(100, s));
  const cls = s >= 80 ? "score-good" : s >= 60 ? "score-mid" : "score-low";
  return `<div class="score-visual ${cls}"><span class="score-num">${numero(s, 1)}</span><span class="score-track"><span class="score-fill" style="width:${pctFill}%"></span></span></div>`;
}

function metric(label, value, hint = "", extraClass = "") {
  return `<div class="metric-box ${extraClass}"><span>${safe(label)}</span><strong>${value}</strong>${hint ? `<em>${safe(hint)}</em>` : ""}</div>`;
}

function progressMetric(label, value, maxValue, hint = "") {
  const v = Number(value || 0);
  const m = Number(maxValue || 0);
  const fill = m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const danger = m > 0 && v >= m;
  return `<div class="metric-box progress-box ${danger ? "danger" : ""}"><span>${safe(label)}</span><strong>${pct(v)}</strong><div class="progress"><span style="width:${fill}%"></span></div><em>${hint || `límite ${pct(m)}`}</em></div>`;
}

function cacheBucket(force = false) {
  return force ? String(Date.now()) : String(Math.floor(Date.now() / AUTO_REFRESH_MS));
}

function versionedUrl(path, force = false) {
  return `${path}?v=${encodeURIComponent(APP_BUILD)}&b=${encodeURIComponent(cacheBucket(force))}`;
}

async function fetchJson(path, force = false) {
  const resp = await fetch(versionedUrl(path, force), { cache: "no-store" });
  if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
  return await resp.json();
}

function setDiag(text, kind = "info") {
  const box = $("loadDiagnostics");
  const info = $("autoRefreshInfo");
  if (info) info.textContent = text;
  if (box) box.className = `load-diagnostics ${kind}`;
}

function ejecutarBloqueSeguro(nombre, fn) {
  try { return fn(); }
  catch (error) {
    console.error(`BOT-ARQ: error pintando ${nombre}`, error);
    setDiag(`Datos cargados, pero falló la sección: ${nombre}. Revisa consola.`, "warning");
    return null;
  }
}

function setLoadingState() {
  const placeholders = {
    dashboardEjecutivo: "Cargando panel ejecutivo...",
    marketPanel: "Cargando mercado...",
    operationalRulesResumen: "Cargando reglas operativas...",
    alertasEjecutivas: "Cargando alertas...",
    tickerHealthResumen: "Cargando salud de tickers...",
    positionSizingResumen: "Cargando position sizing...",
    auditSummary: "Cargando auditoría...",
    riesgoResumen: "Cargando riesgo...",
    paperV4Resumen: "Cargando paper engine..."
  };
  for (const [id, msg] of Object.entries(placeholders)) {
    const el = $(id); if (el) el.innerHTML = `<div class="metric-box"><span>${msg}</span><strong>...</strong></div>`;
  }
}

async function cargarDatos(force = false) {
  setLoadingState();
  setDiag("Cargando datos principales...", "info");
  try {
    const data = await fetchJson("datos_acciones.json", force);
    paperTradingV4 = await cargarPaperTradingV4(force);

    const nuevaActualizacion = data.actualizado || "";
    ultimaActualizacionDatos = nuevaActualizacion;

    contextoMercado = data.contexto_mercado || null;
    configOperativa = data.config_operativa || null;
    tickerHealth = data.ticker_health || null;
    positionSizing = data.historial?.resumen?.position_sizing || null;
    datosGlobales = Array.isArray(data.resultados) ? data.resultados : [];
    datosOriginales = datosGlobales;
    historialOperaciones = Array.isArray(data.historial?.operaciones) ? data.historial.operaciones : [];
    historialResumen = data.historial?.resumen || {};
    simulacionPro = historialResumen.simulacion || {};
    riesgoPro = historialResumen.riesgo || {};
    metricasPro = historialResumen.metricas || {};
    equityCurve = historialResumen.equity_curve || [];
    benchmarkBot = historialResumen.benchmark || {};
    rendimientoSectores = historialResumen.rendimiento_por_sector || [];
    rendimientoMercados = historialResumen.rendimiento_por_mercado || [];
    mejoresOperaciones = historialResumen.mejores_operaciones || [];
    peoresOperaciones = historialResumen.peores_operaciones || [];
    diagnosticoBot = historialResumen.diagnostico_bot || {};
    paperAuditV43 = paperTradingV4?.audit || null;
    operationalRulesV44 = paperTradingV4?.operational_rules || paperTradingV4?.risk?.operational_rules || historialResumen.reglas_operativas || null;

    renderHeader(data);
    ejecutarBloqueSeguro("Panel ejecutivo", renderExecutive);
    ejecutarBloqueSeguro("Mercado", renderMarket);
    ejecutarBloqueSeguro("Reglas operativas", renderOperationalRules);
    ejecutarBloqueSeguro("Alertas", renderAlerts);
    ejecutarBloqueSeguro("Position sizing", renderPositionSizing);
    ejecutarBloqueSeguro("Salud de tickers", renderTickerHealth);
    ejecutarBloqueSeguro("Top oportunidades", renderTopOportunidades);
    ejecutarBloqueSeguro("Cartera abierta", renderCarteraAbierta);
    ejecutarBloqueSeguro("Auditoría", renderAudit);
    ejecutarBloqueSeguro("Riesgo y desempeño", renderRiskPerformance);
    ejecutarBloqueSeguro("Render avanzado", renderAdvancedIfOpen);
    initLazyRender();
    updateMarketSessionBadge();

    const ahora = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDiag(`Datos OK · ${datosGlobales.length} acciones · actualización ${nuevaActualizacion || "sin fecha"} · vista ${ahora} · refresco cada 5 min`, "ok");
  } catch (error) {
    console.error("BOT-ARQ: no se pudo cargar datos principales", error);
    renderNoData(error);
  }
}

async function cargarPaperTradingV4(force = false) {
  try { return await fetchJson("paper/paper_state.json", force); }
  catch (error) {
    console.warn("BOT-ARQ: paper_state no disponible; dashboard seguirá sin bloquearse", error);
    return null;
  }
}

function renderNoData(error) {
  const fecha = $("fecha"); if (fecha) fecha.textContent = "Sin datos";
  setDiag(`No se pudo cargar datos_acciones.json. ${error?.message || "Error desconocido"}`, "danger");
  const targets = ["dashboardEjecutivo", "marketPanel", "operationalRulesResumen", "alertasEjecutivas", "riesgoResumen"];
  targets.forEach(id => { const el = $(id); if (el) el.innerHTML = `<div class="metric-box danger"><span>Sin datos</span><strong>Revisar Actions</strong></div>`; });
  const top = $("tablaTopOportunidades"); if (top) top.innerHTML = `<tr><td colspan="11">No hay datos. Ejecuta GitHub Actions o revisa datos_acciones.json.</td></tr>`;
  const cart = $("tablaCarteraAbierta"); if (cart) cart.innerHTML = `<tr><td colspan="10">No hay cartera disponible.</td></tr>`;
}

function renderHeader(data) {
  const version = data.version_bot || APP_VERSION;
  const fecha = data.actualizado || "sin fecha";
  if ($("appVersion")) $("appVersion").textContent = version;
  if ($("fecha")) $("fecha").textContent = fecha;
  const broker = paperTradingV4?.status?.broker_real_enabled;
  if ($("brokerStateText")) $("brokerStateText").textContent = broker ? "ON" : "OFF";
  if ($("paperModeText")) $("paperModeText").textContent = paperTradingV4?.status?.mode || "PAPER ONLY";
}

function renderExecutive() {
  const box = $("dashboardEjecutivo"); if (!box) return;
  const sim = simulacionPro || {};
  const riesgo = riesgoPro || {};
  const portfolio = paperTradingV4?.portfolio || {};
  const rules = operationalRulesV44 || {};
  const estado = rules.estado || diagnosticoBot.modo || "NORMAL";
  if ($("executiveBadge")) $("executiveBadge").textContent = estado;
  box.innerHTML = [
    metric("Capital total estimado", money(sim.capital_actual_total_estimado ?? portfolio.capital_initial_usd ?? 0), "cerrado + abierto"),
    metric("G/P total estimada", money(sim.ganancia_total_estimada_usd ?? portfolio.total_pnl_usd_estimated ?? 0), "incluye posiciones abiertas", claseValor(sim.ganancia_total_estimada_usd ?? portfolio.total_pnl_usd_estimated)),
    metric("Operaciones abiertas", `${safe(riesgo.operaciones_abiertas ?? portfolio.open_positions ?? 0)}/${safe(riesgo.max_operaciones_abiertas ?? "")}`, "cupos de simulación"),
    metric("Exposición / capital actual", pct(riesgo.exposicion_abierta_pct ?? rules.exposicion_abierta_pct ?? 0), "denominador: capital actual estimado"),
    metric("Riesgo abierto", pct(riesgo.riesgo_total_abierto_pct ?? rules.riesgo_abierto_pct ?? 0), "riesgo estimado al stop"),
    metric("Estado operativo", safe(estado), "NORMAL / DEFENSIVO / BLOQUEADO", estado === "NORMAL" ? "" : "warning")
  ].join("");
}

function renderMarket() {
  const box = $("marketPanel"); if (!box) return;
  const m = contextoMercado || {};
  const d = m.drivers || {};
  if ($("marketModeBadge")) $("marketModeBadge").textContent = m.estado || "SIN DATOS";
  const driverCard = (ticker) => {
    const x = d[ticker] || {};
    return `<div class="driver-card"><span>${safe(ticker)}</span><strong>${pct(x.mom20 ?? (ticker === "SPY" ? m.spy20 : m.qqq20) ?? 0)}</strong><em>${safe(x.estado || "")}</em></div>`;
  };
  const sectores = m.sectores || {};
  const sectorRows = Object.entries(sectores).slice(0, 4).map(([k, v]) => `<li><strong>${safe(k)}</strong><span>${safe(v.estado)} · ${safe(v.detalle)}</span></li>`).join("");
  box.innerHTML = `
    <div class="market-main"><span>Modo mercado</span><strong>${safe(m.estado || "SIN DATOS")}</strong><em>score ${safe(m.score ?? "")}</em></div>
    <div class="driver-grid">${driverCard("SPY")}${driverCard("QQQ")}${driverCard("SOXX")}${driverCard("ARKK")}</div>
    <ul class="sector-context">${sectorRows || "<li>Sin contexto sectorial.</li>"}</ul>
  `;
}

function renderOperationalRules() {
  const box = $("operationalRulesResumen"); const badge = $("operationalRulesBadge"); if (!box) return;
  const r = operationalRulesV44;
  if (!r) {
    box.innerHTML = metric("Reglas operativas", "Pendiente", "se llenan al correr Actions");
    if (badge) badge.textContent = "Pendiente";
    return;
  }
  const estado = r.estado || "NORMAL";
  if (badge) badge.textContent = estado;
  const reglas = r.reglas_activas || {};
  box.innerHTML = [
    metric("Estado operativo", safe(estado), safe(r.motivo_principal || "sin motivo"), estado === "NORMAL" ? "" : "warning"),
    progressMetric("Exposición", r.exposicion_abierta_pct, r.max_exposicion_total_pct),
    progressMetric("Riesgo abierto", r.riesgo_abierto_pct, r.max_riesgo_total_abierto_pct),
    progressMetric("Drawdown", r.drawdown_pct, r.bloquear_entradas_drawdown_pct),
    metric("Bloqueos generados", safe(r.bloqueos_generados ?? 0), "última corrida"),
    metric("Reglas ON", `${reglas.exposicion ? "EXP" : ""} ${reglas.riesgo_abierto ? "RISK" : ""} ${reglas.drawdown ? "DD" : ""}`, "controles activos")
  ].join("");
}

function renderAlerts() {
  const box = $("alertasEjecutivas"); if (!box) return;
  const alerts = [];
  const warnings = paperTradingV4?.status?.warnings || [];
  warnings.forEach(w => alerts.push({ type: "warning", text: w }));
  const rules = operationalRulesV44 || {};
  if (rules.estado === "BLOQUEADO") alerts.unshift({ type: "danger", text: `Sistema bloqueado por reglas operativas: ${rules.motivo_principal || "sin motivo"}` });
  else if (rules.estado === "DEFENSIVO") alerts.unshift({ type: "warning", text: `Sistema en modo defensivo: ${rules.motivo_principal || "sin motivo"}` });
  if (!paperTradingV4) alerts.push({ type: "warning", text: "paper_state.json no cargó; se muestra dashboard con datos principales." });
  if ((tickerHealth?.omitidos_en_ejecucion || 0) > 0) alerts.push({ type: "warning", text: `${tickerHealth.omitidos_en_ejecucion} tickers omitidos temporalmente por fallos de datos.` });
  if ((tickerHealth?.fallidos || 0) > 0) alerts.push({ type: "info", text: `${tickerHealth.fallidos} tickers con fallos registrados en ticker health.` });
  if (!alerts.length) { box.innerHTML = `<span class="alert-ok">Sin alertas críticas.</span>`; return; }
  box.innerHTML = alerts.slice(0, 6).map(a => `<span class="alert-chip ${a.type}">${safe(a.text)}</span>`).join("");
}

function accionSugerida(r) {
  const bot = String(r["Senal Bot"] || "").toUpperCase();
  const riesgo = String(r.Riesgo || "").toUpperCase();
  if (bot === "BUY STRONG" && riesgo === "BAJO") return "Prioritaria";
  if (bot === "BUY STRONG") return "Alta prioridad";
  if (bot === "BUY") return "Vigilar entrada";
  return "No abrir";
}



function renderPositionSizing() {
  const box = $("positionSizingResumen");
  const lista = $("sectorExposureLista");
  const badge = $("positionSizingBadge");
  if (!box) return;
  if (!positionSizing) {
    box.innerHTML = metric("Position sizing", "Pendiente", "se genera al correr Actions");
    if (lista) lista.innerHTML = "";
    if (badge) badge.textContent = "Pendiente";
    return;
  }
  if (badge) badge.textContent = positionSizing.mode || "V4.5";
  box.innerHTML = [
    metric("Capital base", money(positionSizing.capital_base_usd), "base de cálculo"),
    metric("Disponible", money(positionSizing.capital_disponible_usd), pct(positionSizing.capital_disponible_pct), Number(positionSizing.capital_disponible_usd || 0) <= 0 ? "danger" : ""),
    metric("Comprometido", money(positionSizing.capital_comprometido_usd), "capital en posiciones"),
    metric("Reserva efectivo", money(positionSizing.reserva_efectivo_usd), pct(positionSizing.reserva_efectivo_pct)),
    metric("Máx sector", pct(positionSizing.max_exposicion_sector_pct), `${safe(positionSizing.max_operaciones_por_sector || 0)} ops/sector`),
    metric("Modo", safe(positionSizing.mode || "RISK_CAPPED"), "riesgo + caja + sector")
  ].join("");
  const sectores = Array.isArray(positionSizing.sectores) ? positionSizing.sectores.slice(0, 8) : [];
  if (lista) {
    lista.innerHTML = sectores.length ? sectores.map(s => `
      <div class="sector-exposure-chip">
        <strong>${safe(s.sector)}</strong>
        <span>${money(s.exposicion_usd)} · ${pct(s.exposicion_pct)} · ${safe(s.operaciones)} ops</span>
      </div>`).join("") : `<span class="muted">Sin exposición sectorial abierta.</span>`;
  }
}

function renderTickerHealth() {
  const box = $("tickerHealthResumen");
  const lista = $("tickerHealthLista");
  const badge = $("tickerHealthBadge");
  if (!box) return;
  if (!tickerHealth) {
    box.innerHTML = metric("Ticker health", "Sin datos", "se genera al correr Actions");
    if (lista) lista.innerHTML = "";
    if (badge) badge.textContent = "Pendiente";
    return;
  }
  const omitidos = Number(tickerHealth.omitidos_en_ejecucion || 0);
  const cooldown = Number(tickerHealth.en_cooldown || 0);
  const fallidos = Number(tickerHealth.fallidos || 0);
  const ok = Number(tickerHealth.ok || 0);
  if (badge) badge.textContent = omitidos > 0 ? `${omitidos} omitidos` : "OK";
  box.innerHTML = [
    metric("Tickers OK", safe(ok), "con datos válidos"),
    metric("Fallidos", safe(fallidos), "con errores registrados", fallidos > 0 ? "warning" : ""),
    metric("En cooldown", safe(cooldown), `umbral ${safe(tickerHealth.fail_threshold || 3)} fallos`, cooldown > 0 ? "warning" : ""),
    metric("Omitidos hoy", safe(omitidos), `cooldown ${safe(tickerHealth.cooldown_days || 7)} días`, omitidos > 0 ? "warning" : "")
  ].join("");
  const recientes = Array.isArray(tickerHealth.fallos_recientes) ? tickerHealth.fallos_recientes.slice(0, 8) : [];
  const omitidosLista = Array.isArray(tickerHealth.omitidos) ? tickerHealth.omitidos.slice(0, 8) : [];
  if (lista) {
    if (!recientes.length && !omitidosLista.length) {
      lista.innerHTML = `<span class="muted">Sin tickers problemáticos recientes.</span>`;
    } else {
      const items = [...omitidosLista.map(x => ({...x, tipo:"OMITIDO"})), ...recientes.map(x => ({...x, tipo:"FALLO"}))].slice(0, 12);
      lista.innerHTML = items.map(x => `<span class="ticker-health-chip ${x.tipo === "OMITIDO" ? "warn" : ""}"><strong>${safe(x.ticker)}</strong> ${safe(x.tipo)} · ${safe(x.motivo || x.last_error || "sin detalle")}</span>`).join("");
    }
  }
}

function renderTopOportunidades() {
  const tbody = $("tablaTopOportunidades"); if (!tbody) return;
  const rows = [...datosOriginales]
    .filter(r => ["BUY STRONG", "BUY"].includes(String(r["Senal Bot"] || "")))
    .sort((a, b) => Number(b["Score calidad"] || 0) - Number(a["Score calidad"] || 0))
    .slice(0, 10);
  if ($("topBadge")) $("topBadge").textContent = `${rows.length} señales`;
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="11">No hay señales BUY disponibles en esta corrida.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => {
    const ticker = safe(r.Accion);
    const bot = safe(r["Senal Bot"]);
    const entrada = `${precio(campo(r, ["Entrada min"]))} - ${precio(campo(r, ["Entrada max"]))}`;
    return `<tr>
      <td class="ticker-cell"><strong>${ticker}</strong><small>${safe(r["Hot Score"] || "")}</small></td>
      <td>${safe(r.Sector)}</td>
      <td class="num">${precio(r["Precio actual"])}</td>
      <td><span class="bot-badge ${claseBot(bot)}">${bot}</span></td>
      <td>${scoreVisual(r["Score calidad"])}</td>
      <td><span class="risk-badge ${claseRiesgo(r.Riesgo)}">${safe(r.Riesgo)}</span></td>
      <td class="num">${entrada}</td>
      <td class="num">${precio(r["Stop loss"])}</td>
      <td class="num">${precio(r.Objetivo)}</td>
      <td class="num">${numero(r["R/R"], 2)}</td>
      <td>${safe(accionSugerida(r))}</td>
    </tr>`;
  }).join("");
}

function renderCarteraAbierta() {
  const tbody = $("tablaCarteraAbierta"); if (!tbody) return;
  const abiertas = historialOperaciones.filter(op => String(op.estado || "").toUpperCase() === "ABIERTA");
  if ($("carteraBadge")) $("carteraBadge").textContent = `${abiertas.length} abiertas`;
  if (!abiertas.length) { tbody.innerHTML = `<tr><td colspan="10">No hay posiciones abiertas simuladas.</td></tr>`; return; }
  tbody.innerHTML = abiertas.slice(0, 40).map(op => {
    const pnlUsd = op.ganancia_abierta_usd_estimada ?? op.pnl_usd_estimado;
    const pnlPct = op.ganancia_pct ?? op.ganancia_pct_neta_estimada;
    const bot = op.senal_bot_actual || op.senal_bot_entrada || "";
    return `<tr>
      <td class="ticker-cell"><strong>${safe(op.accion)}</strong><small>${safe(op.dias_abierta ?? 0)} días</small></td>
      <td>${safe(op.sector)}</td>
      <td class="num">${precio(op.precio_entrada)}</td>
      <td class="num">${precio(op.precio_actual)}</td>
      <td class="num ${claseValor(pnlUsd)}">${money(pnlUsd)}</td>
      <td class="num ${claseValor(pnlPct)}">${pct(pnlPct)}</td>
      <td class="num">${precio(op.stop)}</td>
      <td class="num">${precio(op.objetivo)}</td>
      <td class="num">${money(op.riesgo_usd_estimado)}</td>
      <td><span class="bot-badge ${claseBot(bot)}">${safe(bot || "—")}</span></td>
    </tr>`;
  }).join("");
}

function renderAudit() {
  const summary = $("auditSummary"); const tbody = $("tablaBloqueos"); const badge = $("auditBadge");
  if (!summary || !tbody) return;
  const audit = paperAuditV43;
  if (!audit) {
    summary.innerHTML = metric("Auditoría", "Pendiente", "paper_state no disponible");
    tbody.innerHTML = `<tr><td colspan="7">Sin auditoría disponible.</td></tr>`;
    if (badge) badge.textContent = "Pendiente";
    return;
  }
  const s = audit.summary || {};
  const blocked = audit.blocked_signals || [];
  if (badge) badge.textContent = `${s.blocked_count || 0} bloqueadas`;
  summary.innerHTML = [
    metric("Bloqueadas", safe(s.blocked_count || 0), "señales no abiertas"),
    metric("Candidatas BUY", safe(s.buy_candidates_count || 0), "en análisis"),
    metric("Posiciones abiertas", safe(s.open_positions_count || 0), "al cierre de corrida"),
    metric("Motivo principal", safe(s.main_block_reason || "Sin bloqueos"), "razón más repetida")
  ].join("");
  if (!blocked.length) { tbody.innerHTML = `<tr><td colspan="7">No hay bloqueos registrados.</td></tr>`; return; }
  tbody.innerHTML = blocked.slice(0, 12).map(b => `<tr>
    <td class="ticker-cell"><strong>${safe(b.ticker)}</strong><small>${safe(b.date)}</small></td>
    <td><span class="bot-badge ${claseBot(b.signal)}">${safe(b.signal)}</span></td>
    <td>${scoreVisual(b.score)}</td>
    <td><span class="risk-badge ${claseRiesgo(b.risk)}">${safe(b.risk)}</span></td>
    <td class="num">${numero(b.rr, 2)}</td>
    <td>${safe(b.reason)}</td>
    <td>${b.operational_rule ? '<span class="op-rule-dot">OP</span>' : '<span class="muted">Filtro</span>'}</td>
  </tr>`).join("");
}

function renderRiskPerformance() {
  const box = $("riesgoResumen"); const diag = $("diagnosticoBot"); if (!box) return;
  const r = riesgoPro || {}; const m = metricasPro || {}; const sim = simulacionPro || {};
  if ($("riskBadge")) $("riskBadge").textContent = diagnosticoBot.riesgo_sistema || "Riesgo";
  box.innerHTML = [
    metric("Drawdown máx.", pct(r.max_drawdown_pct ?? 0), "histórico simulado", Number(r.max_drawdown_pct || 0) > 20 ? "warning" : ""),
    metric("Profit factor", numero(m.profit_factor ?? 0, 2), "ganancia / pérdida"),
    metric("Win rate", pct(historialResumen.win_rate ?? m.win_rate ?? 0), "operaciones cerradas"),
    metric("Cerradas", safe(historialResumen.cerradas ?? 0), "operaciones finalizadas"),
    metric("Ganancia cerrada", money(sim.ganancia_cerrada_usd ?? 0), "realizada en simulación", claseValor(sim.ganancia_cerrada_usd)),
    metric("Ganancia abierta", money(sim.ganancia_abierta_usd ?? 0), "mark-to-market", claseValor(sim.ganancia_abierta_usd))
  ].join("");
  if (diag) {
    diag.innerHTML = `<strong>${safe(diagnosticoBot.modo || "SIN MODO")}</strong><span>${safe(diagnosticoBot.descripcion || diagnosticoBot.riesgo_sistema || "Diagnóstico operativo disponible en métricas avanzadas.")}</span>`;
  }
}

function renderAdvancedIfOpen() {
  if ($("paperTradingDetails")?.open) renderPaperDetail();
  if ($("equityDetails")?.open) dibujarEquityCurve();
  if ($("rankingCompletoDetails")?.open) renderRanking();
  if ($("historialCard")?.open) renderHistorial();
  if ($("metricasAvanzadasDetails")?.open) renderMetricasAvanzadas();
  if ($("configTecnicaDetails")?.open) renderConfigTecnica();
}

function initLazyRender() {
  const bind = (id, fn) => { const el = $(id); if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("toggle", () => { if (el.open) ejecutarBloqueSeguro(id, fn); }); } };
  bind("paperTradingDetails", renderPaperDetail);
  bind("equityDetails", dibujarEquityCurve);
  bind("rankingCompletoDetails", renderRanking);
  bind("historialCard", renderHistorial);
  bind("metricasAvanzadasDetails", renderMetricasAvanzadas);
  bind("configTecnicaDetails", renderConfigTecnica);
}

function renderPaperDetail() {
  const box = $("paperV4Resumen"); const warnings = $("paperV4Warnings"); if (!box) return;
  if (!paperTradingV4) { box.innerHTML = metric("Paper engine", "Pendiente", "paper_state no cargó"); return; }
  const s = paperTradingV4.status || {}; const p = paperTradingV4.portfolio || {}; const risk = paperTradingV4.risk || {};
  box.innerHTML = [
    metric("Salud", safe(s.health || "OK"), safe(s.mode || "PAPER")),
    metric("Órdenes simuladas", safe(s.orders_total ?? paperTradingV4.orders?.total ?? 0), "detalle no embebido en dashboard"),
    metric("Trades cerrados", safe(s.trades_closed ?? paperTradingV4.trades?.total ?? 0), "paper trading"),
    metric("Exposición paper", money(p.exposure_usd ?? 0), pct(p.exposure_pct ?? 0)),
    metric("Riesgo paper", money(p.open_risk_usd ?? 0), pct(p.open_risk_pct ?? 0)),
    metric("Cupos disponibles", safe(risk.remaining_position_slots ?? 0), "según config")
  ].join("");
  if (warnings) {
    const w = s.warnings || [];
    warnings.innerHTML = w.length ? `<ul>${w.map(x => `<li>${safe(x)}</li>`).join("")}</ul>` : `<span class="alert-ok">Sin alertas críticas del paper engine.</span>`;
  }
}

function renderRankingDebounced() { clearTimeout(renderTimerRanking); renderTimerRanking = setTimeout(renderRanking, 250); }
function renderHistorialDebounced() { clearTimeout(renderTimerHistorial); renderTimerHistorial = setTimeout(renderHistorial, 250); }

function renderRanking() {
  const tbody = $("tabla"); if (!tbody) return;
  const q = String($("buscarAccion")?.value || "").toUpperCase().trim();
  const soloCompra = !!$("soloCompra")?.checked;
  const soloHot = !!$("soloHot")?.checked;
  const ocultarAlto = !!$("ocultarAlto")?.checked;
  let rows = [...datosOriginales];
  if (q) rows = rows.filter(r => String(r.Accion || "").toUpperCase().includes(q) || String(r.Sector || "").toUpperCase().includes(q));
  if (soloCompra) rows = rows.filter(r => ["BUY STRONG", "BUY"].includes(String(r["Senal Bot"] || "")));
  if (soloHot) rows = rows.filter(r => String(r["Hot Score"] || "").trim());
  if (ocultarAlto) rows = rows.filter(r => String(r.Riesgo || "").toUpperCase() !== "ALTO");
  rows = rows.slice(0, 275);
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="11">Sin resultados para el filtro.</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => `<tr>
    <td class="ticker-cell"><strong>${safe(r.Accion)}</strong><small>${safe(r["Hot Score"] || "")}</small></td>
    <td>${safe(r.Sector)}</td><td class="num">${precio(r["Precio actual"])}</td>
    <td><span class="bot-badge ${claseBot(r["Senal Bot"])}">${safe(r["Senal Bot"])}</span></td>
    <td>${scoreVisual(r["Score calidad"])}</td>
    <td><span class="risk-badge ${claseRiesgo(r.Riesgo)}">${safe(r.Riesgo)}</span></td>
    <td class="num">${numero(r["R/R"], 2)}</td>
    <td class="num">${precio(r["Entrada min"])} - ${precio(r["Entrada max"])}</td>
    <td class="num">${precio(r["Stop loss"])}</td><td class="num">${precio(r.Objetivo)}</td>
    <td>${safe(r["Contexto sector"] || "")}</td>
  </tr>`).join("");
}

function renderHistorial() {
  const tbody = $("tablaHistorial"); if (!tbody) return;
  const q = String($("buscarHistorial")?.value || "").toUpperCase().trim();
  const estado = $("filtroEstadoHistorial")?.value || "TODOS";
  const resultado = $("filtroResultadoHistorial")?.value || "TODOS";
  let rows = [...historialOperaciones];
  if (q) rows = rows.filter(op => String(op.accion || "").toUpperCase().includes(q) || String(op.resultado || "").toUpperCase().includes(q));
  if (estado !== "TODOS") rows = rows.filter(op => String(op.estado || "").toUpperCase() === estado);
  if (resultado !== "TODOS") rows = rows.filter(op => String(op.resultado || "").toUpperCase() === resultado);
  rows = rows.slice(0, 120);
  renderHistorialResumen();
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="11">Sin historial para el filtro.</td></tr>`; return; }
  tbody.innerHTML = rows.map(op => {
    const actual = op.precio_cierre ?? op.precio_actual;
    const pnlUsd = op.pnl_usd_estimado ?? op.ganancia_abierta_usd_estimada;
    const pnlPct = op.ganancia_pct_final ?? op.ganancia_pct ?? op.ganancia_pct_neta_estimada;
    const bot = op.senal_bot_actual || op.senal_bot_entrada || "";
    return `<tr>
      <td>${safe(op.estado)}</td><td class="ticker-cell"><strong>${safe(op.accion)}</strong><small>${safe(op.fecha_entrada)}</small></td>
      <td>${safe(op.sector)}</td><td class="num">${precio(op.precio_entrada)}</td><td class="num">${precio(actual)}</td>
      <td class="num ${claseValor(pnlUsd)}">${money(pnlUsd)}</td><td class="num ${claseValor(pnlPct)}">${pct(pnlPct)}</td>
      <td class="num">${precio(op.stop)}</td><td class="num">${precio(op.objetivo)}</td>
      <td><span class="bot-badge ${claseBot(bot)}">${safe(bot || "—")}</span></td><td>${safe(op.resultado || "EN SEGUIMIENTO")}</td>
    </tr>`;
  }).join("");
}

function renderHistorialResumen() {
  const box = $("historialResumen"); if (!box) return;
  box.innerHTML = [
    metric("Total", safe(historialResumen.total_operaciones ?? historialOperaciones.length), "operaciones"),
    metric("Abiertas", safe(historialResumen.abiertas ?? 0), "vigentes"),
    metric("Cerradas", safe(historialResumen.cerradas ?? 0), "finalizadas"),
    metric("Win rate", pct(historialResumen.win_rate ?? 0), "cerradas"),
    metric("Rent. cerrada", pct(historialResumen.rentabilidad_cerrada_pct ?? 0), "neta estimada"),
    metric("Rent. abierta", pct(historialResumen.rentabilidad_abierta_pct ?? 0), "mark-to-market")
  ].join("");
  if ($("historialFecha")) $("historialFecha").textContent = `Actualizado: ${safe(ultimaActualizacionDatos || "sin fecha")}`;
}

function renderMetricasAvanzadas() {
  const fill = (id, rows, mapper, cols) => { const tb = $(id); if (!tb) return; tb.innerHTML = rows?.length ? rows.slice(0, 12).map(mapper).join("") : `<tr><td colspan="${cols}">Sin datos.</td></tr>`; };
  fill("tablaSectores", rendimientoSectores, r => `<tr><td>${safe(r.sector)}</td><td>${safe(r.operaciones)}</td><td>${pct(r.win_rate)}</td><td>${pct(r.rentabilidad_neta_pct)}</td><td>${numero(r.profit_factor,2)}</td></tr>`, 5);
  fill("tablaMercados", rendimientoMercados, r => `<tr><td>${safe(r.mercado)}</td><td>${safe(r.operaciones)}</td><td>${pct(r.win_rate)}</td><td>${pct(r.rentabilidad_neta_pct)}</td><td>${numero(r.profit_factor,2)}</td></tr>`, 5);
  fill("tablaMejores", mejoresOperaciones, r => `<tr><td>${safe(r.accion)}</td><td>${pct(r.ganancia_pct_final)}</td><td>${money(r.pnl_usd_estimado)}</td><td>${safe(r.tipo_cierre)}</td></tr>`, 4);
  fill("tablaPeores", peoresOperaciones, r => `<tr><td>${safe(r.accion)}</td><td>${pct(r.ganancia_pct_final)}</td><td>${money(r.pnl_usd_estimado)}</td><td>${safe(r.tipo_cierre)}</td></tr>`, 4);
}

function dibujarEquityCurve() {
  const canvas = $("equityChart"); if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const data = equityCurve || [];
  if (!data.length) { ctx.fillStyle = "#94a3b8"; ctx.fillText("Sin equity curve disponible", 30, 40); return; }
  const values = data.map(x => Number(x.capital_total ?? x.capital ?? 0)).filter(Number.isFinite);
  if (!values.length) return;
  const min = Math.min(...values), max = Math.max(...values), pad = 28;
  ctx.strokeStyle = "rgba(148,163,184,.35)"; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, canvas.width - pad*2, canvas.height - pad*2);
  ctx.beginPath(); ctx.lineWidth = 3; ctx.strokeStyle = "#38bdf8";
  values.forEach((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (canvas.width - pad*2);
    const y = canvas.height - pad - ((v - min) / Math.max(max - min, 1)) * (canvas.height - pad*2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0"; ctx.font = "14px system-ui";
  ctx.fillText(`Capital: ${money(values.at(-1))}`, pad, 20);
}

function renderConfigTecnica() {
  const pre = $("configTecnica"); if (!pre) return;
  const payload = { app_version: APP_VERSION, build: APP_BUILD, data_updated: ultimaActualizacionDatos, config_operativa: configOperativa, paper_status: paperTradingV4?.status || null, files_consumed_by_frontend: ["datos_acciones.json", "paper/paper_state.json"] };
  pre.textContent = JSON.stringify(payload, null, 2);
}

function ejecutarAnalisis() {
  const usuario = "davascoj";
  const repoDetectado = location.pathname.split("/").filter(Boolean)[0];
  const repo = repoDetectado || "BOT-ARQv2";
  window.open(`https://github.com/${usuario}/${repo}/actions/workflows/analizar.yml`, "_blank");
}

function getHoraNY() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const d = {}; p.forEach(x => d[x.type] = x.value);
  return { weekday: d.weekday, hour: Number(d.hour), minute: Number(d.minute) };
}

function updateMarketSessionBadge() {
  const badge = $("marketStatusBadge"); const txt = $("marketStatusText"); if (!badge || !txt) return;
  const ny = getHoraNY(); const days = ["Mon","Tue","Wed","Thu","Fri"]; const mins = ny.hour * 60 + ny.minute;
  badge.classList.remove("on", "off", "pre");
  if (days.includes(ny.weekday) && mins >= 570 && mins < 960) { badge.classList.add("on"); txt.textContent = "abierto"; }
  else if (days.includes(ny.weekday) && mins >= 540 && mins < 570) { badge.classList.add("pre"); txt.textContent = "preapertura"; }
  else { badge.classList.add("off"); txt.textContent = "cerrado"; }
}

function init() {
  cargarDatos(true);
  setInterval(() => { if (!document.hidden && autoRefreshActivo) cargarDatos(false); }, AUTO_REFRESH_MS);
  setInterval(updateMarketSessionBadge, 30000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
