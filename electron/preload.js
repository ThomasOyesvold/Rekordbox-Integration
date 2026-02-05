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
  runBaselineAnalysis: (tracks, sourceXmlPath, selectedFolders) => ipcRenderer.invoke('analysis:baseline', {
    tracks,
    sourceXmlPath,
    selectedFolders
  }),
  exportAnalysis: (payload) => ipcRenderer.invoke('analysis:export', payload),
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
