import type { Preview } from "@storybook/react";
import "../src/app/globals.css";
import "../src/styles/animations.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark",  value: "#1a1a1a" },
        { name: "light", value: "#f5f5f5" },
      ],
    },
    layout: "centered",
    a11y: { config: {} },
  },
};
export default preview;
