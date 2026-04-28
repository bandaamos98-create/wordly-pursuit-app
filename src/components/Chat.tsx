import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfilePic } from "@/components/ProfilePic";

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

  const profiles = useProfiles(messages.map((m) => m.user_id));

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="space-y-3 pb-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Say hi! 👋</p>
          ) : (
            messages.map((item) => {
              const mine = item.user_id === userId;
              const p = profiles[item.user_id];
              return (
                <div key={item.id} className={`flex gap-2 items-end ${mine ? "flex-row-reverse" : ""}`}>
                  <ProfilePic url={p?.avatar_url} name={p?.display_name || (mine ? "You" : "?")} size="sm" />
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
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