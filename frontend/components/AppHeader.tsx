import { Menu, Trash2 } from "lucide-react";

interface AppHeaderProps {
  onClear: () => void;
  clearDisabled: boolean;
  title: string;
  onOpenSidebar: () => void;
}

export function AppHeader({ onClear, clearDisabled, title, onOpenSidebar }: AppHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
      <button onClick={onOpenSidebar} className="icon-button lg:hidden" aria-label="開啟對話列表"><Menu size={20} /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-zinc-950">{title}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">從現有食材，聊出今天的菜單</p>
      </div>
      <button type="button" onClick={onClear} disabled={clearDisabled} className="secondary-button">
        <Trash2 size={15} />清空對話
      </button>
    </header>
  );
}
