// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The port block in and out of the CAD over cad.like.audio/host@1, through the
// vendored APKSoftapp client, and a port taken from a row of the contract's
// Interfaces table. No DOM here: the tests drive it. Standalone, Save is Save
// Model: the block and its .ifc twin (portIfc.js); Open reads either back.

import { portFromIfc, portToIfc } from './portIfc.js';

export const EDITOR = 'Port Buddy';
export const BLOCK_TYPE = 'port_terminal';

export function saveMeta(model) {
  return { blockName: model.portId, filename: `port_${model.portId}` };
}

/** One host@1 link for one PortTerminalModel. */
export function connectPortHost(S, model, { onLoaded, notice } = {}) {
  return S.connectHost({
    editor: EDITOR,
    blockType: BLOCK_TYPE,
    block: model.toBlock(),
    notice,
    onLoad: (block, meta) => {
      model.fromBlock(block);
      if (onLoaded) onLoaded(block, meta);
    },
    onRequest: () => ({ block: model.toBlock(), meta: saveMeta(model) }),
  });
}

const familyLabel = (f) => String(f || '').replace(/^\s*\d+\s+/, '').trim();

/**
 * The fields a real interface fills: its name, its kind as the connector and its
 * family as the signal format. Only what the row says — direction, level and
 * pinout stay as the user set them.
 */
export function portFromInterface(row) {
  if (!row || !row.interface) return null;
  const name = String(row.interface);
  const kind = String(row.kind || '').trim();
  const out = {
    portId: name.replace(/\s+—.*$/, '').replace(/[^\w./:-]+/g, '_'),
    label: kind ? `${name} (${kind})` : name,
    signalFormat: familyLabel(row.family) || String(row.domain || ''),
  };
  if (kind) out.connector = kind;
  return out;
}

/** Connector choices: the config file's, then the kind of each given interface row (the ones picked) not already there. */
export function connectorChoices(config, rows) {
  const list = ((config && config.connectors) || []).map((c) => ({ value: String(c.value), label: String(c.label || c.value) }));
  for (const r of rows || []) {
    const k = String((r && r.kind) || '').trim();
    if (k && !list.some((c) => c.value === k)) list.push({ value: k, label: `${k} (Interface Map)` });
  }
  return list;
}

/**
 * Save: inside the CAD the block goes back (Save & Return). Standalone it is Save Model: the block
 * (port_<id>.json) AND its .ifc twin (js/portIfc.js), both or neither.
 */
export async function savePort(S, host, model) {
  const block = model.toBlock();
  const meta = saveMeta(model);
  if (host.embedded || typeof S.saveModel !== 'function') return { ok: true, via: host.save(block, meta) };
  return S.saveModel(block, { name: meta.filename, toIfc: (b) => portToIfc(b, { name: meta.filename }) });
}

/** Open Model: a port .ifc (this editor's twin, else the first port of any model) or a port block .json, into the model. */
export async function openPort(S, model, opts = {}) {
  const r = await S.openModel({
    ...opts,
    fromIfc: (text) => portFromIfc(text),
    fromJson: (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('this is not a port block: it is not a JSON object');
      return data;
    },
  });
  if (r.ok) model.fromBlock(r.model);
  return r;
}
