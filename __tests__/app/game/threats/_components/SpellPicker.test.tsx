/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { SpellPicker } from "@/app/game/threats/_components/SpellPicker";
import { ALL_SPELLS } from "@/lib/game/content";
import type { SpellDefinition } from "@/lib/game/types";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => <div data-testid="catalog-image" />,
}));

const offensiveSpells: ReadonlyArray<SpellDefinition> = ALL_SPELLS.filter(
  (s) => s.type === "offense"
).slice(0, 2);

describe("SpellPicker", () => {
  it("renders the header + optional-spell hint", () => {
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map()}
        selectedSpellId=""
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText(/Offensive spell/)).toBeInTheDocument();
    expect(screen.getByText(/optional · \+5t when cast/)).toBeInTheDocument();
  });

  it("renders the empty-state message when no spells are unlocked", () => {
    render(
      <SpellPicker
        spells={[]}
        expectedById={new Map()}
        selectedSpellId=""
        onSelect={() => undefined}
      />
    );
    expect(
      screen.getByText(/No offensive spells unlocked yet/)
    ).toBeInTheDocument();
  });

  it("renders a 'No spell' card alongside each spell", () => {
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map()}
        selectedSpellId=""
        onSelect={() => undefined}
      />
    );
    expect(screen.getByText("No spell")).toBeInTheDocument();
    // Each spell title is prefixed with the tier (e.g. "T1 Smite").
    for (const s of offensiveSpells) {
      expect(screen.getByText(new RegExp(s.name))).toBeInTheDocument();
    }
  });

  it("calls onSelect with empty string when the No-spell card is clicked", () => {
    const onSelect = jest.fn();
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map()}
        selectedSpellId={offensiveSpells[0]!.id}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("No spell").closest("button")!);
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("calls onSelect with the spell id when a spell card is clicked", () => {
    const onSelect = jest.fn();
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map()}
        selectedSpellId=""
        onSelect={onSelect}
      />
    );
    const spell = offensiveSpells[0]!;
    fireEvent.click(screen.getByText(new RegExp(spell.name)).closest("button")!);
    expect(onSelect).toHaveBeenCalledWith(spell.id);
  });

  it("toggles selection off when the currently-selected spell is clicked again", () => {
    const onSelect = jest.fn();
    const spell = offensiveSpells[0]!;
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map()}
        selectedSpellId={spell.id}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText(new RegExp(spell.name)).closest("button")!);
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("shows the expected-attack-power chip when expectedById has the spell", () => {
    const spell = offensiveSpells[0]!;
    render(
      <SpellPicker
        spells={offensiveSpells}
        expectedById={new Map([[spell.id, 12.4]])}
        selectedSpellId=""
        onSelect={() => undefined}
      />
    );
    // Rounded to the nearest int.
    expect(screen.getByText("~+12 atk")).toBeInTheDocument();
  });
});
