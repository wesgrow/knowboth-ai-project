import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story    = { args: { children: "Scan Bill",   variant: "primary", size: "md" } };
export const Ghost: Story      = { args: { children: "Cancel",      variant: "ghost",   size: "md" } };
export const Danger: Story     = { args: { children: "Delete",      variant: "danger",  size: "md" } };
export const Small: Story      = { args: { children: "View all →",  variant: "link",    size: "sm" } };
export const Loading: Story    = { args: { children: "Saving",      loading: true,      size: "md" } };
export const Disabled: Story   = { args: { children: "Unavailable", disabled: true,     size: "md" } };
export const FullWidth: Story  = { args: { children: "Add to Cart", full: true,         size: "lg" } };
