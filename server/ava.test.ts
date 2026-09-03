import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(),
  createConversation: vi.fn(),
  createTask: vi.fn(),
  getConversation: vi.fn(),
  saveMessage: vi.fn(),
}));

const { invokeLLM, listLLMModels, createConversation, createTask, getConversation, saveMessage } = mocks;

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
  listLLMModels: mocks.listLLMModels,
}));

vi.mock("./db", () => ({
  createConversation: mocks.createConversation,
  createTask: mocks.createTask,
  getConversation: mocks.getConversation,
  listConversations: vi.fn(),
  listTasks: vi.fn(),
  renameConversation: vi.fn(),
  saveMessage: mocks.saveMessage,
  updateTaskStatus: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "ava-test-user",
      email: "ava@example.com",
      name: "AVA Tester",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("ava.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLLMModels.mockResolvedValue({ data: [{ id: "gpt-5-mini" }] });
    createConversation.mockResolvedValue({ id: 7, userId: 42, title: "Plan my week" });
    getConversation.mockResolvedValue({ conversation: { id: 7, userId: 42 }, messages: [] });
    createTask.mockResolvedValue({ id: 9, title: "Review weekly priorities", priority: "high" });
    saveMessage.mockResolvedValue(undefined);
    invokeLLM.mockResolvedValue({
      model: "gpt-5-mini",
      choices: [{
        message: {
          role: "assistant",
          content: "I added that to your plan.",
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: {
              name: "create_task",
              arguments: JSON.stringify({ title: "Review weekly priorities", priority: "high" }),
            },
          }],
        },
        finish_reason: "tool_calls",
      }],
    });
  });

  it("uses the cached fast model route and persists a task tool call", async () => {
    const result = await appRouter.createCaller(createContext()).ava.chat({
      input: "Remember that I need to review my weekly priorities",
      messages: [],
    });

    expect(result.conversationId).toBe(7);
    expect(result.task?.title).toBe("Review weekly priorities");
    expect(result.content).toContain("Added");
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
      toolChoice: "auto",
    }));
    expect(saveMessage).toHaveBeenCalledTimes(2);
    expect(createTask).toHaveBeenCalledWith(42, expect.objectContaining({
      title: "Review weekly priorities",
      priority: "high",
    }));
  });
});
