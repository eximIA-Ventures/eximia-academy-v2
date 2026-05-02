import type { Preview } from "@storybook/react"
import "../src/storybook.css"

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#0f0f0f" },
        { name: "surface", value: "#1a1a1a" },
        { name: "card", value: "#1e1e1e" },
        { name: "elevated", value: "#242424" },
        { name: "light", value: "#ffffff" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  tags: ["autodocs"],
}

export default preview
