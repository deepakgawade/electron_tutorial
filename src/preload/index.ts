import { contextBridge, ipcRenderer } from 'electron'
import type { Versions } from './versions'

const versions: Versions = {
    node:()=> process.versions.node,
    chrome:()=> process.versions.chrome,
    electron:()=> process.versions.electron,
    ping:()=> ipcRenderer.invoke('ping'),
    onUpdateCounter:(callback)=> ipcRenderer.on('update-counter', (_event, value)=>callback(value)),
    counterValue: (value)=> ipcRenderer.send('counter-value',value)
}

contextBridge.exposeInMainWorld('versions', versions)
