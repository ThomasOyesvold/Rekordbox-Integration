import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { parseRekordboxXml } from '../parser/rekordboxParser.js';

function readFileWithProgress(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (statError, stats) => {
      if (statError) {
        reject(statError);
        return;
      }

      const totalSize = stats.size;
      let readSize = 0;
      let nextProgressMark = 0;
      const chunks = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

      stream.on('data', (chunk) => {
        chunks.push(chunk);
        readSize += Buffer.byteLength(chunk, 'utf8');

        if (totalSize > 0) {
          const percent = Math.floor((readSize / totalSize) * 100);
          if (percent >= nextProgressMark) {
            parentPort.postMessage({ type: 'progress', value: percent });
            nextProgressMark += 5;
          }
        }
      });

      stream.on('error', reject);
      stream.on('end', () => resolve(chunks.join('')));
    });
  });
}

async function run() {
  try {
    const xmlText = await readFileWithProgress(workerData.xmlPath);
    const library = parseRekordboxXml(xmlText);
    parentPort.postMessage({ type: 'progress', value: 100 });
    parentPort.postMessage({ type: 'done', library });
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        issues: Array.isArray(error?.issues) ? error.issues : []
      }
    });
  }
}

run();
