const { app, Menu, Tray, BrowserWindow, nativeImage, globalShortcut} = require('electron');
// Module to control application life.
//const app = electron.app
// Module to create native browser window.
//const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
var os = require('os');

require('electron-reload')(__dirname,{
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

let tray = null


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {

  app.setAppUserModelId("ar.com.interfazrobotica"); // set appId from package.json

  globalShortcut.register('CommandOrControl+T', () => {
    mainWindow.webContents.openDevTools()
  })

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1150, height: 600, center: true, minimizable: true, show: false,
    icon: path.join(__dirname, 'resources','interfaz.png')
  })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'src/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
 // mainWindow.webContents.openDevTools()
  
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  mainWindow.on('close', function (event) {
    if(!app.isQuiting){
        event.preventDefault();
        mainWindow.hide();
    }

    return false;
});

var  iconPath = os.platform() == 'win32' ? path.join(__dirname,'resources', 'interfaz.png') : 'build/interfaz.png';
var trayIcon = nativeImage.createFromPath(iconPath);
//trayIcon = trayIcon.resize({ width: 32, height: 32 });
  tray = new Tray(trayIcon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Salir', type: 'normal', click:  function() {app.isQuiting = true;app.quit()} }
  ])
  tray.setToolTip('Interfaz Link')
  tray.setContextMenu(contextMenu)

  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })


}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  app.quit()
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
