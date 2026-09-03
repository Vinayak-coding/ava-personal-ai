import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Command,
  Inbox,
  LayoutList,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  Target,
  UserRound,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const initialMessages: Message[] = [
  {
    role: "system",
    content: "You are AVA, a concise personal AI command center.",
  },
];

const suggestedPrompts = [
  "Plan my highest-impact work for today",
  "Turn this idea into a clear action plan",
  "Add a task to review my weekly priorities",
];

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function priorityTone(priority: string) {
  if (priority === "high") return "text-rose-600 bg-rose-50 border-rose-100";
  if (priority === "low") return "text-slate-500 bg-slate-50 border-slate-100";
  return "text-amber-700 bg-amber-50 border-amber-100";
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const conversationsQuery = trpc.ava.listConversations.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const conversationQuery = trpc.ava.getConversation.useQuery(
    { id: conversationId ?? 0 },
    { enabled: Boolean(isAuthenticated && conversationId), refetchOnWindowFocus: false }
  );
  const tasksQuery = trpc.ava.listTasks.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const briefingsQuery = trpc.ava.listBriefings.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const chatMutation = trpc.ava.chat.useMutation();
  const updateTaskMutation = trpc.ava.updateTaskStatus.useMutation({
    onSuccess: () => tasksQuery.refetch(),
  });

  useEffect(() => {
    const savedMessages = conversationQuery.data?.messages;
    if (!savedMessages) return;
    setMessages([
      ...initialMessages,
      ...savedMessages.map(message => ({
        role: message.role,
        content: message.content,
      } as Message)),
    ]);
  }, [conversationQuery.data]);

  const activeTasks = useMemo(
    () => (tasksQuery.data ?? []).filter(task => task.status !== "done"),
    [tasksQuery.data]
  );
  const completedTasks = useMemo(
    () => (tasksQuery.data ?? []).filter(task => task.status === "done").length,
    [tasksQuery.data]
  );

  const handleNewConversation = () => {
    setConversationId(undefined);
    setMessages(initialMessages);
  };

  const handleSend = async (content: string) => {
    const previousMessages = messages;
    const history = messages
      .filter(message => message.role !== "system")
      .map(message => ({ role: message.role as "user" | "assistant", content: message.content }));
    setMessages([...messages, { role: "user", content }]);
    try {
      const response = await chatMutation.mutateAsync({
        conversationId,
        input: content,
        messages: history,
      });
      setConversationId(response.conversationId);
      setMessages(current => [...current, { role: "assistant", content: response.content }]);
      await Promise.all([conversationsQuery.refetch(), tasksQuery.refetch()]);
    } catch {
      setMessages(previousMessages);
    }
  };

  const cycleTask = (task: NonNullable<typeof tasksQuery.data>[number]) => {
    const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    updateTaskMutation.mutate({ id: task.id, status: nextStatus });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#635bff]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#f6f7f9] text-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(99,91,255,0.15),transparent_34%),radial-gradient(circle_at_10%_80%,rgba(20,184,166,0.12),transparent_30%)]" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-[-0.03em]">AVA</span>
            <span className="hidden border-l border-slate-300 pl-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 sm:inline">Personal AI</span>
          </div>
          <Button variant="outline" onClick={() => startLogin()} className="border-slate-300 bg-white/60 text-slate-700 hover:bg-white">Sign in</Button>
        </header>
        <main className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28 lg:pt-24">
          <section>
            <Badge className="mb-7 gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50"><Zap className="h-3.5 w-3.5" /> Fast by design</Badge>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-slate-950 sm:text-7xl">Your work, <span className="text-[#635bff]">in motion.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-500">AVA turns scattered thoughts into clear next steps, remembers what matters, and helps you move from intention to action in seconds.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => startLogin()} size="lg" className="h-12 rounded-xl bg-slate-950 px-6 text-white shadow-xl shadow-slate-950/15 hover:bg-slate-800">Launch AVA <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
              <div className="flex items-center gap-2 px-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-teal-500" /> Private workspace · built for focus</div>
            </div>
            <div className="mt-16 grid max-w-xl grid-cols-3 gap-6 border-t border-slate-200 pt-6">
              <div><div className="text-2xl font-semibold tracking-tight">01</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Think</div></div>
              <div><div className="text-2xl font-semibold tracking-tight">02</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Decide</div></div>
              <div><div className="text-2xl font-semibold tracking-tight">03</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Do</div></div>
            </div>
          </section>
          <section className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-indigo-300/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-white/80 p-3 shadow-2xl shadow-indigo-900/10 backdrop-blur-xl">
              <div className="rounded-[1.35rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-teal-400" /> AVA is ready</div><Command className="h-4 w-4 text-slate-500" /></div>
                <div className="mt-12 max-w-sm"><p className="text-2xl font-medium leading-tight tracking-[-0.04em]">What would make today feel meaningful?</p><p className="mt-4 text-sm leading-6 text-slate-400">Start with a thought. I’ll help you find the signal, shape the plan, and keep the momentum.</p></div>
                <div className="mt-12 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Plan my day around the work that matters most <ArrowUpRight className="float-right h-4 w-4 text-teal-300" /></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f6f7f9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Sparkles className="h-4 w-4" /></div><div><div className="font-semibold tracking-[-0.03em]">AVA</div><div className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">Personal command center</div></div></div>
          <div className="hidden items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Fast model online</div>
          <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><div className="text-sm font-medium">{user?.name || "My workspace"}</div><div className="text-xs text-slate-400">Focused mode</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"><UserRound className="h-4 w-4" /></div><Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Sign out" className="text-slate-400 hover:bg-white hover:text-slate-700"><LogOut className="h-4 w-4" /></Button></div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[235px_minmax(0,1fr)_300px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="flex items-center justify-between px-2"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</div><Button variant="ghost" size="icon" onClick={handleNewConversation} className="h-7 w-7 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="New conversation"><Plus className="h-4 w-4" /></Button></div>
          <nav className="mt-3 space-y-1">
            <button className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 shadow-sm shadow-slate-900/5"><Inbox className="h-4 w-4 text-[#635bff]" /> Conversations <span className="ml-auto text-xs text-slate-400">{conversationsQuery.data?.length ?? 0}</span></button>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 transition-colors hover:bg-white hover:text-slate-900"><Target className="h-4 w-4" /> Focus mode <ChevronRight className="ml-auto h-3.5 w-3.5" /></button>
          </nav>
          <div className="mt-9 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recent threads</div>
          <div className="mt-3 space-y-1">
            {(conversationsQuery.data ?? []).slice(0, 8).map(conversation => <button key={conversation.id} onClick={() => setConversationId(conversation.id)} className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${conversationId === conversation.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conversationId === conversation.id ? "bg-[#635bff]" : "bg-slate-300"}`} /><span className="truncate">{conversation.title}</span></button>)}
            {!conversationsQuery.data?.length && <p className="px-2 text-sm leading-6 text-slate-400">Your conversations will appear here.</p>}
          </div>
          <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-indigo-700"><Zap className="h-3.5 w-3.5" /> Pro tip</div><p className="mt-2 text-xs leading-5 text-indigo-900/60">Ask AVA to add a task whenever an idea becomes actionable.</p></div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between px-1"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#635bff]"><span className="h-1.5 w-1.5 rounded-full bg-[#635bff]" /> Live session</div><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1></div><Button variant="outline" onClick={handleNewConversation} className="hidden h-9 gap-2 border-slate-200 bg-white text-xs text-slate-600 shadow-sm sm:flex"><Plus className="h-3.5 w-3.5" /> New thread</Button></div>
          {briefingsQuery.data?.[0] && <div className="mb-4 rounded-[1.2rem] border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm shadow-indigo-900/5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700"><Sparkles className="h-3.5 w-3.5" /> Morning briefing</div><span className="text-[11px] text-indigo-500">{formatDate(briefingsQuery.data[0].createdAt)}</span></div><div className="mt-2 max-h-44 overflow-y-auto text-sm leading-6 text-indigo-950/75"><Streamdown>{briefingsQuery.data[0].content}</Streamdown></div></div>}
          <div className="rounded-[1.4rem] border border-slate-200/80 bg-white p-2 shadow-[0_16px_50px_-30px_rgba(15,23,42,0.35)] sm:p-3"><AIChatBox messages={messages} onSendMessage={handleSend} isLoading={chatMutation.isPending} height="calc(100vh - 180px)" className="border-0 shadow-none" emptyStateMessage="Start with a thought, a decision, or a task." suggestedPrompts={suggestedPrompts} placeholder="Ask AVA anything…" /></div>
        </section>

        <aside className="min-w-0">
          <div className="mb-4 flex items-end justify-between px-1"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Momentum</div><h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Task runway</h2></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><LayoutList className="h-4 w-4" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-200/80 bg-white p-3.5"><div className="text-2xl font-semibold tracking-tight">{activeTasks.length}</div><div className="mt-1 text-xs text-slate-400">Open tasks</div></div><div className="rounded-2xl border border-slate-200/80 bg-white p-3.5"><div className="text-2xl font-semibold tracking-tight text-teal-600">{completedTasks}</div><div className="mt-1 text-xs text-slate-400">Completed</div></div></div>
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold">Your next moves</div><Clock3 className="h-4 w-4 text-slate-300" /></div><div className="mt-3 space-y-2">
            {tasksQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            {!tasksQuery.isLoading && activeTasks.length === 0 && <div className="rounded-xl bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-400">No open tasks yet. Tell AVA what you want to remember.</div>}
            {activeTasks.slice(0, 6).map(task => <button key={task.id} onClick={() => cycleTask(task)} className="group flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-slate-50"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${task.status === "in_progress" ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white"}`}>{task.status === "in_progress" && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}</span><span className="min-w-0 flex-1"><span className="block text-sm leading-5 text-slate-700">{task.title}</span><span className="mt-1 flex items-center gap-2 text-[11px] text-slate-400"><span className={`rounded-md border px-1.5 py-0.5 capitalize ${priorityTone(task.priority)}`}>{task.priority}</span>{task.dueAt && <span>{formatDate(task.dueAt)}</span>}</span></span></button>)}
          </div></div>
          <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex items-center justify-between"><div className="text-sm font-medium">Fast lane</div><Zap className="h-4 w-4 text-teal-300" /></div><p className="mt-2 text-xs leading-5 text-slate-400">AVA uses a lightweight model path for everyday work and keeps your context close.</p><div className="mt-4 flex items-center gap-2 text-[11px] text-teal-300"><Check className="h-3.5 w-3.5" /> Ready for your next move</div></div>
        </aside>
      </main>
      <div className="fixed bottom-4 left-4 lg:hidden"><Button onClick={handleNewConversation} size="icon" className="h-11 w-11 rounded-full bg-slate-950 shadow-xl" aria-label="New conversation"><Menu className="h-4 w-4" /></Button></div>
    </div>
  );
}
