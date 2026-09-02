import { http, HttpResponse, delay } from 'msw'
import { mockBooks } from './fixtures'

const API_BASE = 'https://potterapi-fedeperin.vercel.app/en'

export const handlers = [
    http.get(`${API_BASE}/books`, () => HttpResponse.json(mockBooks)),
    http.get(`${API_BASE}/books/random`, () => HttpResponse.json(mockBooks[0])),
]

export const loadingHandlers = [
    http.get(`${API_BASE}/books`, async () => {
        await delay('infinite')
    }),
    http.get(`${API_BASE}/books/random`, async () => {
        await delay('infinite')
    }),
]

export const errorHandlers = [
    http.get(`${API_BASE}/books`, () => new HttpResponse(null, { status: 500 })),
    http.get(`${API_BASE}/books/random`, () => new HttpResponse(null, { status: 500 })),
]
