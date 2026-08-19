const information = document.getElementById('info')

information.innerText = `Node.js version: ${window.versions.node()}\nChrome version: ${window.versions.chrome()}\nElectron version: ${window.versions.electron()}`