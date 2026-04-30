import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Button }     from "@/ui/Button";
import { Card }       from "@/ui/Card";
import { Input }      from "@/ui/Input";
import { Select }     from "@/ui/Select";
import { Badge }      from "@/ui/Badge";
import { Chip }       from "@/ui/Chip";
import { Skeleton }   from "@/ui/Skeleton";

expect.extend(toHaveNoViolations);

describe("UI components a11y", () => {
  it("Button has no violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Button disabled has no violations", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Card has no violations", async () => {
    const { container } = render(<Card>Content</Card>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Input with label has no violations", async () => {
    const { container } = render(<Input label="Email" type="email" placeholder="you@email.com"/>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Select has no violations", async () => {
    const { container } = render(<Select label="Category" options={[{id:"g",label:"Grocery"}]} onChange={()=>{}}/>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Badge has no violations", async () => {
    const { container } = render(<Badge color="green">Fresh</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Chip has no violations", async () => {
    const { container } = render(<Chip active onClick={()=>{}}>Grocery</Chip>);
    expect(await axe(container)).toHaveNoViolations();
  });
  it("Skeleton has no violations", async () => {
    const { container } = render(<Skeleton h={20} w={120}/>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
