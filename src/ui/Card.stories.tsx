import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta: Meta<typeof Card> = { title: "UI/Card", component: Card, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = { args: { children: "Card content", pad: 16, radius: 16 } };
export const NoBorder: Story = { args: { children: "No shadow", shadow: false, border: true } };
