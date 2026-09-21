export interface Versions {
    node: () => string
    chrome: () => string
    electron: () => string
    ping: () => Promise<string>
    onUpdateCounter: (callback: (value: number) => void) => void
    counterValue: (value: number) => void
}

declare global {
    interface Window {
        versions: Versions
    }
}
