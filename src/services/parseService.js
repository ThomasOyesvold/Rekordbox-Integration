import { Worker } from 'node:worker_threads';

export function startBackgroundParse(xmlPath, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/parseWorker.js', import.meta.url), {
      workerData: { xmlPath }
    });

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        if (typeof onProgress === 'function') {
          onProgress(message.value);
        }
        return;
      }

      if (message.type === 'done') {
        resolve(message.library);
        return;
      }

      if (message.type === 'error') {
        const error = new Error(message.error?.message || 'Parser worker failed.');
        error.issues = Array.isArray(message.error?.issues) ? message.error.issues : [];
        reject(error);
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Parser worker exited with code ${code}.`));
      }
    });
  });
}
