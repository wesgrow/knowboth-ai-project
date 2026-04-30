import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = { title: "UI/Badge", component: Badge, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Badge>;

export const Gold: Story   = { args: { children: "✦ 120 pts", color: "gold"  } };
export const Green: Story  = { args: { children: "Fresh",      color: "green" } };
export const Red: Story    = { args: { children: "Expiring",   color: "red"   } };
export const Blue: Story   = { args: { children: "0.1 mi",     color: "blue"  } };
