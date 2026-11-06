// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { PortTerminalModel } from './portModel.js';
import { connectPortHost, saveMeta, portFromInterface, connectorChoices, savePort, openPort } from './portHost.js';

export { PortTerminalModel };

const FIELDS = ['portId', 'label', 'connector', 'direction', 'signalFormat', 'level', 'impedance', 'poeClass', 'opticalWavelength'];

export class PortApp {
  constructor(S) {
    this.S = S;
    this.esc = S.esc;
    this.model = new PortTerminalModel();
    this.connectorConfig = { connectors: [] };
    this.picked = [];
    this.svgContainer = document.getElementById('connector-svg');
    this.statusEl = document.getElementById('interfaces-status');

    this.pins = window.APKTable.create(document.getElementById('pins-table'), {
      id: 'portbuddy-pins',
      columns: [
        { key: 'pin', label: 'Pin / Terminal #', mono: true },
        { key: 'function', label: 'Electrical Function' },
        { key: 'color', label: 'Conductor Color' },
      ],
      rows: this.model.pinout,
      onEdit: (i, key, value) => {
        this.model.updatePin(i, key, value);
        this.renderSvg();
        this.changed();
      },
      onDelete: (i) => {
        this.model.removePin(i);
        this.render();
        this.changed();
      },
      empty: 'No pins yet. Add one above.',
    });

    this.interfaces = window.APKTable.create(document.getElementById('interfaces-table'), {
      id: 'portbuddy-interfaces',
      editable: false,
      columns: [
        { key: 'interface', label: 'Interface', mono: true },
        { key: 'kind', label: 'Kind' },
        { key: 'family', label: 'Family' },
        { key: 'carries', label: 'Carries' },
        { key: 'use', label: '', render: (v, row) => this.useButton(row) },
      ],
      rows: [],
      empty: 'The Interface Map has not been read yet.',
    });

    this.host = connectPortHost(S, this.model, { onLoaded: () => this.render() });
    S.inheritTheme();
    S.describe({
      name: 'Port Buddy',
      does: 'Describes one physical port: connector, direction, signal format, level, impedance, PoE, optics, phantom power and its pin map.',
      inputs: [
        { name: 'Port block', from: 'the CAD block this editor was opened on (host@1 load)', kind: 'cad' },
        { name: 'Model file', from: 'Open Model: a port .ifc (this editor\'s twin, else the first port of any IFC model) or block .json', kind: 'file' },
        { name: 'Connector choices', from: 'config/connectors.json', kind: 'file' },
        { name: 'Interface Map', from: 'APKSoftapp.interfaces(): the retained Interfaces table', kind: 'bus', topic: 'Gui/Interfaces/Map/…' },
      ],
      outputs: [
        { name: 'Port block', to: 'the CAD drawing on Save & Return; standalone Save Model writes port_<id>.json AND port_<id>.ifc (IFC4X3_ADD2: one IfcDistributionPort on an IfcDistributionElementType, connector by the closed vocabulary)', kind: 'file' },
        { name: 'Live edits', to: 'the CAD after every change (blockChanged)', kind: 'cad' },
      ],
      controls: [
        { name: 'Port fields', how: 'port id, label, connector, direction, signal format, level, impedance, PoE class, optical wavelength, phantom power' },
        { name: '+ Add Terminal Pin', how: 'adds a pin; edit pin, function and conductor colour in the table, × deletes it' },
        { name: 'Use (Interface Map)', how: 'fills this port from a real interface on the bus' },
        { name: 'Open Model', how: 'pick a port .ifc or block .json' },
        { name: 'Save & Return / ✕', how: 'save into the CAD (standalone: Save Model, the .json and its .ifc twin) / close the editor' },
      ],
      problems: ['bad_json', 'bad_input', 'file_unreadable', 'http_not_found', 'bus_missing', 'not_in_cad', 'save_failed'],
    });
    this.initControls();
    this.render();
    this.loadConnectors();
    this.readInterfaces();
  }

  changed() { this.host.changed(this.model.toBlock(), saveMeta(this.model)); }

  /** Save & Return in the CAD; standalone Save Model: the block .json and its .ifc twin, both or neither. */
  async save() {
    const r = await savePort(this.S, this.host, this.model);
    if (!r.ok && !r.cancelled) this.S.showProblem(r.problem || 'save_failed', { onRetry: () => this.save() });
    return r;
  }

  /** Open Model: a port .ifc or block .json. */
  async open() {
    const r = await openPort(this.S, this.model);
    if (!r.ok) {
      if (!r.cancelled) this.S.showProblem(r.problem, {
        fix: ['Open a port .ifc or block .json saved by Port Buddy (Save outside the CAD writes both), or any IFC model with a port.'],
        onRetry: () => this.open(),
      });
      return r;
    }
    this.render();
    this.changed();
    return r;
  }

