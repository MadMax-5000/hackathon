import { useRef, useState } from "react";
import { askAnalyst, type AnalystSource, type InsightsSnapshot } from "../../insights/ai/analyst.ts";
import { Icon } from "../Icon";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  source?: AnalystSource;
};

const SUGGESTIONS = [
  "What is causing the most delays?",
  "Which cases are most at risk?",
  "What patterns do you see?",
  "Which factor has the strongest relationship with delays?",
  "Explain the biggest anomaly.",
  "What should the coordinator investigate first?",
  "Compare complete vs incomplete inspections.",
];

export function InsightsChat({ snapshot }: { snapshot: InsightsSnapshot }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const counter = useRef(0);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const history = messages.map((message) => ({ role: message.role, content: message.text }));
    counter.current += 1;
    setMessages((current) => [...current, { id: counter.current, role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    const result = await askAnalyst({ question: trimmed, snapshot, history });

    counter.current += 1;
    setMessages((current) => [
      ...current,
      { id: counter.current, role: "assistant", text: result.text, source: result.source },
    ]);
    setLoading(false);
  }

  return (
    <section className="insights-chat" aria-label="Ask Insights AI">
      <header className="insights-chat-head">
        <h3>
          <Icon name="sparkle" size={18} />
          Ask Insights AI
        </h3>
        <span className="model-tag">grounded in the computed synthetic analytics</span>
      </header>

      <div className="insights-chat-thread">
        {messages.length === 0 ? (
          <p className="insights-chat-empty">
            Ask about the synthetic historical dataset and the models trained on it. Answers use
            only computed analytics and will say when a question is outside the data.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}
            >
              {message.text}
              {message.role === "assistant" && message.source === "local" ? (
                <span className="chat-offline">offline answer</span>
              ) : null}
            </div>
          ))
        )}
        {loading ? <div className="chat-bubble is-assistant chat-typing">Thinking…</div> : null}
      </div>

      <div className="insights-chat-chips">
        {SUGGESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            className="chat-chip"
            onClick={() => ask(question)}
            disabled={loading}
          >
            {question}
          </button>
        ))}
      </div>

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
          placeholder="Ask about the synthetic analytics…"
          aria-label="Ask Insights AI"
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || loading}>
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}
