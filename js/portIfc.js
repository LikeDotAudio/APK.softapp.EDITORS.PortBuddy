// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* portIfc.js — THE PORT'S .IFC TWIN (ROAD-3583). Save Model writes the native port block (toBlock) AND this
   IFC4X3_ADD2 file through APKSoftapp.saveModel; Open Model reads it back to the same block (and takes the
   first port of any other model, a BIM part's file among them).

     IfcProject 'port' ─ IfcRelDeclares ─ IfcDistributionElementType 'Port terminal' (Name = the port id,
                 Tag = the block id): the port described as a part type would carry it, nothing invented
                 about the device it sits on
     the port    one IfcDistributionPort nested on the type (IfcRelNests 'Terminals'), Name = the port id,
                 Description = its label; FlowDirection Input SINK | Output SOURCE | Bidirectional SOURCEANDSINK;
                 SystemType from the signal format; PredefinedType CABLE when it has a connector
                 Pset_DistributionPortTypeCable from the connector by the closed vocabulary (js/ifcConnector.js),
                 Protocols for a network signal
                 APK_Terminal TerminalId, Side, ConnectorAsDeclared, PinCount, Pinout (each pin's function, in
                 pin-table order), NominalLevel (IfcReal with its dBu / dBV / dBm unit) and InputImpedance
                 (an input) or SourceImpedance (an output) in ohm, when the typed text reads as one
                 APK_PortTerminal the editor's own words as typed: SignalFormat, Level, Impedance, PhantomPower,
                 PoEClass, OpticalWavelength, and the pin table's PinIds / PinColours beside Pinout */

import { IfcWriter, bool, enumv, flat, getPsets, ident, ifcGuid, int, label, readIfc, real, schemaOf, stemOf, str, strings, systemTypeOf, protocolsOf, typed } from './ifcSpine.js';
import { cableProps, connectorFromPsets, connectorWords } from './ifcConnector.js';

export { schemaOf };

const FLOW = { input: 'SINK', output: 'SOURCE' };
const sideOf = (direction) => (/^in/i.test(str(direction)) ? 'input' : /^out/i.test(str(direction)) ? 'output' : 'connection');
const slug = (s) => String(s || 'port').toLowerCase().replace(/[^a-z0-9]/g, '_');

/** '+4 dBu' → { value: 4, unit: 'dBu' }; null when the text names no dBu / dBV / dBm level. */
export function levelOf(text) {
  const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*(dBu|dBV|dBm)\b/i.exec(str(text));
  if (!m) return null;
  const unit = { dbu: 'dBu', dbv: 'dBV', dbm: 'dBm' }[m[2].toLowerCase()];
  return { value: Number(m[1]), unit };
}

/** '2.4 kΩ (Bridging)' → 2400 (ohm); null when the text names no resistance. */
export function ohmsOf(text) {
  const m = /(\d+(?:\.\d+)?)\s*([kKmM]?)\s*(Ω|ohms?\b)/.exec(str(text));
  if (!m) return null;
  const k = { k: 1e3, K: 1e3, M: 1e6, m: 1e-3, '': 1 }[m[2]];
  return Math.round(Number(m[1]) * k * 1e6) / 1e6;
}

/** The port block (PortTerminalModel.toBlock) as IFC4X3_ADD2 STEP text. `name` is the file stem. */
export function portToIfc(block, { name } = {}) {
  const b = block || {};
  const portId = str(b.portId) || 'PORT';
  const id = str(b.id) || `port_${slug(portId)}`;
  const stem = stemOf(name, `port_${portId}`);
  const W = new IfcWriter({
    projectGid: ifcGuid('port', id), name: portId, description: 'Port Buddy: one physical port and its pin map',
    editor: 'EDITORS.PortBuddy', appName: 'port editor', ohm: true,
  });
  const typeGid = W.gid('type');
  const type = W.add('IFCDISTRIBUTIONELEMENTTYPE', typeGid, W.oh, portId, b.label ? str(b.label) : null, null, null, null, id, 'Port terminal');
  W.declare([type]);

  const side = sideOf(b.direction);
  const words = connectorWords(b.connector);
  let sys = systemTypeOf(b.signalFormat);
  if (sys === 'SIGNAL' || sys === 'NOTDEFINED') sys = systemTypeOf(`${str(b.signalFormat)} ${str(b.connector)}`.trim());
  const gid = W.gid('port', portId);
  const port = W.add('IFCDISTRIBUTIONPORT', gid, W.oh, portId, b.label ? str(b.label) : null, null, null, null,
    enumv(FLOW[side] || 'SOURCEANDSINK'), enumv(words ? 'CABLE' : 'NOTDEFINED'), enumv(words ? sys : 'NOTDEFINED'));
  if (words) W.pset('Pset_DistributionPortTypeCable', gid, cableProps(W, words, sys === 'DATA' ? protocolsOf(b.signalFormat) : []), [port]);

  const pins = Array.isArray(b.pinout) ? b.pinout : [];
  const level = levelOf(b.level);
  const ohms = side === 'connection' ? null : ohmsOf(b.impedance);
  const pinCount = words && words.pins != null ? words.pins : pins.length || null;
  W.pset('APK_Terminal', gid, [
    W.prop('TerminalId', ident(portId)),
    W.prop('Side', label(side)),
    words && words.asDeclared ? W.prop('ConnectorAsDeclared', label(words.asDeclared)) : null,
    pinCount != null ? W.prop('PinCount', int(pinCount)) : null,
    W.listProp('Pinout', pins.map((p) => label(str(p && p.function)))),
    level ? W.prop('NominalLevel', typed('IFCREAL', real(level.value)), W.levelUnit(level.unit)) : null,
    ohms != null ? W.prop(side === 'input' ? 'InputImpedance' : 'SourceImpedance', typed('IFCELECTRICRESISTANCEMEASURE', real(ohms))) : null,
  ], [port]);
  W.pset('APK_PortTerminal', gid, [
    W.prop('SignalFormat', b.signalFormat ? label(b.signalFormat) : null),
    W.prop('Level', b.level ? label(b.level) : null),
    W.prop('Impedance', b.impedance ? label(b.impedance) : null),
    W.prop('PhantomPower', bool(!!b.phantomPower)),
    W.prop('PoEClass', b.poeClass ? label(b.poeClass) : null),
    W.prop('OpticalWavelength', b.opticalWavelength ? label(b.opticalWavelength) : null),
    W.listProp('PinIds', pins.map((p) => ident(str(p && p.pin)))),
    W.listProp('PinColours', pins.map((p) => label(str(p && p.color)))),
  ], [port]);
  W.nest(type, typeGid, [port], 'Terminals');
  return W.finish(stem);
}

/* ───────────────────────── reading it back ───────────────────────── */

const DIRECTION = { SINK: 'Input', SOURCE: 'Output', SOURCEANDSINK: 'Bidirectional' };

/** NominalLevel back as text: '+4 dBu' (its unit is the IfcContextDependentUnit it names). */
function levelText(file, port) {
  const d = getPsets(file, port, { detail: true }).APK_Terminal?.NominalLevel;
  if (!d || typeof d.value !== 'number') return '';
  return `${d.value > 0 ? '+' : ''}${d.value}${d.unit ? ` ${str(d.unit.args[2])}` : ''}`;
}

/**
 * An IFC model → the port block: the port this editor wrote (APK_PortTerminal), else the first
 * IfcDistributionPort of the file; throws a sentence when the file has no port.
 */
export function portFromIfc(text) {
  const R = readIfc(text);
  const all = R.byType('IFCDISTRIBUTIONPORT');
  const port = all.find((p) => R.psets(p).APK_PortTerminal) || all[0];
  if (!port) throw new TypeError('no port in this IFC: it has no IfcDistributionPort');
  const ps = R.psets(port);
  const t = ps.APK_Terminal || {};
  const own = ps.APK_PortTerminal || {};
  const host = R.byType('IFCRELNESTS').map((r) => ((r.args[5] || []).some((x) => x && x.id === port.id) ? R.get(r.args[4]) : null)).find(Boolean);
  const portId = str(flat(t.TerminalId)) || str(port.args[2]) || 'PORT';
  const functions = strings(t.Pinout);
  const ids = strings(own.PinIds);
  const colours = strings(own.PinColours);
  const rows = Math.max(functions.length, ids.length, colours.length);
  const pinout = [];
  for (let i = 0; i < rows; i++) pinout.push({ pin: ids[i] ?? String(i + 1), function: functions[i] ?? '', color: colours[i] ?? '' });
  const ohms = flat(t.InputImpedance) ?? flat(t.SourceImpedance);
  const phantom = flat(own.PhantomPower);
  const hostTag = host && host.type === 'IFCDISTRIBUTIONELEMENTTYPE' ? str(host.args[7]) : '';
  return {
    type: 'port_terminal',
    id: hostTag || `port_${slug(portId)}`,
    portId,
    label: str(port.args[3]) || str(port.args[2]),
    connector: connectorFromPsets(ps),
    direction: DIRECTION[str(flat(port.args[7]))] || 'Bidirectional',
    signalFormat: str(flat(own.SignalFormat)),
    level: str(flat(own.Level)) || levelText(R.file, port),
    impedance: str(flat(own.Impedance)) || (typeof ohms === 'number' ? `${ohms} Ω` : ''),
    phantomPower: phantom === true,
    poeClass: str(flat(own.PoEClass)),
    opticalWavelength: str(flat(own.OpticalWavelength)),
    pinout,
  };
}
