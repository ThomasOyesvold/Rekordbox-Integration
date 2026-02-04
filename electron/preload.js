import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rbfa', {
  pickXmlFile: () => ipcRenderer.invoke('dialog:pickXml'),
  parseLibrary: (xmlPath, selectedFolders) => ipcRenderer.invoke('library:parse', { xmlPath, selectedFolders }),
  runBaselineAnalysis: (tracks, sourceXmlPath, selectedFolders) => ipcRenderer.invoke('analysis:baseline', {
    tracks,
    sourceXmlPath,
    selectedFolders
  }),
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
