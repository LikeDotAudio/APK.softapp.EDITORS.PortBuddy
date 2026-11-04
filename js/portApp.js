// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { PortTerminalModel } from './portModel.js';
import { BlockBridge } from './blockBridge.js';

export { PortTerminalModel };

export class PortApp {
  constructor() {
    this.model = new PortTerminalModel();
    this.bridge = new BlockBridge({
      name: 'Port Buddy',
      type: 'port_terminal',
      onBlockLoaded: (b, m) => this.handleBlockLoaded(b, m),
      onBlockChanged: () => this.render()
    });

    this.tableBody = document.getElementById('pins-table-body');
    this.svgContainer = document.getElementById('connector-svg');
    this.initControls();
    this.render();
    this.autoConnect();
  }

  async autoConnect() {
    const discovered = await this.bridge.fetchDiscoveredProject();
    if (discovered && discovered.ports && discovered.ports.length > 0) {
      this.model.fromBlock(discovered.ports[0]);
      this.render();
    }
  }

  handleBlockLoaded(block, meta) {
    if (block) {
      this.model.fromBlock(block);
      this.render();
    }
  }

  initControls() {
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.bridge.saveBlock(this.model.toBlock(), { name: this.model.portId });
      });
    }

    const btnOpen = document.getElementById('btn-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              this.model.fromBlock(data);
              this.render();
            } catch (err) {
              alert('Invalid block file: ' + err.message);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }

    const btnClose = document.getElementById('btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.bridge.close());
    }

    const btnDiscovered = document.getElementById('btn-discovered');
    if (btnDiscovered) {
      btnDiscovered.addEventListener('click', async () => {
        const disc = await this.bridge.fetchDiscoveredProject();
        if (disc && disc.ports && disc.ports.length > 0) {
          this.model.fromBlock(disc.ports[0]);
          this.render();
        } else {
          alert('No port blocks found in current discovered project.');
        }
      });
    }

    const btnAddPin = document.getElementById('btn-add-pin');
    if (btnAddPin) {
      btnAddPin.addEventListener('click', () => {
        this.model.addPin(String(this.model.pinout.length + 1), 'Signal', 'White');
        this.render();
        this.bridge.notifyChanged();
      });
    }

    ['portId', 'label', 'connector', 'direction', 'signalFormat', 'level', 'impedance', 'poeClass', 'opticalWavelength'].forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el) {
        el.addEventListener('input', (e) => {
          this.model[field] = e.target.value;
          this.renderSvg();
          this.bridge.notifyChanged();
        });
      }
    });

    const elPhantom = document.getElementById('prop-phantomPower');
    if (elPhantom) {
      elPhantom.addEventListener('change', (e) => {
        this.model.phantomPower = e.target.checked;
        this.renderSvg();
        this.bridge.notifyChanged();
      });
    }
  }

  render() {
    this.renderForm();
    this.renderTable();
    this.renderSvg();
  }

  renderForm() {
    ['portId', 'label', 'connector', 'direction', 'signalFormat', 'level', 'impedance', 'poeClass', 'opticalWavelength'].forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el && this.model[field] !== undefined) {
        el.value = this.model[field];
      }
    });

    const elPhantom = document.getElementById('prop-phantomPower');
    if (elPhantom) {
      elPhantom.checked = !!this.model.phantomPower;
    }

    const titleEl = document.getElementById('display-port-title');
    if (titleEl) {
      titleEl.textContent = `${this.model.portId} (${this.model.connector} • ${this.model.direction})`;
    }
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    this.model.pinout.forEach((pin, idx) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td class="inline-cell" contenteditable="true" data-idx="${idx}" data-field="pin">${pin.pin || ''}</td>
        <td class="inline-cell" contenteditable="true" data-idx="${idx}" data-field="function">${pin.function || ''}</td>
        <td class="inline-cell" contenteditable="true" data-idx="${idx}" data-field="color">${pin.color || ''}</td>
        <td style="text-align: center;">
          <button class="btn-delete" data-idx="${idx}" title="Remove Pin">✕</button>
        </td>
      `;

      this.tableBody.appendChild(tr);
    });

    this.tableBody.querySelectorAll('[contenteditable=true]').forEach(cell => {
      cell.addEventListener('blur', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        this.model.updatePin(idx, field, e.target.innerText.trim());
        this.renderSvg();
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.model.removePin(idx);
        this.render();
        this.bridge.notifyChanged();
      });
    });
  }

  renderSvg() {
    if (!this.svgContainer) return;

    const width = 640;
    const height = 180;
    const conn = (this.model.connector || '').toUpperCase();
    const isPhantom = !!this.model.phantomPower;

    let connectorVisual = '';

    if (conn.includes('XLR') || conn.includes('CIRCULAR')) {
      connectorVisual = `
        <circle cx="320" cy="90" r="50" fill="#080C16" stroke="#4A9EFF" stroke-width="3"/>
        <circle cx="320" cy="50" r="8" fill="#121A2F" stroke="#F4902C" stroke-width="2"/>
        <text x="320" y="53" fill="#F0F4F8" font-size="9" text-anchor="middle">1</text>
        <circle cx="290" cy="105" r="8" fill="#121A2F" stroke="#F4902C" stroke-width="2"/>
        <text x="290" y="108" fill="#F0F4F8" font-size="9" text-anchor="middle">2</text>
        <circle cx="350" cy="105" r="8" fill="#121A2F" stroke="#F4902C" stroke-width="2"/>
        <text x="350" y="108" fill="#F0F4F8" font-size="9" text-anchor="middle">3</text>
        <path d="M 314 40 L 326 40" stroke="#8B9BB4" stroke-width="2"/>
      `;
    } else if (conn.includes('RJ45') || conn.includes('ETHERNET')) {
      connectorVisual = `
        <rect x="270" y="55" width="100" height="70" rx="4" fill="#080C16" stroke="#4A9EFF" stroke-width="2"/>
        <rect x="290" y="110" width="60" height="20" fill="#121A2F" stroke="#4A9EFF" stroke-width="1.5"/>
        <line x1="285" y1="65" x2="285" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="295" y1="65" x2="295" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="305" y1="65" x2="305" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="315" y1="65" x2="315" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="325" y1="65" x2="325" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="335" y1="65" x2="335" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="345" y1="65" x2="345" y2="85" stroke="#F4902C" stroke-width="2"/>
        <line x1="355" y1="65" x2="355" y2="85" stroke="#F4902C" stroke-width="2"/>
      `;
    } else if (conn.includes('BNC')) {
      connectorVisual = `
        <circle cx="320" cy="90" r="40" fill="#080C16" stroke="#4A9EFF" stroke-width="3"/>
        <circle cx="320" cy="90" r="24" fill="#121A2F" stroke="#2B3C5D" stroke-width="2"/>
        <circle cx="320" cy="90" r="5" fill="#F4902C"/>
        <!-- Bayonet lugs -->
        <rect x="272" y="86" width="8" height="8" rx="2" fill="#4A9EFF"/>
        <rect x="360" y="86" width="8" height="8" rx="2" fill="#4A9EFF"/>
      `;
    } else {
      connectorVisual = `
        <rect x="260" y="60" width="120" height="60" rx="6" fill="#080C16" stroke="#4A9EFF" stroke-width="2"/>
        <text x="320" y="95" fill="#F4902C" font-size="12" font-family="JetBrains Mono, monospace" text-anchor="middle">${conn || 'GENERIC'}</text>
      `;
    }

    const svg = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#080C16" rx="8"/>

        <!-- Left Specs Card -->
        <rect x="20" y="20" width="180" height="140" rx="6" fill="#121A2F" stroke="#1E2A45" stroke-width="1"/>
        <text x="30" y="44" fill="#F4902C" font-size="13" font-weight="bold" font-family="JetBrains Mono, monospace">${this.model.portId}</text>
        <text x="30" y="64" fill="#8B9BB4" font-size="11" font-family="sans-serif">${this.model.signalFormat}</text>
        <text x="30" y="84" fill="#8B9BB4" font-size="11" font-family="sans-serif">Level: <tspan fill="#F0F4F8">${this.model.level}</tspan></text>
        <text x="30" y="104" fill="#8B9BB4" font-size="11" font-family="sans-serif">Z: <tspan fill="#F0F4F8">${this.model.impedance}</tspan></text>
        <text x="30" y="124" fill="#8B9BB4" font-size="11" font-family="sans-serif">Direction: <tspan fill="#4A9EFF">${this.model.direction}</tspan></text>
        ${isPhantom ? '<rect x="30" y="132" width="68" height="18" rx="3" fill="#EF4444"/><text x="64" y="145" fill="#FFFFFF" font-size="10" font-weight="bold" text-anchor="middle">+48V ⏚</text>' : ''}

        <!-- Center Faceplate Connector Preview -->
        ${connectorVisual}

        <!-- Right Pin Count & Physical Spec -->
        <rect x="440" y="20" width="180" height="140" rx="6" fill="#121A2F" stroke="#1E2A45" stroke-width="1"/>
        <text x="450" y="44" fill="#4A9EFF" font-size="12" font-weight="bold" font-family="sans-serif">Physical Pinout</text>
        <text x="450" y="68" fill="#8B9BB4" font-size="11" font-family="sans-serif">Pins Defined: <tspan fill="#F0F4F8">${this.model.pinout.length}</tspan></text>
        <text x="450" y="90" fill="#8B9BB4" font-size="11" font-family="sans-serif">PoE Rating: <tspan fill="#F0F4F8">${this.model.poeClass}</tspan></text>
        <text x="450" y="112" fill="#8B9BB4" font-size="11" font-family="sans-serif">Wavelength: <tspan fill="#F0F4F8">${this.model.opticalWavelength}</tspan></text>
        <text x="450" y="134" fill="#8B9BB4" font-size="11" font-family="sans-serif">Connector: <tspan fill="#F4902C">${this.model.connector}</tspan></text>
      </svg>
    `;

    this.svgContainer.innerHTML = svg;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    new PortApp();
  });
}
