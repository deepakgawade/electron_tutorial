import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { handlers, errorHandlers } from './mocks/handlers'
import BookFeature from './BookFeature'

const meta = {
    title: 'BookFeature',
    component: BookFeature,
} satisfies Meta<typeof BookFeature>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    parameters: { msw: { handlers } },
}

export const WithBook: Story = {
    parameters: { msw: { handlers } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await userEvent.click(canvas.getByRole('button', { name: 'Random Book' }))
        await expect(canvas.findByRole('heading')).resolves.toBeVisible()
    },
}

export const Error: Story = {
    parameters: { msw: { handlers: errorHandlers } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await userEvent.click(canvas.getByRole('button', { name: 'Random Book' }))
        await expect(canvas.findByText('Failed to fetch a book. Try again.')).resolves.toBeVisible()
    },
}
