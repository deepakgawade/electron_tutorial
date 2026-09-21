import type { Preview } from '@storybook/react-vite'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { mswLoader } from 'msw-storybook-addon/csf3'
import { potterApi } from '../src/renderer/potterApi'
import favoritesReducer from '../src/renderer/favoritesSlice'
import { handlers } from '../src/renderer/mocks/handlers'
import '../src/renderer/styles/tokens.css'
import '../src/renderer/styles/global.css'

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },

        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: 'todo'
        },

        msw: {
            handlers,
        },
    },

    loaders: [mswLoader()],

    decorators: [
        (Story) => {
            // fresh store per story so RTK Query cache / favorites state never leaks between stories
            const store = configureStore({
                reducer: {
                    [potterApi.reducerPath]: potterApi.reducer,
                    favorites: favoritesReducer,
                },
                middleware: (getDefault) => getDefault().concat(potterApi.middleware),
            })
            return (
                <Provider store={store}>
                    <Story />
                </Provider>
            )
        },
    ],
};

export default preview;
