import type { Meta, StoryObj } from '@storybook/react-vite'
import { handlers, loadingHandlers, errorHandlers } from './mocks/handlers'
import BookList from './BookList'

const meta = {
    title: 'BookList',
    component: BookList,
} satisfies Meta<typeof BookList>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
    parameters: { msw: { handlers } },
}

export const Loading: Story = {
    parameters: { msw: { handlers: loadingHandlers } },
}

export const Error: Story = {
    parameters: { msw: { handlers: errorHandlers } },
}
