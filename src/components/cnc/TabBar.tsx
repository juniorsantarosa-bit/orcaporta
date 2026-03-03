import { cn } from "@/lib/utils";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "smartcut", label: "Smart CUT" },
  { id: "otimizacao", label: "Otimização" },
  { id: "visualizacao", label: "Visualização" },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center bg-card border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-4 py-2 text-xs font-semibold border-r border-border transition-colors",
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
      <div className="flex-1 px-4 py-2 text-center">
        <span className="text-xs font-semibold text-foreground/60">Smart CUT - Otimizador CNC</span>
      </div>
    </div>
  );
}
