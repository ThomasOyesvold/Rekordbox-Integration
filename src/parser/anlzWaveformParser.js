function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }

  throw new TypeError('Expected Buffer or Uint8Array input.');
}

function findAllTagOffsets(buffer, tag) {
  const offsets = [];
  let searchFrom = 0;

  while (searchFrom < buffer.length) {
    const index = buffer.indexOf(tag, searchFrom, 'ascii');
    if (index < 0) {
      break;
    }
    offsets.push(index);
    searchFrom = index + 1;
  }

  return offsets;
}

function asSectionCandidate(buffer, sectionOffset, payloadStart, payloadEnd, mode) {
  if (payloadStart >= payloadEnd) {
    return null;
  }

  if (payloadStart < 0 || payloadEnd > buffer.length) {
    return null;
  }

  const payloadLength = payloadEnd - payloadStart;
  if (payloadLength < 2 || payloadLength % 2 !== 0) {
    return null;
  }

  return {
    sectionOffset,
    payloadStart,
    payloadEnd,
    payloadLength,
    mode
  };
}

function parsePwv5Section(buffer, sectionOffset) {
  if (sectionOffset + 12 > buffer.length) {
    return null;
  }

  const lengthA = buffer.readUInt32BE(sectionOffset + 4);
  const lengthB = buffer.readUInt32BE(sectionOffset + 8);
  const candidates = [];

  // Common compact layout:
  //   FourCC (4) + dataLen (4) + payload
  candidates.push(
    asSectionCandidate(
      buffer,
      sectionOffset,
      sectionOffset + 8,
      sectionOffset + 8 + lengthA,
      'compact-8+len'
    )
  );

  // Common tagged layout:
  //   FourCC (4) + headerLen (4) + totalLen (4) + ... + payload
  candidates.push(
    asSectionCandidate(
      buffer,
      sectionOffset,
      sectionOffset + clamp(lengthA, 0, buffer.length),
      sectionOffset + lengthB,
      'extended-header+total'
    )
  );

  // Alternate layout encountered in some dumps:
  //   FourCC (4) + dataOffset (4) + dataLen (4)
  candidates.push(
    asSectionCandidate(
      buffer,
      sectionOffset,
      sectionOffset + lengthA,
      sectionOffset + lengthA + lengthB,
      'offset+len'
    )
  );

  const validCandidates = candidates
    .filter(Boolean)
    .sort((a, b) => b.payloadLength - a.payloadLength);

  return validCandidates[0] || null;
}

function scale3BitTo8Bit(value) {
  return Math.round((clamp(value, 0, 7) * 255) / 7);
}

export function decodePwv5Word(word) {
  const red3 = (word >> 13) & 0x07;
  const green3 = (word >> 10) & 0x07;
  const blue3 = (word >> 7) & 0x07;
  const height = (word >> 2) & 0x1F;

  return {
    red: scale3BitTo8Bit(red3),
    green: scale3BitTo8Bit(green3),
    blue: scale3BitTo8Bit(blue3),
    height,
    raw: {
      red3,
      green3,
      blue3
    }
  };
}

export function decodePwv5Payload(payload, sampleRate = 150) {
  const buffer = toBuffer(payload);
  const samples = new Array(Math.floor(buffer.length / 2));

  for (let index = 0; index < samples.length; index += 1) {
    const word = buffer.readUInt16BE(index * 2);
    const decoded = decodePwv5Word(word);
    samples[index] = {
      index,
      timeSeconds: Number((index / sampleRate).toFixed(6)),
      red: decoded.red,
      green: decoded.green,
      blue: decoded.blue,
      height: decoded.height,
      raw: decoded.raw
    };
  }

  return samples;
}

