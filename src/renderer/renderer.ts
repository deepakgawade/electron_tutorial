const information = document.getElementById('info')!

information.innerText = `Node.js version: ${window.versions.node()}\nChrome version: ${window.versions.chrome()}\nElectron version: ${window.versions.electron()}`

const funcPing = async ()=> {
    const response = await  window.versions.ping()

    information.innerText += `\nPing response: ${response}`
}

document.getElementById('ping')!.addEventListener('click', funcPing)

const  counter = document.getElementById('counter')!

window.versions.onUpdateCounter((value)=>{
    const oldValue = Number(counter.innerText)
    const newValue = oldValue + value
    counter.innerText = newValue.toString()

    window.versions.counterValue(newValue)
})
