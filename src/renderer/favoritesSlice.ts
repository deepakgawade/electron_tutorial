import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface FavoritesState {
    indexes: number[]
}

const initialState: FavoritesState = { indexes: [] }

const favoritesSlice = createSlice({
    name: 'favorites',
    initialState,
    reducers: {
        toggleFavorite: (state, action: PayloadAction<number>) => {
            const i = state.indexes.indexOf(action.payload)
            if (i === -1) {
                state.indexes.push(action.payload)
            } else {
                state.indexes.splice(i, 1)
            }
        },
    },
})

export const { toggleFavorite } = favoritesSlice.actions
export default favoritesSlice.reducer
