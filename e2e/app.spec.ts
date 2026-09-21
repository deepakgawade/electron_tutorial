import {test, expect, _electron as electron, type ElectronApplication, type Page} from '@playwright/test'

let app: ElectronApplication
let window: Page

test.beforeEach(async ()=>{
    app =  await electron.launch({args:['.']})
    window = await app.firstWindow()
})

test.afterEach(async ()=>{await app.close()})


test('renders the default window', async ()=>{
    await expect(window.locator('#ping')).toBeVisible()
    await expect(window.locator('.book-list li')).toHaveCount(8)
    await expect(window).toHaveScreenshot('default-window.png')

})

test('ping button shows a pong response', async ()=>{
    await window.locator('#ping').click()
    await expect(window.locator('#info')).toContainText('Ping response: pong')

})

test('favorite star toggles and updates the count', async()=>{
    const firstStar = window.locator('.favorite-btn').first()
    await firstStar.click()
    await expect(window.locator('text=Favorites: 1')).toBeVisible()
    await firstStar.click()
    await expect(window.locator('text=Favorites: 0')).toBeVisible()})
