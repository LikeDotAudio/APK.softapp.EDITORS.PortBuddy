// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export class PortTerminalModel {
  constructor(portId = 'MIC_IN_1', connector = 'XLR3-F') {
    this.portId = portId;
    this.label = 'Microphone Preamp 1';
    this.connector = connector;
    this.direction = 'Input'; // Input | Output | Bidirectional
    this.signalFormat = 'Analog Balanced Audio';
    this.level = '+4 dBu';
    this.impedance = '2.4 kΩ (Bridging)';
    this.phantomPower = true;
    this.poeClass = 'None';
    this.opticalWavelength = 'N/A';
    this.pinout = [
      { pin: '1', function: 'Ground / Shield', color: 'Bare / Silver' },
      { pin: '2', function: 'Hot (+ / Non-Inverting)', color: 'Red' },
      { pin: '3', function: 'Cold (- / Inverting)', color: 'Black' }
    ];
  }

  togglePhantom() {
    this.phantomPower = !this.phantomPower;
  }

  addPin(pinNumber, pinFunction = 'Signal', color = 'White') {
    const p = {
      pin: pinNumber || String(this.pinout.length + 1),
      function: pinFunction,
      color: color
    };
    this.pinout.push(p);
    return p;
  }

  removePin(index) {
    if (index >= 0 && index < this.pinout.length) {
      return this.pinout.splice(index, 1)[0];
    }
    return null;
  }

  updatePin(index, field, value) {
    if (this.pinout[index]) {
      this.pinout[index][field] = value;
    }
  }

  toBlock() {
    return {
      type: 'port_terminal',
      id: `port_${this.portId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      portId: this.portId,
      label: this.label,
      connector: this.connector,
      direction: this.direction,
      signalFormat: this.signalFormat,
      level: this.level,
      impedance: this.impedance,
      phantomPower: this.phantomPower,
      poeClass: this.poeClass,
      opticalWavelength: this.opticalWavelength,
      pinout: JSON.parse(JSON.stringify(this.pinout))
    };
  }

  fromBlock(block = {}) {
    if (block.portId) this.portId = block.portId;
    if (block.label) this.label = block.label;
    if (block.connector) this.connector = block.connector;
    if (block.direction) this.direction = block.direction;
    if (block.signalFormat) this.signalFormat = block.signalFormat;
    if (block.level) this.level = block.level;
    if (block.impedance) this.impedance = block.impedance;
    if (block.phantomPower !== undefined) this.phantomPower = !!block.phantomPower;
    if (block.poeClass) this.poeClass = block.poeClass;
    if (block.opticalWavelength) this.opticalWavelength = block.opticalWavelength;
    if (Array.isArray(block.pinout)) {
      this.pinout = JSON.parse(JSON.stringify(block.pinout));
    }
  }
}
