import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const EMOJIS = ["⭐", "🌈", "🦖", "🚀", "🎈", "🧁", "🐻", "🌞", "🍦", "🎂", "🚲", "🏖️", "🎪", "🌲", "🐸", "🦄"];

interface Props {
  forPlaceName?: string;
  onCreate: (name: string, emoji: string) => void;
  onClose: () => void;
}

export function NewListDialog({ forPlaceName, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) onCreate(n.slice(0, 40), emoji);
  };

  return (
    <div className="scrim fixed inset-0 z-[2000] grid place-items-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mission relative w-full max-w-sm p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="newlist-title"
      >
        <button type="button" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-parchment" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 id="newlist-title" className="text-2xl font-semibold text-ink">
          New list
        </h2>
        {forPlaceName && <p className="mt-1 text-sm text-ink-soft">{forPlaceName} will be added to it.</p>}

        <label htmlFor="newlist-name" className="eyebrow mt-4 block">
          Name
        </label>
        <input
          id="newlist-name"
          ref={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rainy Sunday ideas"
          maxLength={40}
          className="search mt-1 w-full px-3 py-2 outline-none"
        />

        <p className="eyebrow mt-4">Pin emoji</p>
        <div className="mt-2 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Pin emoji">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={`grid aspect-square place-items-center rounded-xl text-xl ${emoji === e ? "bg-honey-soft ring-2 ring-ink" : "bg-parchment hover:bg-parchment-deep"}`}
            >
              {e}
            </button>
          ))}
        </div>

        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={!name.trim()}>
          {emoji} Create list
        </button>
      </form>
    </div>
  );
}
