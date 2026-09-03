import { invokeLLM, listLLMModels } from "./_core/llm";
import { listPendingTasks, saveBriefing } from "./db";

export type CalendarEvent = {
  title: string;
  start?: string;
  end?: string;
  location?: string;
  allDay?: boolean;
};

const modelPreference = ["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"];
let modelPromise: Promise<string | undefined> | undefined;

async function getBriefingModel() {
  if (!modelPromise) {
    modelPromise = listLLMModels().then(({ data }) => {
      const available = new Set(data.map(model => model.id));
      return modelPreference.find(model => available.has(model)) ?? data[0]?.id;
    }).catch(() => undefined);
  }
  return modelPromise;
}

export async function generateDailyBriefing(userId: number, briefingDate: string, calendarEvents: CalendarEvent[]) {
  const tasks = await listPendingTasks(userId);
  const taskContext = tasks.map(task => ({
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    notes: task.notes ?? null,
  }));
  const eventContext = calendarEvents.slice(0, 30).map(event => ({
    title: event.title,
    start: event.start ?? null,
    end: event.end ?? null,
    location: event.location ?? null,
    allDay: Boolean(event.allDay),
  }));
  const model = await getBriefingModel();
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: "You are AVA, a practical personal chief of staff. Write a compact morning briefing in markdown. Include: a warm one-line opening, a section called Focus today with the 1-3 highest-impact pending tasks, a section called Schedule with calendar events in chronological order, and a section called Watch-outs for conflicts, overdue work, or missing information. Do not invent events or deadlines. If a section has no items, say so plainly. Keep the full briefing under 450 words.",
      },
      {
        role: "user",
        content: JSON.stringify({ briefingDate, pendingTasks: taskContext, calendarEvents: eventContext }),
      },
    ],
    ...(model?.startsWith("gpt-") ? { reasoning: { effort: "minimal" } } : {}),
    maxTokens: 700,
  });
  const content = typeof response.choices[0]?.message.content === "string"
    ? response.choices[0].message.content
    : "Good morning. Your briefing is ready, but AVA could not format the latest context.";
  return saveBriefing({
    userId,
    briefingDate,
    content,
    taskCount: tasks.length,
    eventCount: calendarEvents.length,
  });
}
