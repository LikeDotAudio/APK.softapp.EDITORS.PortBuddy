// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3487: the port block round trip over cad.like.audio/host@1 (the real
// vendored apk-softapp.js), and a port described from the Interfaces table.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { world, ORIGIN, PROTOCOL } from './hostWorld.mjs';
import { PortTerminalModel } from '../js/portModel.js';
import { connectPortHost, portFromInterface, connectorChoices, BLOCK_TYPE } from '../js/portHost.js';

const config = JSON.parse(fs.readFileSync(new URL('../config/connectors.json', import.meta.url)));

test('in the CAD: editorReady, load fills the model, request saves the edited block to our origin only', () => {
  const { S, toParent, fire } = world();
  const model = new PortTerminalModel();
  connectPortHost(S, model, { notice: false });
  assert.deepEqual(toParent[0], { m: { protocol: PROTOCOL, type: 'editorReady', editor: 'Port Buddy', blockType: BLOCK_TYPE }, o: ORIGIN });

  const cad = new PortTerminalModel('DANTE_PRI', 'RJ45').toBlock();
  cad.phantomPower = false;
  fire({ protocol: PROTOCOL, type: 'load', block: cad, meta: { blockName: 'DANTE_PRI' } });
  assert.equal(model.portId, 'DANTE_PRI');
  assert.equal(model.phantomPower, false);

  model.addPin('4', 'Power 48V+', 'Blue');
  fire({ protocol: PROTOCOL, type: 'request' });
  const save = toParent.at(-1);
  assert.equal(save.o, ORIGIN);
  assert.equal(save.m.type, 'blockSave');
  assert.deepEqual(save.m.block, model.toBlock());
  assert.equal(save.m.block.pinout.length, 4);
  assert.equal(save.m.meta.blockName, 'DANTE_PRI');

  const back = new PortTerminalModel();
  back.fromBlock(save.m.block);
  assert.deepEqual(back.toBlock(), save.m.block, 'what was saved loads back unchanged');
});

test('standalone: Save downloads port_<id>.json', () => {
  const { S, downloads, toParent } = world({ framed: false });
  const model = new PortTerminalModel('AES_OUT_1', 'BNC-75');
  const host = connectPortHost(S, model, { notice: false });
  assert.equal(host.save(model.toBlock(), { filename: 'port_AES_OUT_1' }), 'download');
  assert.equal(toParent.length, 0);
  assert.equal(downloads[0].name, 'port_AES_OUT_1.json');
  assert.equal(JSON.parse(downloads[0].text).connector, 'BNC-75');
});

test('a real interface describes the port: name, kind as connector, family as format — nothing invented', () => {
  const row = { interface: 'enp12s0', kind: 'ethernet', family: '1 Network — physical', domain: 'network', in: 1, out: 4 };
  assert.deepEqual(portFromInterface(row), {
    portId: 'enp12s0', label: 'enp12s0 (ethernet)', signalFormat: 'Network — physical', connector: 'ethernet',
  });
  assert.equal(portFromInterface({ interface: 'enp12s0 — listening', kind: 'AoIP discovery', family: '3 Audio' }).portId, 'enp12s0');
  assert.equal(portFromInterface({}), null);
});

test('connector choices: the config file first, then the kinds of picked interfaces', () => {
  const list = connectorChoices(config, [{ kind: 'ethernet' }, { kind: 'RJ45' }]);
  assert.equal(list[0].value, config.connectors[0].value);
  assert.equal(list.filter((c) => c.value === 'RJ45').length, 1, 'no duplicate');
  assert.deepEqual(list.at(-1), { value: 'ethernet', label: 'ethernet (Interface Map)' });
  assert.equal(connectorChoices(null, []).length, 0);
});
