// Draw the existing pixel mascot at packaging resolution (no external tools).
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const draw = size => {
  const pixels = Buffer.alloc(size * size * 4), scale = size / 32
  const fill = (x, y, w, h, colour) => {
    for (let j = y * scale; j < (y + h) * scale; j++) for (let i = x * scale; i < (x + w) * scale; i++) {
      const at = (j * size + i) * 4
      pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2]; pixels[at + 3] = 255
    }
  }
  const orange = [221, 119, 91]
  fill(5, 8, 22, 16, orange); fill(1, 13, 4, 6, orange); fill(27, 13, 4, 6, orange)
  for (const x of [6, 11, 18, 23]) fill(x, 24, 3, 6, orange)
  fill(10, 12, 3, 4, [31, 29, 27]); fill(19, 12, 3, 4, [31, 29, 27])
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const crc = bytes => { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1 } return (value ^ 0xffffffff) >>> 0 }
  const chunk = (name, bytes) => { const length = Buffer.alloc(4), checksum = Buffer.alloc(4), content = Buffer.concat([Buffer.from(name), bytes]); length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(content)); return Buffer.concat([length, content, checksum]) }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const dir = path.join(__dirname, '..', 'build')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), draw(512))
const png = draw(256), header = Buffer.alloc(22)
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, png]))
