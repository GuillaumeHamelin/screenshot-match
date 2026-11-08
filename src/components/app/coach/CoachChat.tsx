import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { CoachAvatar } from "@/components/app/coach/CoachAvatar";
import { MealPlanCard, ProgramPlanCard } from "@/components/app/coach/PlanCards";
import { supabase } from "@/integrations/supabase/client";
import type { MealPlanOutput, ProgramPlanOutput } from "@/lib/coach";
import { invalidateCoach } from "@/lib/coach-actions";
import { toISODate } from "@/lib/fitness";

const TOOL_TITLES: Record<string, string> = {
  search_foods: "Recherche d'aliments",
  propose_meal_plan: "Calcul des repas",
  propose_program: "Création du programme",
  save_other_sports: "Mise à jour du profil",
};

export const COACH_STARTERS = [
  "Fais-moi un programme adapté à mon objectif et à mes autres sports.",
  "Que manger aujourd'hui pour atteindre mon quota ?",
  "Je n'ai pas faim, aide-moi à manger assez sans me forcer.",
  "Comment progresser plus vite sur mes charges ?",
];

export function CoachChat({
  threadId,
  initialMessages,
  autoSend,
  onAutoSent,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  autoSend?: string;
  onAutoSent?: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentAuto = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/coach",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
        body: () => ({ threadId, today: toISODate() }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      invalidateCoach(qc);
      qc.invalidateQueries({ queryKey: ["coach-messages", threadId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => invalidateCoach(qc),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status, threadId]);

  useEffect(() => {
    if (!autoSend || sentAuto.current || messages.length > 0) return;
    sentAuto.current = true;
    sendMessage({ text: autoSend });
    onAutoSent?.();
  }, [autoSend, messages.length, sendMessage, onAutoSent]);

  function send(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    sendMessage({ text: v });
    setText("");
    queueMicrotask(() => invalidateCoach(qc));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-1 py-4">
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CoachAvatar className="h-16 w-16 rounded-xl" />
              <div>
                <p className="font-display text-2xl font-bold uppercase">Ton coach</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Il connaît ton profil, tes séances et ce que tu as mangé aujourd'hui. Demande-lui un programme, un menu ou un conseil.
                </p>
              </div>
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {COACH_STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              {m.role === "assistant" && <CoachAvatar className="h-7 w-7" />}
              <MessageContent className="w-full">
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                    );
                  }
                  if (isToolUIPart(part)) {
                    const name = part.type.replace(/^tool-/, "");
                    if (part.state === "output-available" && name === "propose_meal_plan") {
                      return <MealPlanCard key={i} plan={part.output as MealPlanOutput} />;
                    }
                    if (part.state === "output-available" && name === "propose_program") {
                      return <ProgramPlanCard key={i} plan={part.output as ProgramPlanOutput} />;
                    }
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={part.type as `tool-${string}`} state={part.state} title={TOOL_TITLES[name] ?? name} />
                        <ToolContent>
                          <ToolInput input={part.input} />
                          <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.state === "output-error" ? part.errorText : undefined} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <CoachAvatar className="h-7 w-7" />
              <MessageContent>
                <Shimmer>Le coach réfléchit…</Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message || "Le coach n'a pas pu répondre. Réessaie."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl pt-2">
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <PromptInputTextarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écris à ton coach…"
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Le coach peut se tromper. Il ne remplace pas un médecin ou un diététicien.</p>
      </div>
    </div>
  );
}
