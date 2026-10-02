const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function header(size, signature) {
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, signature, true);
  return bytes;
}

function asBytes(value) {
  if (typeof value === "string") return encoder.encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

/** Build a small, uncompressed ZIP archive for local browser downloads. */
export function createZipStore(files) {
  const localParts = [];
  const centralParts = [];
  const stamp = dosDateTime();
  let offset = 0;

  for (const [path, value] of Object.entries(files)) {
    const name = encoder.encode(path.replace(/\\/g, "/"));
    const data = asBytes(value);
    if (data.byteLength > 0xffffffff || offset > 0xffffffff) throw new Error("Le fichier est trop volumineux pour ce ZIP.");
    const crc = crc32(data);
    const local = header(30, 0x04034b50);
    const localView = new DataView(local.buffer);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    localView.setUint16(28, 0, true);
    localParts.push(local, name, data);

    const central = header(46, 0x02014b50);
    const centralView = new DataView(central.buffer);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.byteLength, true);
    centralView.setUint32(24, data.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(central, name);
    offset += local.byteLength + name.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((size, part) => size + part.byteLength, 0);
  if (localParts.length / 3 > 0xffff || offset > 0xffffffff || centralSize > 0xffffffff) throw new Error("L’archive dépasse les limites ZIP classiques.");
  const end = header(22, 0x06054b50);
  const endView = new DataView(end.buffer);
  const count = centralParts.length / 2;
  endView.setUint16(8, count, true);
  endView.setUint16(10, count, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}
