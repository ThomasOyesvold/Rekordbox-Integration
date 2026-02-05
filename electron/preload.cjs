const { contextBridge, ipcRenderer } = require('electron');

console.log('[rbfa] preload version: rbfa-file-url-2026-02-05');

contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  buildInfo: {
    buildTag: 'rbfa-file-url-2026-02-05'
  },
  pickXmlFile: () => ipcRenderer.invoke('dialog:pickXml'),
  parseLibrary: (xmlPath, selectedFolders, options = {}) => ipcRenderer.invoke('library:parse', {
    xmlPath,
    selectedFolders,
    anlzMapPath: options?.anlzMapPath || null,
    anlzMaxTracks: options?.anlzMaxTracks
  }),
  runBaselineAnalysis: (tracks, sourceXmlPath, selectedFolders) => ipcRenderer.invoke('analysis:baseline', {
    tracks,
    sourceXmlPath,
    selectedFolders
  }),
  exportAnalysis: (payload) => ipcRenderer.invoke('analysis:export', payload),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (patch) => ipcRenderer.invoke('state:save', patch),
  getRecentImports: () => ipcRenderer.invoke('imports:recent'),
  checkFileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  checkFileReadable: (filePath) => ipcRenderer.invoke('file:readable', filePath),
  resolveAudioPath: (rawPath) => ipcRenderer.invoke('audio:resolvePath', rawPath),
  onParseProgress: (listener) => {
    const wrapped = (_event, value) => listener(value);
    ipcRenderer.on('library:parseProgress', wrapped);

    return () => {
      ipcRenderer.removeListener('library:parseProgress', wrapped);
    };
  }
});
