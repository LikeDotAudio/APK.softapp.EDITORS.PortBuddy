import test from 'node:test';
import assert from 'node:assert/strict';
import { PortTerminalModel } from '../js/portModel.js';

test('PortTerminalModel maintains port specifications and toggles phantom power', () => {
  const port = new PortTerminalModel('AES_OUT_1', 'BNC');
  assert.equal(port.portId, 'AES_OUT_1');
  assert.equal(port.connector, 'BNC');
  assert.equal(port.phantomPower, true);

  port.togglePhantom();
  assert.equal(port.phantomPower, false);
});

test('PortTerminalModel exports and imports block schemas correctly', () => {
  const port = new PortTerminalModel('DANTE_PRI', 'RJ45');
  port.addPin('4', 'Power 48V+', 'Blue');
  
  const block = port.toBlock();
  assert.equal(block.type, 'port_terminal');
  assert.equal(block.portId, 'DANTE_PRI');
  assert.equal(block.pinout.length, 4);

  const restored = new PortTerminalModel();
  restored.fromBlock(block);
  assert.equal(restored.portId, 'DANTE_PRI');
  assert.equal(restored.connector, 'RJ45');
  assert.equal(restored.pinout.length, 4);
});
