
import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

export interface Book {
    index: number
    title: string
    cover: string
    pages: number
    releaseDate: string
    description: string
}

export const potterApi = createApi({
    reducerPath: 'potterApi',
    baseQuery: fetchBaseQuery({baseUrl:'https://potterapi-fedeperin.vercel.app/en/'}),
    endpoints: (builder)=>({
        getRandomBook: builder.query<Book, void>({query: ()=>'books/random'}),
        getAllBooks: builder.query<Book[], void>({query: ()=>'books'}),
    }),
 })

 export const {useLazyGetRandomBookQuery, useGetAllBooksQuery} = potterApi
