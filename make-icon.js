// Writes assets/icon.png: a small pixel Claude silhouette for the tray.
const fs = require('fs'), zlib = require('zlib')
const S = 32, px = Buffer.alloc(S * S * 4)
const fill = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const o = (j * S + i) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255 } }
const col = [0xDD, 0x77, 0x5B]
fill(5, 8, 22, 16, col); fill(1, 13, 4, 6, col); fill(27, 13, 4, 6, col)
;[6, 11, 18, 23].forEach(x => fill(x, 24, 3, 6, col))
fill(10, 12, 3, 4, [0, 0, 0]); fill(19, 12, 3, 4, [0, 0, 0])
const raw = Buffer.alloc((S * 4 + 1) * S)
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4) }
const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } let r = 0xFFFFFFFF; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0 }
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6
fs.writeFileSync(__dirname + '/assets/icon.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
