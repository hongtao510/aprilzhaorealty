"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Message } from "@/lib/types";

interface MessageThreadProps {
  clientId: string;
  apiBase: string; // "/api/admin/messages" or "/api/portal/messages"
}

export default function MessageThread({ clientId, apiBase }: MessageThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchMessages() {
    try {
      const res = await fetch(`${apiBase}?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, content: newMessage }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
      }
    } catch {
      // handle error
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-400 text-sm">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-neutral-50 border border-neutral-200">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-400 text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] p-3 ${
                    isOwn
                      ? "bg-[#d4a012] text-white"
                      : "bg-white border border-neutral-200 text-neutral-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isOwn ? "text-white/70" : "text-neutral-400"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 p-3 border border-t-0 border-neutral-200 bg-white">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 text-sm border border-neutral-200 focus:outline-none focus:border-[#d4a012] transition-colors"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="px-6 py-2 bg-[#d4a012] text-white text-xs uppercase tracking-wider hover:bg-[#b8890f] transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
