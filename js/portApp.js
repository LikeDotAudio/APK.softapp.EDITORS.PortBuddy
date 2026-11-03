// Part of the APK.audio project — Anthony Kuzub
// MIT Licence.

export class PortTerminalModel {
  constructor(portId = 'MIC_IN_1', connector = 'XLR-3F') {
    this.portId = portId;
    this.connector = connector;
    this.direction = 'Input'; // Input | Output | Bidirectional
    this.signalFormat = 'Analog Balanced Audio';
    this.level = '+4 dBu';
    this.impedance = '2.4 kΩ (Bridging)';
    this.phantomPower = true;
    this.pinout = [
      { pin: '1', function: 'Ground / Shield' },
      { pin: '2', function: 'Hot (+ / Non-Inverting)' },
      { pin: '3', function: 'Cold (- / Inverting)' }
    ];
  }

  togglePhantom() {
    this.phantomPower = !this.phantomPower;
  }
}
