// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the port's .ifc twin. Save Model writes the block and IFC4X3_ADD2 (one IfcDistributionPort nested
// on an IfcDistributionElementType 'Port terminal', its connector the closed vocabulary's words, level and
// impedance as measures); Open Model reads it back equal; with APK_IFC_PYTHON=<python with ifcopenshell +
// ifctester> IfcOpenShell and the BIM oracle check it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IFC_GUID_RE, getPsets, parseStep } from '../vendor/apk-contracts/apk-ifc.js';
import { resolveConnector } from '../vendor/apk-contracts/apk-connectors.js';
import { PortTerminalModel } from '../js/portModel.js';
import { levelOf, ohmsOf, portFromIfc, portToIfc } from '../js/portIfc.js';
import { connectPortHost, openPort, savePort } from '../js/portHost.js';
import * as vendorIfc from '../scripts/vendor-ifc.mjs';
import * as vendorConnectors from '../scripts/vendor-connectors.mjs';
import { world } from './hostWorld.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../config/connectors.json', import.meta.url)));
const byType = (text, type) => parseStep(text).entities.filter((e) => e.type === type);
const portSets = (text) => {
  const file = parseStep(text);
  return getPsets(file, file.entities.find((e) => e.type === 'IFCDISTRIBUTIONPORT'));
};

function dante() {
  const m = new PortTerminalModel('DANTE_PRI', 'ETHERCON');
  Object.assign(m, { label: 'Dante primary', direction: 'Bidirectional', signalFormat: 'Dante / AES67 network', level: 'N/A', impedance: '100 ohm', phantomPower: false, poeClass: 'Class 4', opticalWavelength: 'N/A' });
  m.pinout = [1, 2, 3, 6].map((n) => ({ pin: String(n), function: ['TX+', 'TX-', 'RX+', 'RX-'][[1, 2, 3, 6].indexOf(n)], color: ['White/Orange', 'Orange', 'White/Green', 'Green'][[1, 2, 3, 6].indexOf(n)] }));
  return m;
}

/** The fixtures the census holds to the oracle: the editor's default mic input, a network port, an output, an unknown spelling. */
export function fixtures() {
  const out = new PortTerminalModel('LINE_OUT_1', 'XLR3-M');
  Object.assign(out, { label: 'Line out 1', direction: 'Output', level: '+4 dBu', impedance: '50 Ω', phantomPower: false });
  const odd = new PortTerminalModel('ODD', 'Mystery-12');
  odd.pinout = [];
  return {
    'port-default.ifc': portToIfc(new PortTerminalModel().toBlock()),
    'port-dante.ifc': portToIfc(dante().toBlock()),
    'port-output.ifc': portToIfc(out.toBlock()),
    'port-odd.ifc': portToIfc(odd.toBlock()),
  };
}

test('the vendored STEP codec and connector vocabulary are what contracts builds to today', async () => {
  for (const v of [vendorIfc, vendorConnectors]) {
    const now = await v.buildBundle();
    if (now == null) continue; // this repo on its own: the committed bundles are what there is
    assert.equal(fs.readFileSync(v.BUNDLE, 'utf8'), now, `run node ${v === vendorIfc ? 'scripts/vendor-ifc.mjs' : 'scripts/vendor-connectors.mjs'}`);
  }
});

test('every connector choice in config/connectors.json is a canonical id of the closed vocabulary', () => {
  for (const c of config.connectors) assert.equal(resolveConnector(c.value)?.id, c.value, `${c.value} is not a contracts/ifc/connectors.json id`);
  assert.equal(new PortTerminalModel().connector, 'XLR3-F');
});

test('the port is one IfcDistributionPort nested on an IfcDistributionElementType, its flow from the direction', () => {
  const text = portToIfc(new PortTerminalModel().toBlock());
  const [type] = byType(text, 'IFCDISTRIBUTIONELEMENTTYPE');
  assert.deepEqual([type.args[2], type.args[7], type.args[8]], ['MIC_IN_1', 'port_mic_in_1', 'Port terminal']);
  const [port] = byType(text, 'IFCDISTRIBUTIONPORT');
  assert.deepEqual([port.args[2], port.args[3], port.args[7].value, port.args[8].value, port.args[9].value], ['MIC_IN_1', 'Microphone Preamp 1', 'SINK', 'CABLE', 'AUDIOVISUAL']);
  const [nest] = byType(text, 'IFCRELNESTS');
  assert.equal(nest.args[4].id, type.id);
  const flow = (direction) => {
    const m = new PortTerminalModel();
    m.direction = direction;
    return byType(portToIfc(m.toBlock()), 'IFCDISTRIBUTIONPORT')[0].args[7].value;
  };
  assert.deepEqual(['Input', 'Output', 'Bidirectional'].map(flow), ['SINK', 'SOURCE', 'SOURCEANDSINK']);
});

