import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, listLLMModels, type Message as LLMMessage, type Tool } from "./_core/llm";
import {
  createConversation,
  createTask,
  getConversation,
  listBriefings,
  listConversations,
  listTasks,
  renameConversation,
  saveMessage,
  updateTaskStatus,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});

const taskTool: Tool = {
  type: "function",
  function: {
    name: "create_task",
    description: "Create a personal task when the user clearly asks AVA to remember, schedule, or track an action.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short actionable task title" },
        notes: { type: "string", description: "Optional details or context" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        dueAt: { type: "string", description: "Optional ISO date-time if the user gave a due date" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
};

const modelPreference = ["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"];
let fastModelPromise: Promise<string | undefined> | undefined;

async function getFastModel() {
  if (!fastModelPromise) {
    fastModelPromise = listLLMModels()
      .then(({ data }) => {
        const available = new Set(data.map(model => model.id));
        return modelPreference.find(model => available.has(model)) ?? data[0]?.id;
      })
      .catch(error => {
        console.warn("[AVA] Model discovery failed; using gateway default", error);
        return undefined;
      });
  }
  return fastModelPromise;
}

const systemPrompt = `You are AVA, a fast and capable personal AI command center. Be concise, warm, and action-oriented. You help the user plan work, think clearly, draft content, and manage personal tasks. Use markdown only when it improves scanning. If the user asks you to remember, track, schedule, or add an actionable item, call create_task. Never claim an action happened unless you completed it with a tool.`;

function textFromContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "string" ? part : "text" in part ? part.text : ""))
      .join("");
  }
  return "";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ava: router({
    listConversations: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    listBriefings: protectedProcedure.query(({ ctx }) => listBriefings(ctx.user.id)),
    getConversation: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ ctx, input }) => getConversation(ctx.user.id, input.id)),
    listTasks: protectedProcedure.query(({ ctx }) => listTasks(ctx.user.id)),
    renameConversation: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(180) }))
      .mutation(async ({ ctx, input }) => {
        const result = await getConversation(ctx.user.id, input.id);
        if (!result.conversation) throw new TRPCError({ code: "NOT_FOUND" });
        await renameConversation(input.id, input.title);
        return { success: true } as const;
      }),
    updateTaskStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["todo", "in_progress", "done"]) }))
      .mutation(async ({ ctx, input }) => {
        const task = await updateTaskStatus(ctx.user.id, input.id, input.status);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        return task;
      }),
    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number().int().positive().optional(),
        input: z.string().trim().min(1).max(12000),
        messages: z.array(chatMessageSchema).max(30).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        let conversationId = input.conversationId;
        if (conversationId) {
          const existing = await getConversation(ctx.user.id, conversationId);
          if (!existing.conversation) throw new TRPCError({ code: "NOT_FOUND" });
        } else {
          const conversation = await createConversation(ctx.user.id, input.input.slice(0, 56));
          if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Conversation storage is unavailable." });
          conversationId = conversation.id;
        }

        const history: LLMMessage[] = input.messages.slice(-12).map(message => ({
          role: message.role,
          content: message.content,
        }));
        const model = await getFastModel();
        const response = await invokeLLM({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: input.input },
          ],
          tools: [taskTool],
          toolChoice: "auto",
          ...(model?.startsWith("gpt-") ? { reasoning: { effort: "minimal" } } : {}),
          maxTokens: 900,
        });

        const choice = response.choices[0];
        const call = choice?.message.tool_calls?.find(toolCall => toolCall.function.name === "create_task");
        let createdTask;
        if (call) {
          try {
            const args = JSON.parse(call.function.arguments) as {
              title?: string;
              notes?: string;
              priority?: "low" | "medium" | "high";
              dueAt?: string;
            };
            if (!args.title?.trim()) throw new Error("Task title is missing");
            createdTask = await createTask(ctx.user.id, {
              title: args.title.trim(),
              notes: args.notes?.trim(),
              priority: args.priority ?? "medium",
              dueAt: args.dueAt ? new Date(args.dueAt) : undefined,
            });
          } catch (error) {
            console.warn("[AVA] Tool call could not be persisted", error);
          }
        }

        const responseText = call && createdTask
          ? `${textFromContent(choice?.message.content) || "Done — I added that to your task list."}\n\n**Added:** ${createdTask.title}`
          : textFromContent(choice?.message.content) || "I’m ready. What should we work on?";

        await saveMessage(conversationId, "user", input.input);
        await saveMessage(conversationId, "assistant", responseText);
        return {
          conversationId,
          content: responseText,
          task: createdTask ?? null,
          model: response.model || model || "gateway-default",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
