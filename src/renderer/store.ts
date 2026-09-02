import {configureStore} from '@reduxjs/toolkit'
import { potterApi} from './potterApi'
import favoritesReducer from './favoritesSlice'

export const store  = configureStore({
    reducer: {
        [potterApi.reducerPath]: potterApi.reducer,
        favorites: favoritesReducer,
    },
    middleware: (getDefault)=> getDefault().concat(potterApi.middleware)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
