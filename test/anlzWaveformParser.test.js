import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePwv5Word, extractPwv5FromAnlz, extractPwv5SummaryFromAnlz } from '../src/parser/anlzWaveformParser.js';

function encodeWord(red3, green3, blue3, height) {
  return ((red3 & 0x07) << 13)
    | ((green3 & 0x07) << 10)
    | ((blue3 & 0x07) << 7)
    | ((height & 0x1F) << 2);
}

function buildPayload(words) {
  const payload = Buffer.alloc(words.length * 2);
  words.forEach((word, index) => payload.writeUInt16BE(word, index * 2));
  return payload;
}

test('decodePwv5Word decodes color channels and height', () => {
  const word = encodeWord(7, 2, 3, 29);
  const decoded = decodePwv5Word(word);

  assert.equal(decoded.red, 255);
  assert.equal(decoded.green, 73);
  assert.equal(decoded.blue, 109);
  assert.equal(decoded.height, 29);
  assert.deepEqual(decoded.raw, { red3: 7, green3: 2, blue3: 3 });
});

test('extractPwv5FromAnlz supports compact FourCC + dataLen layout', () => {
  const words = [
    encodeWord(7, 0, 0, 31),
    encodeWord(0, 7, 0, 10),
    encodeWord(0, 0, 7, 5)
  ];
  const payload = buildPayload(words);
  const section = Buffer.alloc(8 + payload.length);
  section.write('PWV5', 0, 'ascii');
  section.writeUInt32BE(payload.length, 4);
  payload.copy(section, 8);

  const file = Buffer.concat([Buffer.from('PMAI', 'ascii'), Buffer.alloc(4), section]);
  const waveform = extractPwv5FromAnlz(file);

  assert.ok(waveform);
  assert.equal(waveform.sampleCount, words.length);
  assert.equal(waveform.payloadLength, payload.length);
  assert.equal(waveform.samples[0].height, 31);
  assert.equal(waveform.samples[1].green, 255);
  assert.equal(waveform.samples[2].blue, 255);
});

test('extractPwv5FromAnlz supports extended header + total length layout', () => {
  const words = [
    encodeWord(1, 2, 3, 4),
    encodeWord(4, 5, 6, 7)
  ];
  const payload = buildPayload(words);
  const headerLength = 12;
  const totalLength = headerLength + payload.length;
  const section = Buffer.alloc(totalLength);
  section.write('PWV5', 0, 'ascii');
  section.writeUInt32BE(headerLength, 4);
  section.writeUInt32BE(totalLength, 8);
  payload.copy(section, headerLength);

  const waveform = extractPwv5FromAnlz(section);
  assert.ok(waveform);
  assert.equal(waveform.sampleCount, words.length);
  assert.equal(waveform.mode, 'extended-header+total');
  assert.equal(waveform.samples[0].raw.red3, 1);
  assert.equal(waveform.samples[1].raw.blue3, 6);
});

test('extractPwv5SummaryFromAnlz returns compact bins and color metrics', () => {
  const words = [
    encodeWord(7, 0, 0, 31),
    encodeWord(0, 7, 0, 16),
    encodeWord(0, 0, 7, 8),
    encodeWord(7, 7, 7, 4)
  ];
  const payload = buildPayload(words);
  const section = Buffer.alloc(8 + payload.length);
  section.write('PWV5', 0, 'ascii');
  section.writeUInt32BE(payload.length, 4);
  payload.copy(section, 8);

  const summary = extractPwv5SummaryFromAnlz(section, { binCount: 4 });
  assert.ok(summary);
  assert.equal(summary.sampleCount, 4);
  assert.equal(summary.bins.length, 16);
  assert.equal(summary.binColors.length, 16);
  assert.ok(summary.avgColor.red > 0);
  assert.ok(summary.height.max >= 31);
});
