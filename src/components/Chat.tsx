import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMessage = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
};

export function Chat({ gameId, userId }: { gameId: string; userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`game-chat-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `game_id=eq.${gameId}` }, () => loadMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function loadMessages() {
    const { data } = await supabase
      .from("chat_messages")
      .select("id,user_id,message,created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data ?? []) as ChatMessage[]);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    await supabase.from("chat_messages").insert({ game_id: gameId, user_id: userId, message: text });
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="space-y-3 pb-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((item) => {
              const mine = item.user_id === userId;
              return (
                <div key={item.id} className={mine ? "text-right" : "text-left"}>
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {mine ? "You" : "Opponent"}
                  </div>
                  <div className={`inline-block max-w-[82%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {item.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border pt-3">
        <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message" maxLength={240} />
        <Button type="submit" size="icon" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}