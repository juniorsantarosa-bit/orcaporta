import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "otimizacao", label: "Otimização" },
  { id: "visualizacao", label: "Visualização" },
  { id: "relatorios", label: "Relatórios" },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center bg-card border-b border-border h-10">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 border-r border-border h-full">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-sm font-extrabold tracking-tight text-foreground">
          MAX<span className="text-primary">CUT</span>
        </span>
      </div>

      {/* Tabs */}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-5 h-full text-xs font-medium transition-all relative",
            activeTab === tab.id
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      ))}

      <div className="flex-1" />
      <div className="px-4 text-[10px] text-muted-foreground">
        v1.0
      </div>
    </div>
  );
}