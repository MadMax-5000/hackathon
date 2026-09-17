import { useEffect, useRef, useState } from "react";
import type { DerivedCase } from "../engine/types";
import { suggestedQuestions } from "../copilot/answers";
import { askCopilot, type CopilotSource } from "../copilot/client";
import { Icon } from "./Icon";

type Props = {
  item: DerivedCase;
  rules: string[];
};

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  source?: CopilotSource;
};

export function CopilotBubble({ item, rules }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const counter = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  function resetThread() {
    setMessages([]);
    setInput("");
    setLoading(false);
  }

  useEffect(() => {
    resetThread();
  }, [item.wheel.id]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const history = messages.map((message) => ({ role: message.role, content: message.text }));
    counter.current += 1;
    const userEntry: Message = { id: counter.current, role: "user", text: trimmed };
    setMessages((current) => [...current, userEntry]);
    setInput("");
    setLoading(true);

    const result = await askCopilot({ question: trimmed, item, rules, history });

    counter.current += 1;
    setMessages((current) => [
      ...current,
      { id: counter.current, role: "assistant", text: result.text, source: result.source },
    ]);
    setLoading(false);
  }

  const suggestions = suggestedQuestions(item).slice(0, 3);
  const showSuggestions = messages.length === 0 && !loading;

  return (
    <div className="chat" ref={root}>
      {open ? (
        <section className="chat-pop" aria-label="AI assistant">
          <header className="chat-head">
            <h3>
              <Icon name="sparkle" size={18} />
              Coordinator Copilot
            </h3>
            <div className="chat-head-actions">
              <span className="chat-tag">AI</span>
              <button
                type="button"
                className="chat-close"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          </header>

          <p className="chat-note">
            Synthetic data. Answers use only this case and the supplied rules.
          </p>

          <div className="chat-thread">
            {messages.length === 0 ? (
              <p className="chat-empty">
                Hi — ask me about {item.wheel.id}. I can explain proposals, evidence, and what is missing.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}
                >
                  {message.text}
                  {message.source === "local" ? (
                    <span className="chat-offline">offline answer</span>
                  ) : null}
                </div>
              ))
            )}
            {loading ? <div className="chat-bubble is-assistant chat-typing">Thinking…</div> : null}
          </div>

          {showSuggestions ? (
            <div className="chat-chips">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="chat-chip"
                  onClick={() => ask(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this case…"
              aria-label="Ask the assistant about this case"
            />
            <button type="submit" className="btn btn-primary" disabled={!input.trim() || loading}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={`chat-fab ${open ? "is-open" : ""}`}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "x" : "sparkle"} size={26} />
      </button>
    </div>
  );
}