test('connector words, level with its dBu unit and impedance in ohm; the editor\'s own words beside them', () => {
  const ps = portSets(portToIfc(new PortTerminalModel().toBlock()));
  assert.deepEqual(ps.Pset_DistributionPortTypeCable, { ElectricalConnectionType: ['XLR'], ConnectionSubtype: 'XLR-3', ConnectionGender: ['FEMALE'] });
  assert.equal(ps.APK_Terminal.PinCount, 3);
  assert.equal(ps.APK_Terminal.NominalLevel, 4);
  assert.equal(ps.APK_Terminal.InputImpedance, 2400);
  assert.equal(ps.APK_PortTerminal.Impedance, '2.4 kΩ (Bridging)');
  assert.equal(ps.APK_PortTerminal.PhantomPower, true);
  const file = parseStep(portToIfc(new PortTerminalModel().toBlock()));
  const port = file.entities.find((e) => e.type === 'IFCDISTRIBUTIONPORT');
  assert.equal(getPsets(file, port, { detail: true }).APK_Terminal.NominalLevel.unit.args[2], 'dBu');
  const d = portSets(portToIfc(dante().toBlock()));
  assert.deepEqual(d.Pset_DistributionPortTypeCable.Protocols, ['Dante', 'AES67'], 'a network signal lists its transports');
  assert.equal(d.APK_Terminal.InputImpedance, undefined, 'a bidirectional port claims neither impedance');
  assert.deepEqual(levelOf('-10 dBV'), { value: -10, unit: 'dBV' });
  assert.equal(levelOf('N/A'), null);
  assert.equal(ohmsOf('600 ohms'), 600);
  assert.equal(ohmsOf('10 kΩ'), 10000);
  const odd = portSets(fixtures()['port-odd.ifc']);
  assert.deepEqual(odd.Pset_DistributionPortTypeCable, { ConnectionSubtype: 'Mystery-12' }, 'an unknown spelling is kept as said, never OTHER');
});

test('Open Model reads the twin back to the same block; byte-deterministic, valid GlobalIds', () => {
  const legacy = new PortTerminalModel('OLD', 'XLR-3F');
  for (const m of [new PortTerminalModel(), dante(), legacy, new PortTerminalModel('AES_OUT_1', 'COAX-BNC')]) {
    const block = m.toBlock();
    const text = portToIfc(block);
    assert.deepEqual(portFromIfc(text), block);
    assert.equal(portToIfc(block), text);
    const rooted = parseStep(text).entities.filter((e) => /^IFC(PROJECT|REL|PROPERTYSET$|DISTRIBUTIONPORT$|.*TYPE$)/.test(e.type));
    for (const e of rooted) assert.match(e.args[0], IFC_GUID_RE, e.type);
    assert.equal(new Set(rooted.map((e) => e.args[0])).size, rooted.length, 'no GlobalId twice');
  }
});

test('standalone Save writes port_<id>.json AND its .ifc; Open takes either back', async () => {
  const { S, downloads } = world({ framed: false });
  const model = dante();
  const host = connectPortHost(S, model, { notice: false });
  const r = await savePort(S, host, model);
  assert.equal(r.ok, true);
  assert.deepEqual(downloads.map((x) => x.name), ['port_DANTE_PRI.ifc', 'port_DANTE_PRI.json']);
  const back = new PortTerminalModel();
  const o = await openPort(S, back, { file: { name: 'port_DANTE_PRI.ifc', text: async () => downloads[0].text } });
  assert.equal(o.kind, 'ifc');
  assert.deepEqual(back.toBlock(), model.toBlock());
  const j = new PortTerminalModel();
  await openPort(S, j, { file: { name: 'port_DANTE_PRI.json', text: async () => downloads[1].text } });
  assert.deepEqual(j.toBlock(), model.toBlock());
});

test('inside the CAD Save is Save & Return: the block goes to the drawing, no files', async () => {
  const { S, toParent, downloads } = world();
  const model = new PortTerminalModel();
  const host = connectPortHost(S, model, { notice: false });
  assert.equal((await savePort(S, host, model)).via, 'host');
  assert.equal(toParent.at(-1).m.type, 'blockSave');
  assert.equal(downloads.length, 0);
});

// IfcOpenShell (LGPL, test-only, never vendored) when the environment has it: APK_IFC_PYTHON=<python with ifcopenshell + ifctester>
test('IfcOpenShell: 0 schema + EXPRESS statements, every set declared (oracle)', { skip: !process.env.APK_IFC_PYTHON && 'set APK_IFC_PYTHON to a python with ifcopenshell + ifctester' }, () => {
  const dir = fs.mkdtempSync(join(tmpdir(), 'portbuddy-ifc-'));
  const files = fixtures();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(join(dir, name), text);
  const script = new URL('../scripts/validate-ifc.py', import.meta.url).pathname;
  const run = spawnSync(process.env.APK_IFC_PYTHON, ['-I', script, ...Object.keys(files).map((n) => join(dir, n))], { cwd: tmpdir(), encoding: 'utf8' });
  const rows = run.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(rows.length, Object.keys(files).length, run.stderr);
  for (const r of rows) {
    assert.equal(r.schema, 'IFC4X3_ADD2', r.file);
    assert.equal(r.statements, 0, `${r.file}: ${r.first.join(' | ')}`);
    assert.deepEqual(r.pset_problems, [], r.file);
    assert.deepEqual(r.connections, [], r.file);
    assert.deepEqual(r.ports.map((p) => p.host), ['IfcDistributionElementType'], r.file);
  }
  const known = rows.filter((r) => !r.file.endsWith('port-odd.ifc'));
  for (const r of known) assert.deepEqual(r.ids_failed, [], `${r.file}: a port with a known connector passes every apk-av.ids specification`);
  assert.equal(run.status, 0, run.stderr);
});
