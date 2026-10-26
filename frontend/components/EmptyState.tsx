import { ChefHat, Clock3, Leaf, Refrigerator } from "lucide-react";


interface EmptyStateProps {
  onPrompt: (prompt: string) => void;
  disabled?: boolean;
}


const prompts = [
  {
    icon: Clock3,
    title: "15 分鐘快手菜",
    prompt: "我有雞蛋和番茄，請推薦一道 15 分鐘內能完成的家常菜。",
  },
  {
    icon: Leaf,
    title: "清淡少油",
    prompt: "請推薦一道清淡、少油、步驟簡單的菜。",
  },
  {
    icon: Refrigerator,
    title: "利用現有食材",
    prompt: "我有豆腐、菇類和青菜，今天可以做什麼？",
  },
];


export function EmptyState({ onPrompt, disabled = false }: EmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-600 text-white">
        <ChefHat size={22} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-zinc-950">
        看看今天能做什麼
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
        告訴我現有食材或想吃的菜，一起安排今天的菜單。
      </p>

      <div className="mt-7 grid gap-2 sm:grid-cols-3">
        {prompts.map(({ icon: PromptIcon, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onPrompt(prompt)}
            disabled={disabled}
            className="flex min-h-20 items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PromptIcon size={17} className="mt-0.5 shrink-0 text-orange-700" />
            <span className="text-sm font-medium text-zinc-800">{title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
