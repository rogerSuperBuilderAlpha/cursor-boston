import {
  filterOpportunityListings,
  formatOpportunityType,
  getOpportunityTypeOptions,
  type OpportunityListing,
} from "@/lib/opportunity-listings";

const opportunities: OpportunityListing[] = [
  {
    id: "cofounder",
    title: "CTO / Co-Founder",
    company: "BeatM",
    type: "cofounder",
    compensation: "Equity",
    location: "Boston, MA",
    remote: false,
    description: "Build social fantasy sports with a founding team.",
    aboutCompany: "Fantasy sports community tooling for Boston builders.",
    tags: ["Sports Tech", "Equity"],
  },
  {
    id: "remote-contract",
    title: "AI Product Engineer",
    company: "Northstar",
    type: "contract",
    location: "Remote",
    remote: true,
    description: "Prototype AI workflows for customer support teams.",
    tags: ["AI", "Support"],
  },
  {
    id: "full-time",
    title: "Platform Engineer",
    company: "Harbor",
    type: "full-time",
    location: "Cambridge, MA",
    remote: false,
    description: "Scale Firebase and Next.js systems.",
    tags: ["Firebase", "Next.js"],
  },
];

describe("opportunity listing helpers", () => {
  it("formats known and unknown opportunity types", () => {
    expect(formatOpportunityType("cofounder")).toBe("Co-Founder");
    expect(formatOpportunityType("full-time")).toBe("Full-Time");
    expect(formatOpportunityType("advisor")).toBe("Advisor");
  });

  it("returns sorted opportunity type options", () => {
    expect(getOpportunityTypeOptions(opportunities)).toEqual([
      "cofounder",
      "contract",
      "full-time",
    ]);
  });

  it("filters by query across title, company, description, and tags", () => {
    expect(
      filterOpportunityListings(opportunities, { query: "fantasy" }).map(
        (opportunity) => opportunity.id
      )
    ).toEqual(["cofounder"]);
    expect(
      filterOpportunityListings(opportunities, { query: "firebase" }).map(
        (opportunity) => opportunity.id
      )
    ).toEqual(["full-time"]);
    expect(
      filterOpportunityListings(opportunities, { query: "equity" }).map(
        (opportunity) => opportunity.id
      )
    ).toEqual(["cofounder"]);
  });

  it("treats blank filters as the full listings set", () => {
    expect(filterOpportunityListings(opportunities, {})).toEqual(opportunities);
    expect(
      filterOpportunityListings(opportunities, {
        query: "   ",
        type: "all",
        workMode: "all",
      })
    ).toEqual(opportunities);
  });

  it("filters by type and work mode", () => {
    expect(
      filterOpportunityListings(opportunities, {
        type: "contract",
        workMode: "remote",
      }).map((opportunity) => opportunity.id)
    ).toEqual(["remote-contract"]);

    expect(
      filterOpportunityListings(opportunities, {
        workMode: "in-person",
      }).map((opportunity) => opportunity.id)
    ).toEqual(["cofounder", "full-time"]);
  });
});
