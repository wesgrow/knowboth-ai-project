import { render } from "@testing-library/react";
import { DefaultTemplate }    from "@/templates/DefaultTemplate";
import { HomeTemplate }       from "@/templates/HomeTemplate";
import { AnalyticsTemplate }  from "@/templates/AnalyticsTemplate";
import { CommunityTemplate }  from "@/templates/CommunityTemplate";

const Child = () => <div>test</div>;

describe("Templates snapshot", () => {
  it("DefaultTemplate", () => {
    const { container } = render(<DefaultTemplate><Child/></DefaultTemplate>);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("HomeTemplate", () => {
    const { container } = render(<HomeTemplate><Child/></HomeTemplate>);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("AnalyticsTemplate", () => {
    const { container } = render(<AnalyticsTemplate><Child/></AnalyticsTemplate>);
    expect(container.firstChild).toMatchSnapshot();
  });
  it("CommunityTemplate", () => {
    const { container } = render(<CommunityTemplate><Child/></CommunityTemplate>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