  useButton(row) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-action btn-small';
    b.textContent = 'Use';
    b.title = `Describe ${row.interface} as this port`;
    b.onclick = () => {
      const fields = portFromInterface(row);
      if (!fields) return;
      if (!this.picked.includes(row)) this.picked.push(row);
      Object.assign(this.model, fields);
      this.renderConnectors();
      this.render();
      this.changed();
    };
    return b;
  }

  async loadConnectors() {
    const r = await this.S.fetchJson(new URL('../config/connectors.json', import.meta.url),
      { cache: 'no-store', timeoutMs: 8000, subject: 'config/connectors.json' });
    if (r.ok) this.connectorConfig = r.data;
    else {
      if (this.statusEl) this.statusEl.textContent = `Could not read config/connectors.json (${r.problem.detail || r.problem.title}).`;
      this.S.showProblem(r.problem, {
        fix: ['config/connectors.json beside index.html lists the connector choices; until it reads, only connectors from the Interface Map are offered.'],
        onRetry: () => this.loadConnectors(),
      });
    }
    this.renderConnectors();
    this.renderForm(true);
  }

  renderConnectors() {
    const sel = document.getElementById('prop-connector');
    if (!sel) return;
    const list = connectorChoices(this.connectorConfig, this.picked);
    if (this.model.connector && !list.some((c) => c.value === this.model.connector)) {
      list.push({ value: this.model.connector, label: this.model.connector });
    }
    sel.replaceChildren(...list.map((c) => {
      const o = document.createElement('option');
      o.value = c.value;
      o.textContent = c.label;
      return o;
    }));
    sel.value = this.model.connector;
  }

  /* Real interfaces come from the contract's Interfaces table (the Interface Map on the bus). */
  async readInterfaces() {
    const t = await this.S.interfaces({
      onChange: (rows) => {
        this.interfaces.setRows(rows);
        if (this.statusEl) this.statusEl.textContent = `${rows.length} interfaces in the Interface Map. Use one to describe it as this port.`;
      },
    });
    if (!this.statusEl) return;
    if (!t.ok) {
      this.statusEl.textContent = t.reason;
      if (t.problem) {
        this.S.showProblem(t.problem, {
          subject: 'Interface Map',
          fix: ['The port can still be described by hand; only the Use buttons need the Interface Map.'],
          onRetry: () => this.readInterfaces(),
        });
      }
    } else if (!t.rows().length) this.statusEl.textContent = 'Waiting for the Interface Map on the bus (nothing retained yet, or no broker).';
  }

  initControls() {
    document.getElementById('btn-save')?.addEventListener('click', () => this.save());
    document.getElementById('btn-open')?.addEventListener('click', () => this.open());

    document.getElementById('btn-close')?.addEventListener('click', () => this.host.close());

    document.getElementById('btn-add-pin')?.addEventListener('click', () => {
      this.model.addPin(String(this.model.pinout.length + 1), 'Signal', 'White');
      this.render();
      this.changed();
    });

    FIELDS.forEach((field) => {
      document.getElementById(`prop-${field}`)?.addEventListener('input', (e) => {
        this.model[field] = e.target.value;
        this.renderForm(false);
        this.renderSvg();
        this.changed();
      });
    });

    document.getElementById('prop-phantomPower')?.addEventListener('change', (e) => {
      this.model.phantomPower = e.target.checked;
      this.renderSvg();
      this.changed();
    });
  }

  render() {
    this.renderConnectors();
    this.renderForm(true);
    this.pins.setRows(this.model.pinout);
    this.renderSvg();
  }

  renderForm(values) {
    if (values) {
      FIELDS.forEach((field) => {
        const el = document.getElementById(`prop-${field}`);
        if (el && this.model[field] !== undefined) el.value = this.model[field];
      });
      const elPhantom = document.getElementById('prop-phantomPower');
      if (elPhantom) elPhantom.checked = !!this.model.phantomPower;
    }
    const titleEl = document.getElementById('display-port-title');
    if (titleEl) titleEl.textContent = `${this.model.portId} (${this.model.connector} • ${this.model.direction})`;
  }

  renderSvg() {
    if (!this.svgContainer) return;
    const e = this.esc;
    const width = 640;
    const height = 180;
    const conn = (this.model.connector || '').toUpperCase();
    const isPhantom = !!this.model.phantomPower;

    let connectorVisual;
    if (conn.includes('XLR') || conn.includes('CIRCULAR')) {
      connectorVisual = `
        <circle cx="320" cy="90" r="50" fill="#121212" stroke="#4A9EFF" stroke-width="3"/>
        <circle cx="320" cy="50" r="8" fill="#18181b" stroke="#F4902C" stroke-width="2"/>
        <text x="320" y="53" fill="#f4f4f5" font-size="9" text-anchor="middle">1</text>
        <circle cx="290" cy="105" r="8" fill="#18181b" stroke="#F4902C" stroke-width="2"/>
        <text x="290" y="108" fill="#f4f4f5" font-size="9" text-anchor="middle">2</text>
        <circle cx="350" cy="105" r="8" fill="#18181b" stroke="#F4902C" stroke-width="2"/>
        <text x="350" y="108" fill="#f4f4f5" font-size="9" text-anchor="middle">3</text>
        <path d="M 314 40 L 326 40" stroke="#888888" stroke-width="2"/>
      `;
    } else if (conn.includes('RJ45') || conn.includes('ETHERNET')) {
      const contacts = [285, 295, 305, 315, 325, 335, 345, 355]
        .map((x) => `<line x1="${x}" y1="65" x2="${x}" y2="85" stroke="#F4902C" stroke-width="2"/>`).join('');
      connectorVisual = `
        <rect x="270" y="55" width="100" height="70" rx="4" fill="#121212" stroke="#4A9EFF" stroke-width="2"/>
        <rect x="290" y="110" width="60" height="20" fill="#18181b" stroke="#4A9EFF" stroke-width="1.5"/>
        ${contacts}
      `;
    } else if (conn.includes('BNC')) {
      connectorVisual = `
        <circle cx="320" cy="90" r="40" fill="#121212" stroke="#4A9EFF" stroke-width="3"/>
        <circle cx="320" cy="90" r="24" fill="#18181b" stroke="#2B3C5D" stroke-width="2"/>
        <circle cx="320" cy="90" r="5" fill="#F4902C"/>
        <rect x="272" y="86" width="8" height="8" rx="2" fill="#4A9EFF"/>
        <rect x="360" y="86" width="8" height="8" rx="2" fill="#4A9EFF"/>
      `;
    } else {
      connectorVisual = `
        <rect x="260" y="60" width="120" height="60" rx="6" fill="#121212" stroke="#4A9EFF" stroke-width="2"/>
        <text x="320" y="95" fill="#F4902C" font-size="12" font-family="JetBrains Mono, monospace" text-anchor="middle">${e(conn || 'GENERIC')}</text>
      `;
    }

    this.svgContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#121212" rx="8"/>
        <rect x="20" y="20" width="180" height="140" rx="6" fill="#18181b" stroke="#2c2c2c" stroke-width="1"/>
        <text x="30" y="44" fill="#F4902C" font-size="13" font-weight="bold" font-family="JetBrains Mono, monospace">${e(this.model.portId)}</text>
        <text x="30" y="64" fill="#888888" font-size="11" font-family="sans-serif">${e(this.model.signalFormat)}</text>
        <text x="30" y="84" fill="#888888" font-size="11" font-family="sans-serif">Level: <tspan fill="#f4f4f5">${e(this.model.level)}</tspan></text>
        <text x="30" y="104" fill="#888888" font-size="11" font-family="sans-serif">Z: <tspan fill="#f4f4f5">${e(this.model.impedance)}</tspan></text>
        <text x="30" y="124" fill="#888888" font-size="11" font-family="sans-serif">Direction: <tspan fill="#4A9EFF">${e(this.model.direction)}</tspan></text>
        ${isPhantom ? '<rect x="30" y="132" width="68" height="18" rx="3" fill="#EF4444"/><text x="64" y="145" fill="#FFFFFF" font-size="10" font-weight="bold" text-anchor="middle">+48V ⏚</text>' : ''}
        ${connectorVisual}
        <rect x="440" y="20" width="180" height="140" rx="6" fill="#18181b" stroke="#2c2c2c" stroke-width="1"/>
        <text x="450" y="44" fill="#4A9EFF" font-size="12" font-weight="bold" font-family="sans-serif">Physical Pinout</text>
        <text x="450" y="68" fill="#888888" font-size="11" font-family="sans-serif">Pins Defined: <tspan fill="#f4f4f5">${this.model.pinout.length}</tspan></text>
        <text x="450" y="90" fill="#888888" font-size="11" font-family="sans-serif">PoE Rating: <tspan fill="#f4f4f5">${e(this.model.poeClass)}</tspan></text>
        <text x="450" y="112" fill="#888888" font-size="11" font-family="sans-serif">Wavelength: <tspan fill="#f4f4f5">${e(this.model.opticalWavelength)}</tspan></text>
        <text x="450" y="134" fill="#888888" font-size="11" font-family="sans-serif">Connector: <tspan fill="#F4902C">${e(this.model.connector)}</tspan></text>
      </svg>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.APKSoftapp || !window.APKTable) {
      document.body.prepend(Object.assign(document.createElement('p'), {
        textContent: 'vendor/apk-softapp or vendor/apk-table did not load: this editor cannot start.',
      }));
      return;
    }
    window.portApp = new PortApp(window.APKSoftapp);
  });
}
