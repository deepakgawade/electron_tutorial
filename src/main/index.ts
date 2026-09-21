import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js')
        }
    })
    const menu = Menu.buildFromTemplate([
        {label: app.name,
            submenu:[
                {click:()=>win.webContents.send('update-counter', 1),
                    label: 'Increment'
                },
                {
                    click:()=> win.webContents.send('update-counter', -1),
                    label:'Decrement'
                }
            ]
        }
    ])
    Menu.setApplicationMenu(menu)

    if (process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        win.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    //win.webContents.openDevTools()
}

app.whenReady().then(()=>{

    ipcMain.on('counter-value', (_event, value)=> {
        console.log('Counter value:', value)
    })

    ipcMain.handle('ping', ()=>'pong')

    createWindow()

    app.on('activate', ()=> {
        if(BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed',()=>{app.quit()});