function summarizePwv5Payload(payload, options = {}) {
  const buffer = toBuffer(payload);
  const sampleRate = Number.isFinite(Number(options.sampleRate)) ? Number(options.sampleRate) : 150;
  const binCountRaw = Number.isFinite(Number(options.binCount)) ? Number(options.binCount) : 96;
  const binCount = Math.max(16, Math.min(512, Math.floor(binCountRaw)));
  const rhythmSegmentsRaw = Number.isFinite(Number(options.rhythmSegmentCount))
    ? Number(options.rhythmSegmentCount)
    : 64;
  const rhythmSegmentCount = Math.max(16, Math.min(128, Math.floor(rhythmSegmentsRaw)));
  const totalSamples = Math.floor(buffer.length / 2);
  const bins = new Array(binCount).fill(0);
  const binCounters = new Array(binCount).fill(0);
  const binRed = new Array(binCount).fill(0);
  const binGreen = new Array(binCount).fill(0);
  const binBlue = new Array(binCount).fill(0);
  const rhythmSegments = new Array(rhythmSegmentCount).fill(0);
  const rhythmCounters = new Array(rhythmSegmentCount).fill(0);

  if (totalSamples === 0) {
    return {
      sampleRate,
      sampleCount: 0,
      durationSeconds: 0,
      bins,
      binColors: new Array(binCount).fill(null).map(() => ({ red: 0, green: 0, blue: 0 })),
      avgColor: { red: 0, green: 0, blue: 0 },
      height: { avg: 0, max: 0 },
      rhythmSignature: new Array(rhythmSegmentCount).fill(0),
      rhythmSegmentCount
    };
  }

  let sumRed = 0;
  let sumGreen = 0;
  let sumBlue = 0;
  let sumHeight = 0;
  let maxHeight = 0;
  let prevHeight = 0;

  for (let index = 0; index < totalSamples; index += 1) {
    const word = buffer.readUInt16BE(index * 2);
    const red3 = (word >> 13) & 0x07;
    const green3 = (word >> 10) & 0x07;
    const blue3 = (word >> 7) & 0x07;
    const height = (word >> 2) & 0x1F;
    const red = scale3BitTo8Bit(red3);
    const green = scale3BitTo8Bit(green3);
    const blue = scale3BitTo8Bit(blue3);

    sumRed += red;
    sumGreen += green;
    sumBlue += blue;
    sumHeight += height;
    maxHeight = Math.max(maxHeight, height);

    const onset = Math.max(0, height - prevHeight);
    prevHeight = height;
    const rhythmIndex = Math.min(
      rhythmSegmentCount - 1,
      Math.floor((index / totalSamples) * rhythmSegmentCount)
    );
    rhythmSegments[rhythmIndex] += onset;
    rhythmCounters[rhythmIndex] += 1;

    const binIndex = Math.min(
      binCount - 1,
      Math.floor((index / totalSamples) * binCount)
    );
    bins[binIndex] += height;
    binCounters[binIndex] += 1;
    binRed[binIndex] += red;
    binGreen[binIndex] += green;
    binBlue[binIndex] += blue;
  }

  const averagedBins = bins.map((value, index) => {
    if (!binCounters[index]) {
      return 0;
    }
    return Number((value / binCounters[index]).toFixed(4));
  });
  const averagedBinColors = bins.map((_value, index) => {
    if (!binCounters[index]) {
      return { red: 0, green: 0, blue: 0 };
    }
    return {
      red: Math.round(binRed[index] / binCounters[index]),
      green: Math.round(binGreen[index] / binCounters[index]),
      blue: Math.round(binBlue[index] / binCounters[index])
    };
  });

  const averagedRhythm = rhythmSegments.map((value, index) => (
    rhythmCounters[index] ? value / rhythmCounters[index] : 0
  ));
  const magnitude = Math.sqrt(averagedRhythm.reduce((sum, value) => sum + (value * value), 0));
  const rhythmSignature = magnitude
    ? averagedRhythm.map((value) => Number((value / magnitude).toFixed(6)))
    : new Array(rhythmSegmentCount).fill(0);
  const kickSegmentCountRaw = Number.isFinite(Number(options.kickSegmentCount))
    ? Number(options.kickSegmentCount)
    : 16;
  const kickSegmentCount = Math.max(8, Math.min(64, Math.floor(kickSegmentCountRaw)));
  const kickSegments = new Array(kickSegmentCount).fill(0);
  const kickCounters = new Array(kickSegmentCount).fill(0);
  for (let index = 0; index < averagedRhythm.length; index += 1) {
    const kickIndex = Math.min(
      kickSegmentCount - 1,
      Math.floor((index / averagedRhythm.length) * kickSegmentCount)
    );
    kickSegments[kickIndex] += averagedRhythm[index];
    kickCounters[kickIndex] += 1;
  }
  const kickAverages = kickSegments.map((value, index) => (
    kickCounters[index] ? value / kickCounters[index] : 0
  ));
  const kickMagnitude = Math.sqrt(kickAverages.reduce((sum, value) => sum + (value * value), 0));
  const kickSignature = kickMagnitude
    ? kickAverages.map((value) => Number((value / kickMagnitude).toFixed(6)))
    : new Array(kickSegmentCount).fill(0);

  return {
    sampleRate,
    sampleCount: totalSamples,
    durationSeconds: Number((totalSamples / sampleRate).toFixed(3)),
    bins: averagedBins,
    binColors: averagedBinColors,
    avgColor: {
      red: Math.round(sumRed / totalSamples),
      green: Math.round(sumGreen / totalSamples),
      blue: Math.round(sumBlue / totalSamples)
    },
    height: {
      avg: Number((sumHeight / totalSamples).toFixed(4)),
      max: maxHeight
    },
    rhythmSignature,
    rhythmSegmentCount,
    kickSignature,
    kickSegmentCount
  };
}

export function extractPwv5FromAnlz(input, options = {}) {
  const buffer = toBuffer(input);
  const sampleRate = Number.isFinite(Number(options.sampleRate)) ? Number(options.sampleRate) : 150;
  const offsets = findAllTagOffsets(buffer, 'PWV5');

  if (offsets.length === 0) {
    return null;
  }

  const sections = offsets
    .map((sectionOffset) => parsePwv5Section(buffer, sectionOffset))
    .filter(Boolean)
    .sort((a, b) => b.payloadLength - a.payloadLength);

  if (!sections.length) {
    return null;
  }

  const section = sections[0];
  const payload = buffer.subarray(section.payloadStart, section.payloadEnd);
  const samples = decodePwv5Payload(payload, sampleRate);

  return {
    fourcc: 'PWV5',
    mode: section.mode,
    sectionOffset: section.sectionOffset,
    payloadOffset: section.payloadStart,
    payloadLength: section.payloadLength,
    sampleRate,
    sampleCount: samples.length,
    durationSeconds: Number((samples.length / sampleRate).toFixed(3)),
    samples
  };
}

export function extractPwv5SummaryFromAnlz(input, options = {}) {
  const buffer = toBuffer(input);
  const offsets = findAllTagOffsets(buffer, 'PWV5');

  if (offsets.length === 0) {
    return null;
  }

  const sections = offsets
    .map((sectionOffset) => parsePwv5Section(buffer, sectionOffset))
    .filter(Boolean)
    .sort((a, b) => b.payloadLength - a.payloadLength);

  if (!sections.length) {
    return null;
  }

  const section = sections[0];
  const payload = buffer.subarray(section.payloadStart, section.payloadEnd);
  const summary = summarizePwv5Payload(payload, options);

  return {
    fourcc: 'PWV5',
    mode: section.mode,
    sectionOffset: section.sectionOffset,
    payloadOffset: section.payloadStart,
    payloadLength: section.payloadLength,
    ...summary
  };
}
