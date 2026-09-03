import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(),
  listPendingTasks: vi.fn(),
  saveBriefing: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
  listLLMModels: mocks.listLLMModels,
}));
vi.mock("./db", () => ({
  listPendingTasks: mocks.listPendingTasks,
  saveBriefing: mocks.saveBriefing,
}));

import { generateDailyBriefing } from "./briefing";

describe("generateDailyBriefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listLLMModels.mockResolvedValue({ data: [{ id: "gpt-5-mini" }] });
    mocks.listPendingTasks.mockResolvedValue([
      { title: "Review campaign performance", status: "in_progress", priority: "high", dueAt: null, notes: null },
    ]);
    mocks.invokeLLM.mockResolvedValue({
      model: "gpt-5-mini",
      choices: [{ message: { content: "## Focus today\n- Review campaign performance" } }],
    });
    mocks.saveBriefing.mockResolvedValue({ id: 3, briefingDate: "2026-09-04" });
  });

  it("combines pending tasks and calendar events and saves one dated briefing", async () => {
    const result = await generateDailyBriefing(42, "2026-09-04", [
      { title: "Stand-up", start: "2026-09-04T09:30:00+05:30", end: "2026-09-04T10:00:00+05:30" },
    ]);

    expect(result?.id).toBe(3);
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
    }));
    expect(mocks.invokeLLM.mock.calls[0]?.[0].messages[1].content).toContain("Stand-up");
    expect(mocks.saveBriefing).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      briefingDate: "2026-09-04",
      taskCount: 1,
      eventCount: 1,
    }));
  });
});
