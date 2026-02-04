import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { extractPwv5FromAnlz } from '../src/parser/anlzWaveformParser.js';

function printUsage() {
  console.log('Usage: node scripts/testWaveformExtraction.js --ext /path/to/ANLZ0000.EXT [--limit 100] [--out ./waveform.json]');
}

function parseArgs(argv) {
  const options = {
    extPath: null,
    limit: 100,
    outPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--ext' && argv[index + 1]) {
      options.extPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--limit' && argv[index + 1]) {
      const limit = Number(argv[index + 1]);
      if (Number.isFinite(limit) && limit >= 0) {
        options.limit = Math.floor(limit);
      }
      index += 1;
      continue;
    }

    if (arg === '--out' && argv[index + 1]) {
      options.outPath = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.extPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const extPath = path.resolve(options.extPath);
  const extBuffer = await fs.readFile(extPath);
  const waveform = extractPwv5FromAnlz(extBuffer, { sampleRate: 150 });

  if (!waveform) {
    console.log(`[waveform-poc] No PWV5 section found in ${extPath}`);
    process.exitCode = 2;
    return;
  }

  const samplePreview = waveform.samples.slice(0, options.limit);
  console.log(`[waveform-poc] file=${extPath}`);
  console.log(`[waveform-poc] mode=${waveform.mode}`);
  console.log(`[waveform-poc] sectionOffset=${waveform.sectionOffset}`);
  console.log(`[waveform-poc] payloadOffset=${waveform.payloadOffset}`);
  console.log(`[waveform-poc] payloadBytes=${waveform.payloadLength}`);
  console.log(`[waveform-poc] sampleCount=${waveform.sampleCount}`);
  console.log(`[waveform-poc] durationSeconds~${waveform.durationSeconds}`);
  console.log(`[waveform-poc] previewCount=${samplePreview.length}`);
  console.log(JSON.stringify(samplePreview, null, 2));

  if (options.outPath) {
    const outPath = path.resolve(options.outPath);
    const payload = {
      sourceFile: extPath,
      extractedAt: new Date().toISOString(),
      fourcc: waveform.fourcc,
      sampleRate: waveform.sampleRate,
      sampleCount: waveform.sampleCount,
      durationSeconds: waveform.durationSeconds,
      samples: waveform.samples
    };

    await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[waveform-poc] wrote=${outPath}`);
  }
}

main().catch((error) => {
  console.error(`[waveform-poc] ${error.message}`);
  process.exitCode = 1;
});
