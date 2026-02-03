"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Music, ListTodo } from "lucide-react";
import MusicPlayerContent from "../MusicPlayer/MusicPlayerContent";
import TasksMenuContent from "../TasksMenu/TasksMenuContent";

const TABS = {
  TASKS: "tasks",
  MUSIC: "music",
} as const;

type Tab = (typeof TABS)[keyof typeof TABS];

export default function FocusPanel() {
  const [activeTab, setActiveTab] = useState<Tab>(TABS.TASKS);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastRunTaskId, setLastRunTaskId] = useState<number | null>(null);

  return (
    <div id="focus-panel" className="w-80">
      <div className="border-3 border-amber-900 bg-[#ffecb3] p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
        {/* 탭 헤더 */}
        <div
          className={`flex items-center select-none ${
            isExpanded ? "mb-4" : "mb-0"
          }`}
        >
          {/* 탭 버튼들 */}
          <div className="flex flex-1 gap-1">
            <button
              onClick={() => setActiveTab(TABS.TASKS)}
              className={`text-md flex flex-1 cursor-pointer items-center justify-center gap-1 border-2 border-amber-900 px-4 py-1 font-bold transition-colors ${
                activeTab === TABS.TASKS
                  ? "bg-amber-900 text-[#ffecb3]"
                  : "bg-transparent text-amber-900 hover:bg-amber-100"
              }`}
            >
              <ListTodo className="h-4 w-4" />
              Tasks
            </button>
            <button
              onClick={() => setActiveTab(TABS.MUSIC)}
              className={`text-md flex flex-1 cursor-pointer items-center justify-center gap-1 border-2 border-amber-900 px-4 py-1 font-bold transition-colors ${
                activeTab === TABS.MUSIC
                  ? "bg-amber-900 text-[#ffecb3]"
                  : "bg-transparent text-amber-900 hover:bg-amber-100"
              }`}
            >
              <Music className="h-4 w-4" />
              Music
            </button>
          </div>
        </div>

        {/* 콘텐츠 영역 - 각 컴포넌트가 isExpanded에 따라 자체적으로 full/mini 표시 */}
        <div>
          {/* Music 콘텐츠 - 항상 마운트, activeTab으로 표시/숨김 */}
          <div className={activeTab === TABS.MUSIC ? "block" : "hidden"}>
            <MusicPlayerContent isExpanded={isExpanded} />
          </div>

          {/* Tasks 콘텐츠 - 항상 마운트, activeTab으로 표시/숨김 */}
          <div className={activeTab === TABS.TASKS ? "block" : "hidden"}>
            <TasksMenuContent
              isExpanded={isExpanded}
              lastRunTaskId={lastRunTaskId}
              setLastRunTaskId={setLastRunTaskId}
            />
          </div>
        </div>

        {/* 접기/펼치기 버튼 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex w-full cursor-pointer items-center justify-center rounded border-2 border-amber-900 bg-transparent py-1 text-amber-900 transition-colors hover:bg-amber-100"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
