const { contextBridge, ipcRenderer } = require('electron');

console.log('[rbfa] preload version: rbfa-file-url-2026-02-07-1.1');

contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  buildInfo: {
    buildTag: 'rbfa-file-url-2026-02-07-1.1'
  },
  pickXmlFile: () => ipcRenderer.invoke('dialog:pickXml'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  parseLibrary: (xmlPath, selectedFolders, options = {}) => ipcRenderer.invoke('library:parse', {
    xmlPath,
    selectedFolders,
    anlzMapPath: options?.anlzMapPath || null,
    anlzMaxTracks: options?.anlzMaxTracks
  }),
  buildAnlzMapping: (tracks, usbAnlzPath, outPath) => ipcRenderer.invoke('anlz:buildMapping', {
    tracks,
    usbAnlzPath,
    outPath
  }),
  cancelAnlzMapping: () => ipcRenderer.invoke('anlz:cancelBuild'),
  onAnlzProgress: (listener) => {
    const wrapped = (_event, value) => listener(value);
    ipcRenderer.on('anlz:progress', wrapped);

    return () => {
      ipcRenderer.removeListener('anlz:progress', wrapped);
    };
  },
  onAnalysisProgress: (listener) => {
    const wrapped = (_event, value) => listener(value);
    ipcRenderer.on('analysis:progress', wrapped);

    return () => {
      ipcRenderer.removeListener('analysis:progress', wrapped);
    };
  },
  runBaselineAnalysis: (tracks, sourceXmlPath, selectedFolders, options = {}) => ipcRenderer.invoke('analysis:baseline', {
    tracks,
    sourceXmlPath,
    selectedFolders,
    maxPairs: options?.maxPairs,
    maxPairsCap: options?.maxPairsCap,
    yieldEveryPairs: options?.yieldEveryPairs,
    memoryLimitMb: options?.memoryLimitMb,
    memoryCheckEveryPairs: options?.memoryCheckEveryPairs
  }),
  cancelBaselineAnalysis: () => ipcRenderer.invoke('analysis:cancel'),
  findSimilarTracks: (payload) => ipcRenderer.invoke('tracks:similar', payload),
  exportAnalysis: (payload) => ipcRenderer.invoke('analysis:export', payload),
  generatePlaylists: (payload) => ipcRenderer.invoke('playlists:cluster', payload),
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
