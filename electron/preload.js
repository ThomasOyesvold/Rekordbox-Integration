import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rbfa', {
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
  runBaselineAnalysis: (tracks, sourceXmlPath, selectedFolders) => ipcRenderer.invoke('analysis:baseline', {
    tracks,
    sourceXmlPath,
    selectedFolders
  }),
  findSimilarTracks: (payload) => ipcRenderer.invoke('tracks:similar', payload),
  exportAnalysis: (payload) => ipcRenderer.invoke('analysis:export', payload),
  generatePlaylists: (payload) => ipcRenderer.invoke('playlists:cluster', payload),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (patch) => ipcRenderer.invoke('state:save', patch),
  getRecentImports: () => ipcRenderer.invoke('imports:recent'),
  onParseProgress: (listener) => {
    const wrapped = (_event, value) => listener(value);
    ipcRenderer.on('library:parseProgress', wrapped);

    return () => {
      ipcRenderer.removeListener('library:parseProgress', wrapped);
    };
  }
});
