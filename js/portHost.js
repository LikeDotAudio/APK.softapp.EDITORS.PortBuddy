// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The port block in and out of the CAD over cad.like.audio/host@1, through the
// vendored APKSoftapp client, and a port taken from a row of the contract's
// Interfaces table. No DOM here: the tests drive it.

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
