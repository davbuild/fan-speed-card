/**
 * fan-speed-card — tarjeta Lovelace para entidades `fan`, con el estilo de la
 * tarjeta de termostato de Home Assistant: dial circular de 270°, botones −/+
 * y "chips" inferiores (estado, dirección de giro y, opcionalmente, luz).
 *
 *   type: custom:fan-speed-card
 *   entity: fan.ventilador_salon
 *   name: Ventilador salón     # opcional
 *   speeds: 6                  # opcional (por defecto: las que declare la entidad, o 6)
 *   light_entity: light.xxx    # opcional (light.*, switch.* o input_boolean.*): botón para la luz del ventilador
 *   animate_icon: true         # opcional; false = el icono de las aspas no gira
 */
const SUPPORT_DIRECTION = 4;
// HA publica la dirección en el atributo `direction` (en versiones antiguas, `current_direction`)
const dirOf = (s) => s.attributes.direction || s.attributes.current_direction || "forward";
const SPIN = [3.2, 2.2, 1.5, 1.0, 0.65, 0.4]; // segundos por vuelta, de lento a rápido

// Geometría del dial: arco de 270° que empieza abajo-izquierda (135°) y acaba abajo-derecha (45°)
const C = 100, R = 82, START = 135, SWEEP = 270;
const pt = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
};
const arc = (from, to) => {
  const [x1, y1] = pt(from), [x2, y2] = pt(to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

// Textos propios. Los valores de estado y dirección se piden primero a Home Assistant
// (hass.formatEntityState / formatEntityAttributeValue), que ya los traduce a todos sus idiomas;
// este diccionario cubre las etiquetas de la tarjeta y es el respaldo. Idioma desconocido → inglés.
const STR = {
  en: { light: "Light", state: "State", direction: "Direction", on: "On", off: "Off", unavailable: "Unavailable", forward: "Forward", reverse: "Reverse", notFound: "Entity not found", less: "Decrease speed", more: "Increase speed" },
  es: { light: "Luz", state: "Estado", direction: "Dirección", on: "Encendido", off: "Apagado", unavailable: "No disponible", forward: "Adelante", reverse: "Inversa", notFound: "Entidad no encontrada", less: "Bajar velocidad", more: "Subir velocidad" },
  fr: { light: "Lumière", state: "État", direction: "Direction", on: "Allumé", off: "Éteint", unavailable: "Indisponible", forward: "Avant", reverse: "Inverse", notFound: "Entité introuvable", less: "Réduire la vitesse", more: "Augmenter la vitesse" },
  de: { light: "Licht", state: "Status", direction: "Richtung", on: "An", off: "Aus", unavailable: "Nicht verfügbar", forward: "Vorwärts", reverse: "Rückwärts", notFound: "Entität nicht gefunden", less: "Langsamer", more: "Schneller" },
  pt: { light: "Luz", state: "Estado", direction: "Direção", on: "Ligado", off: "Desligado", unavailable: "Indisponível", forward: "Frente", reverse: "Inversa", notFound: "Entidade não encontrada", less: "Diminuir velocidade", more: "Aumentar velocidade" },
  it: { light: "Luce", state: "Stato", direction: "Direzione", on: "Acceso", off: "Spento", unavailable: "Non disponibile", forward: "Avanti", reverse: "Inversa", notFound: "Entità non trovata", less: "Riduci velocità", more: "Aumenta velocità" },
  nl: { light: "Licht", state: "Status", direction: "Richting", on: "Aan", off: "Uit", unavailable: "Niet beschikbaar", forward: "Vooruit", reverse: "Achteruit", notFound: "Entiteit niet gevonden", less: "Langzamer", more: "Sneller" },
  ca: { light: "Llum", state: "Estat", direction: "Direcció", on: "Encès", off: "Apagat", unavailable: "No disponible", forward: "Endavant", reverse: "Inversa", notFound: "Entitat no trobada", less: "Baixar velocitat", more: "Pujar velocitat" },
  pl: { light: "Światło", state: "Stan", direction: "Kierunek", on: "Włączony", off: "Wyłączony", unavailable: "Niedostępny", forward: "Do przodu", reverse: "Wstecz", notFound: "Nie znaleziono encji", less: "Zmniejsz prędkość", more: "Zwiększ prędkość" },
};

const ICON = {
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  minus: "M19,13H5V11H19V13Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  rotate: "M16.89,15.5L18.31,16.89C19.21,15.73 19.76,14.39 19.93,13H17.91C17.77,13.87 17.43,14.72 16.89,15.5M13,17.9V19.92C14.39,19.75 15.74,19.21 16.9,18.31L15.46,16.87C14.71,17.41 13.87,17.76 13,17.9M19.93,11C19.76,9.61 19.21,8.27 18.31,7.11L16.89,8.53C17.43,9.28 17.77,10.13 17.91,11M15.55,5.55L11,1V4.07C7.06,4.56 4,7.92 4,12C4,16.08 7.05,19.44 11,19.93V17.91C8.16,17.43 6,14.97 6,12C6,9.03 8.16,6.57 11,6.09V10L15.55,5.55Z",
};
const svgIcon = (d, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
ICON.bulb = "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z";
// mdi:fan (el mismo icono de aspas que usa Home Assistant)
ICON.fan = "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z";
const FAN_ICON = svgIcon(ICON.fan, "fanic");

class FanSpeedCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("Define 'entity' (fan.*)");
    this._config = { ...config };
    this._built = false;
    this._drag = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built || this._builtN !== this._n()) this._build();
    this._update();
  }

  _lang() {
    const l = this._config.language || this._hass?.locale?.language || this._hass?.language || "en";
    const base = String(l).toLowerCase().split("-")[0];
    return STR[base] ? base : "en";
  }
  _t(key) { return STR[this._lang()][key]; }

  // Estado traducido por HA ("On", "Aus", "Allumé"...); si no puede, usa nuestro diccionario
  _stateText(s) {
    if (this._config.language && this._config.language !== this._hass?.locale?.language) return this._t(s.state) ?? s.state;
    const txt = this._hass?.formatEntityState?.(s);
    return txt && txt.toLowerCase() !== s.state ? txt : this._t(s.state) ?? s.state;
  }
  _dirText(s, dir) {
    if (this._config.language && this._config.language !== this._hass?.locale?.language) return this._t(dir);
    const txt = this._hass?.formatEntityAttributeValue?.(s, "direction" in s.attributes ? "direction" : "current_direction");
    return txt && String(txt).toLowerCase() !== dir ? txt : this._t(dir);
  }

  getCardSize() { return 6; }
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((k) => k.startsWith("fan."));
    return { entity: e || "fan.ejemplo" };
  }

  _build() {
    const n = (this._builtN = this._n());
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const ticks = Array.from({ length: n + 1 }, (_, i) => {
      const [x, y] = pt(START + (SWEEP * i) / n);
      return `<circle class="tick" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.7"/>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { --accent: var(--state-fan-active-color, var(--primary-color, #03a9f4)); }
        ha-card { padding: 16px; user-select: none; }
        .name { text-align:center; color: var(--secondary-text-color); font-size:.95rem; margin-bottom:-4px; }
        .dial { position:relative; max-width: 300px; margin: 0 auto; container-type: inline-size; }
        svg.ring { display:block; width:100%; touch-action:none; cursor:pointer; outline:none; }
        .track { fill:none; stroke: color-mix(in srgb, var(--primary-text-color) 10%, transparent); stroke-width:14; stroke-linecap:round; }
        .active { fill:none; stroke: var(--accent); stroke-width:14; stroke-linecap:round; transition: stroke .3s; }
        .dial:not(.on) .active { stroke: color-mix(in srgb, var(--primary-text-color) 30%, transparent); }
        .tick { fill: var(--primary-text-color); opacity:.35; }
        .handle { fill:#fff; stroke: rgba(0,0,0,.25); stroke-width:.8; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
        .center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; padding-bottom: 14%; }
        .label { font-size:.8rem; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color: var(--secondary-text-color); margin-bottom: 2px; transition: color .3s; }
        .dial.on .label { color: var(--accent); }
        .value { color: var(--primary-text-color); font-size: 30cqw; font-weight:200; line-height:1; display:flex; align-items:baseline; justify-content:center;
                 font-variant-numeric: tabular-nums; letter-spacing:-.02em; transition: opacity .3s; }
        .dial:not(.on) .value { opacity:.45; }
        .value small { font-size: 8cqw; margin-left: 2px; color: var(--secondary-text-color); font-weight:300; letter-spacing:0; }
        .btns { position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:center; gap:clamp(20px, 10cqw, 30px); }
        .btns button {
          width:clamp(40px, 15cqw, 48px); height:clamp(40px, 15cqw, 48px); border-radius:50%; cursor:pointer; padding:0;
          background:transparent; color: var(--primary-text-color);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 35%, transparent);
          display:grid; place-items:center; transition: background .2s;
        }
        .btns button:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, transparent); }
        .btns button:disabled { opacity:.35; cursor:default; }
        .chips { display:flex; justify-content:center; gap:14px; margin-top:14px; }
        .chip {
          --lit: var(--accent);
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          width:56px; height:56px; padding:0; border:none; border-radius:18px;
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          transition: background .25s, color .25s, box-shadow .25s;
        }
        .chip:hover { background: color-mix(in srgb, var(--primary-text-color) 13%, transparent); }
        .chip.on { color: var(--lit); background: color-mix(in srgb, var(--lit) 20%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--lit) 30%, transparent); }
        .chip.dir.rev { --lit: var(--error-color, #db4437); }
        .chip.light { --lit: var(--state-light-active-color, #ffc107); }
        .chip:disabled { opacity:.45; cursor:default; box-shadow:none; }
        .chip .t { display:none; }
        .chip[hidden] { display:none; }
        .ic { width:26px; height:26px; fill: currentColor; flex:none; }
        .btns .ic { width:24px; height:24px; }
        .fanic { transform-origin:50% 50%; }
        .chip.on .fanic { animation: spin var(--dur, 2s) linear infinite; }
        .chip.on.rev .fanic { animation-direction: reverse; }
        .noanim .fanic { animation: none !important; }
        .mirror { transform: scaleX(-1); }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <ha-card>
        <div class="name"></div>
        <div class="dial">
          <svg class="ring" viewBox="0 0 200 200" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="${n}">
            <path class="track" d="${arc(START, START + SWEEP)}"/>
            <path class="active" d=""/>
            ${ticks}
            <circle class="handle" r="10"/>
          </svg>
          <div class="center">
            <div class="label"></div>
            <div class="value"><span class="num">0</span><small>/${n}</small></div>
          </div>
          <div class="btns">
            <button class="minus">${svgIcon(ICON.minus)}</button>
            <button class="plus">${svgIcon(ICON.plus)}</button>
          </div>
        </div>
        <div class="chips">
          <button class="chip power">${FAN_ICON}<span class="t"><span class="k"></span><span class="v"></span></span></button>
          <button class="chip dir">${svgIcon(ICON.rotate, "dirico")}<span class="t"><span class="k"></span><span class="v"></span></span></button>
          ${this._config.light_entity ? `<button class="chip light">${svgIcon(ICON.bulb)}<span class="t"><span class="k"></span><span class="v"></span></span></button>` : ""}
        </div>
      </ha-card>`;

    const r = this.shadowRoot;
    const ring = r.querySelector("svg.ring");
    ring.addEventListener("pointerdown", (e) => {
      if (this._disabled) return;
      ring.setPointerCapture(e.pointerId);
      this._drag = this._pointerLevel(e, ring);
      this._renderDial(this._drag, this._drag > 0);
    });
    ring.addEventListener("pointermove", (e) => {
      if (this._drag == null) return;
      const l = this._pointerLevel(e, ring);
      if (l !== this._drag) { this._drag = l; this._renderDial(l, l > 0); }
    });
    const end = () => {
      if (this._drag == null) return;
      const l = this._drag;
      this._drag = null;
      this._setLevel(l);
    };
    ring.addEventListener("pointerup", end);
    ring.addEventListener("pointercancel", () => { this._drag = null; this._update(); });
    ring.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); this._step(d); }
    });
    r.querySelector(".minus").addEventListener("click", () => this._step(-1));
    r.querySelector(".plus").addEventListener("click", () => this._step(1));
    r.querySelector(".power").addEventListener("click", () => this._toggle());
    r.querySelector(".dir").addEventListener("click", () => this._toggleDir());
    const light = r.querySelector(".light");
    if (light) {
      // pulsación corta: alterna la luz; pulsación larga: abre el diálogo de la luz en Home Assistant
      let timer = null, held = false;
      const clear = () => { clearTimeout(timer); timer = null; };
      light.addEventListener("pointerdown", () => {
        held = false;
        timer = setTimeout(() => {
          held = true;
          this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.light_entity } }));
        }, 500);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => light.addEventListener(ev, clear));
      light.addEventListener("click", () => { if (!held) this._toggleLight(); held = false; });
    }
    this._built = true;
  }

  _pointerLevel(e, ring) {
    const n = this._n();
    const b = ring.getBoundingClientRect();
    const deg = (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI;
    let a = (deg - START + 360) % 360;
    if (a > SWEEP) a = a > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP; // zona muerta inferior: ajusta al extremo más cercano
    return Math.round((a / SWEEP) * n);
  }

  _stateObj() { return this._hass.states[this._config.entity]; }
  // Nº de velocidades: el configurado o, si no, el que declara la entidad (percentage_step); por defecto 6
  _n() {
    if (this._config.speeds) return this._config.speeds;
    const step = this._stateObj()?.attributes.percentage_step;
    return step > 0 ? Math.max(1, Math.round(100 / step)) : 6;
  }
  _pctStep() {
    const s = this._stateObj();
    return (s && s.attributes.percentage_step) || 100 / this._n();
  }
  // Porcentaje para el nivel l. HA calcula la velocidad como ceil(n·pct/100), así que se redondea
  // hacia abajo: con 6 velocidades 4·16,67 = 66,67 → 67 % sería la velocidad 5, y 66 % es la 4.
  _pct(l) { return Math.min(100, Math.max(1, Math.floor(l * this._pctStep() + 1e-9))); }
  _level() {
    const s = this._stateObj();
    if (!s || s.state !== "on") return 0;
    return Math.min(this._n(), Math.round((s.attributes.percentage ?? 0) / this._pctStep()));
  }

  // Última velocidad > 0, para mostrarla en gris cuando el ventilador está apagado y restaurarla al encender
  _lastKey() { return `fan-speed-card:${this._config.entity}`; }
  _lastLevel() {
    if (this._last == null) {
      try { this._last = Number(localStorage.getItem(this._lastKey())) || 0; } catch (e) { this._last = 0; }
    }
    return Math.min(this._last, this._n());
  }
  _remember(l) {
    if (l > 0 && l !== this._last) {
      this._last = l;
      try { localStorage.setItem(this._lastKey(), String(l)); } catch (e) { /* sin almacenamiento */ }
    }
  }

  _renderDial(lvl, on) {
    const n = this._n();
    const r = this.shadowRoot;
    const ang = START + (SWEEP * lvl) / n;
    r.querySelector(".active").setAttribute("d", lvl > 0 ? arc(START, ang) : "");
    const [x, y] = pt(ang);
    const h = r.querySelector(".handle");
    h.setAttribute("cx", x.toFixed(2));
    h.setAttribute("cy", y.toFixed(2));
    r.querySelector(".num").textContent = lvl;
    on = on && !this._disabled;
    r.querySelector(".dial").classList.toggle("on", on);
    r.querySelector("svg.ring").setAttribute("aria-valuenow", lvl);
    r.querySelector(".minus").disabled = this._disabled || lvl <= 0;
    r.querySelector(".plus").disabled = this._disabled || lvl >= n;
    const s = this._stateObj();
    r.querySelector(".label").textContent = this._disabled ? this._t("unavailable") : s ? this._stateText({ ...s, state: on ? "on" : "off" }) : "";
  }

  _update() {
    const s = this._stateObj();
    const r = this.shadowRoot;
    if (!s) { r.querySelector(".label").textContent = `${this._t("notFound")}: ${this._config.entity}`; return; }
    const n = this._n();
    const on = s.state === "on";
    this._disabled = s.state === "unavailable";
    // tras bajar a 0 el estado sigue 'on' hasta que HA confirma el apagado: se muestra 0 y no se memoriza
    const zeroing = on && Date.now() < (this._zeroUntil || 0);
    const real = zeroing ? 0 : this._level();
    this._remember(real);
    // apagado: se conserva la última velocidad, pintada en gris
    const lvl = this._drag ?? (real || this._lastLevel());
    const showOn = (this._drag ?? real) > 0;
    const dir = dirOf(s);
    const hasDir = (s.attributes.supported_features & SUPPORT_DIRECTION) || "direction" in s.attributes || "current_direction" in s.attributes;

    const nameEl = r.querySelector(".name");
    nameEl.textContent = this._config.name || "";
    nameEl.hidden = !this._config.name;

    this._renderDial(lvl, showOn);

    r.querySelector("ha-card").classList.toggle("noanim", this._config.animate_icon === false);
    const power = r.querySelector(".power");
    power.classList.toggle("on", on);
    power.classList.toggle("rev", dir === "reverse");
    power.disabled = this._disabled;
    power.querySelector(".k").textContent = this._t("state");
    power.querySelector(".v").textContent = this._disabled ? this._t("unavailable") : this._stateText(s);
    r.querySelector(".minus").setAttribute("aria-label", this._t("less"));
    r.querySelector(".plus").setAttribute("aria-label", this._t("more"));
    const idx = Math.round(((Math.max(lvl, 1) - 1) / Math.max(n - 1, 1)) * (SPIN.length - 1));
    power.style.setProperty("--dur", `${SPIN[idx]}s`);

    const dirBtn = r.querySelector(".dir");
    dirBtn.hidden = !hasDir;
    const lightEl = r.querySelector(".light");
    if (lightEl) {
      const l = this._hass.states[this._config.light_entity];
      const lOn = l?.state === "on";
      lightEl.classList.toggle("on", lOn);
      lightEl.disabled = !l || l.state === "unavailable";
      lightEl.querySelector(".k").textContent = this._t("light");
      lightEl.querySelector(".v").textContent = !l ? this._t("notFound") : l.state === "unavailable" ? this._t("unavailable") : this._stateText(l);
    }
    dirBtn.disabled = this._disabled;
    dirBtn.querySelector(".k").textContent = this._t("direction");
    dirBtn.querySelector(".v").textContent = this._dirText(s, dir);
    dirBtn.querySelector(".dirico").classList.toggle("mirror", dir === "reverse");
    // dirección inversa: en rojo, pero solo se ilumina con el ventilador en marcha
    dirBtn.classList.toggle("rev", dir === "reverse");
    dirBtn.classList.toggle("on", on);
    // solo iconos: el texto queda como tooltip / etiqueta accesible
    r.querySelectorAll(".chip").forEach((c) => {
      const txt = `${c.querySelector(".k").textContent}: ${c.querySelector(".v").textContent}`;
      c.title = txt;
      c.setAttribute("aria-label", txt);
    });
  }

  _call(service, data, domain = "fan", entityId = this._config.entity) {
    this._hass.callService(domain, service, { entity_id: entityId, ...data });
  }
  // la luz puede ser un light.* o, como en muchos ventiladores MQTT, un switch.* / input_boolean.*
  _toggleLight() {
    const id = this._config.light_entity;
    this._call("toggle", {}, id.split(".")[0], id);
  }
  _toggle() {
    if (this._stateObj().state === "on") return this._call("turn_off");
    // restaura la última velocidad; si estaba en 0, arranca en 1
    this._zeroUntil = 0;
    const lvl = this._lastLevel() || 1;
    this._call("turn_on", { percentage: this._pct(lvl) });
  }
  _toggleDir() {
    const cur = dirOf(this._stateObj());
    this._call("set_direction", { direction: cur === "reverse" ? "forward" : "reverse" });
  }
  _step(d) {
    const l = Math.max(0, Math.min(this._n(), (this._level() || this._lastLevel()) + d));
    this._setLevel(l);
  }
  _setLevel(l) {
    if (l > 0) this._zeroUntil = 0;
    if (l <= 0) {
      // bajar a 0 apaga y olvida la última velocidad: el dial se queda en 0
      this._last = 0;
      this._zeroUntil = Date.now() + 5000;
      try { localStorage.setItem(this._lastKey(), "0"); } catch (e) { /* sin almacenamiento */ }
      return this._call("turn_off");
    }
    // apagado en HA: encender con la velocidad (publica también el on/off; en ventiladores MQTT/Tuya
    // fijar solo la velocidad arranca el motor pero el estado on/off no se entera)
    if (this._stateObj().state !== "on") return this._call("turn_on", { percentage: this._pct(l) });
    this._call("set_percentage", { percentage: this._pct(l) });
  }
}

customElements.define("fan-speed-card", FanSpeedCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "fan-speed-card",
  name: "Fan Speed Card",
  description: "Ventilador estilo termostato: dial de 6 velocidades, on/off y dirección de giro",
});
