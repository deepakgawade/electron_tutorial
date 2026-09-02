import type { Book } from '../potterApi'

export const mockBooks: Book[] = [
    { index: 0, title: 'Mock Book 1', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/1.png', pages: 100, releaseDate: 'Jan 1, 2000', description: 'Fixture description one.' },
    { index: 1, title: 'Mock Book 2', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/2.png', pages: 200, releaseDate: 'Jan 1, 2001', description: 'Fixture description two.' },
    { index: 2, title: 'Mock Book 3', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/3.png', pages: 300, releaseDate: 'Jan 1, 2002', description: 'Fixture description three.' },
    { index: 3, title: 'Mock Book 4', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/4.png', pages: 400, releaseDate: 'Jan 1, 2003', description: 'Fixture description four.' },
    { index: 4, title: 'Mock Book 5', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/5.png', pages: 500, releaseDate: 'Jan 1, 2004', description: 'Fixture description five.' },
    { index: 5, title: 'Mock Book 6', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/6.png', pages: 600, releaseDate: 'Jan 1, 2005', description: 'Fixture description six.' },
    { index: 6, title: 'Mock Book 7', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/7.png', pages: 700, releaseDate: 'Jan 1, 2006', description: 'Fixture description seven.' },
    { index: 7, title: 'A very long book title that should wrap and stress-test the layout in visual snapshots', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/1.png', pages: 800, releaseDate: 'Jan 1, 2007', description: 'Fixture description eight.' },
]
