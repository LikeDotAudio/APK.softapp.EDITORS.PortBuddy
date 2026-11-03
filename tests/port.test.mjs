import test from 'node:test';
import assert from 'node:assert/strict';
import { PortTerminalModel } from '../js/portApp.js';

test('PortTerminalModel maintains port specifications and toggles phantom power', () => {
  const port = new PortTerminalModel('AES_OUT_1', 'BNC');
  assert.equal(port.portId, 'AES_OUT_1');
  assert.equal(port.connector, 'BNC');
  assert.equal(port.phantomPower, true);

  port.togglePhantom();
  assert.equal(port.phantomPower, false);
});
