import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { BarChart3, MessageSquareText, RotateCcw, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const TOOL_TITLES: Record<string, string> = {
  "tool-taskReport": "Checked task reports",
  "tool-vehicleReport": "Checked vehicles",
};

export function CrmAssistant({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { toast } = useToast();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-chat`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${data.session?.access_token ?? ""}`,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport,
    onError: (e) =>
      toast({ variant: "destructive", title: "Assistant error", description: e.message }),
  });

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  const busy = status === "submitted" || status === "streaming";
  const send = (t: string) => {
    if (!t.trim() || busy) return;
    sendMessage({ text: t.trim() });
    setText("");
  };

  const suggestions = [
    "How many tasks are pending this month by vendor?",
    "Show engineer-wise closed tasks for last month",
    "List tasks pending for more than 10 days",
    ...(isAdmin ? ["Which vehicles have documents expiring in the next 30 days?"] : []),
  ];

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 rounded-full shadow-lg gap-2 px-5"
        aria-label="Open SmartCore assistant"
      >
        <MessageSquareText className="h-5 w-5" />
        <span className="hidden sm:inline">Ask SmartCore</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b p-4 pr-12">
            <img src={logo} alt="" className="h-8 w-8" />
            <SheetTitle className="flex-1 text-left">SmartCore Assistant</SheetTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  stop();
                  setMessages([]);
                }}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" /> New chat
              </Button>
            )}
          </SheetHeader>

          <Conversation className="flex-1 min-h-0">
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<img src={logo} alt="" className="h-12 w-12" />}
                  title="Ask about your tasks & reports"
                  description="Counts, pending work, engineer or vendor summaries — in English or Malayalam."
                >
                  <div className="mt-2 flex w-full flex-col gap-2">
                    {suggestions.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        className="h-auto justify-start whitespace-normal py-2 text-left text-sm"
                        onClick={() => send(s)}
                      >
                        {s.includes("vehicle") ? (
                          <Truck className="mr-2 h-4 w-4 shrink-0" />
                        ) : (
                          <BarChart3 className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        {s}
                      </Button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((m) => (
                  <Message key={m.id} from={m.role}>
                    <MessageContent>
                      {m.parts.map((p, i) => {
                        if (p.type === "text")
                          return <MessageResponse key={i}>{p.text}</MessageResponse>;
                        if (p.type.startsWith("tool-")) {
                          const tp = p as ToolUIPart;
                          return (
                            <Tool key={i} defaultOpen={false}>
                              <ToolHeader
                                type={tp.type}
                                state={tp.state}
                                title={TOOL_TITLES[tp.type] ?? "Looked up data"}
                              />
                              <ToolContent>
                                <ToolInput input={tp.input} />
                                <ToolOutput output={tp.output} errorText={tp.errorText} />
                              </ToolContent>
                            </Tool>
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))
              )}
              {status === "submitted" && (
                <Shimmer className="text-sm">Looking at your data...</Shimmer>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t p-3">
            <PromptInput onSubmit={(msg) => send(msg.text)}>
              <PromptInputTextarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Total amount for DELL this month"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
