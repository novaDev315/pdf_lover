import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchPanel } from "@/components/pdf/SearchPanel";

describe("SearchPanel", () => {
  afterEach(() => cleanup());

  it("provides the tooltip context required by its search controls", () => {
    render(
      <SearchPanel
        query=""
        onQueryChange={vi.fn()}
        options={{ caseSensitive: false, wholeWord: false, regex: false }}
        onOptionsChange={vi.fn()}
        results={[]}
        searchState="idle"
        error={null}
        currentMatchIndex={-1}
        matchCount={0}
        onNextMatch={vi.fn()}
        onPrevMatch={vi.fn()}
        onGoToMatch={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Search text" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Case sensitive" }),
    ).toBeInTheDocument();
  });
});
