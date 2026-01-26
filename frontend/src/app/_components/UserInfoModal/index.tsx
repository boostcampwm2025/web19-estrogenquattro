"use client";

import { useUserInfoStore } from "@/stores/userInfoStore";
import { usePointStore } from "@/stores/pointStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useCallback, useState } from "react";
import ProfileTab from "./tabs/ProfileTab/ProfileTab";
import ActivityTab from "./tabs/ActivityTab";
import PetTab from "./tabs/PetTab/PetTab";

// Pixel Art Style Constants
const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";
const PIXEL_BTN_ACTIVE = "bg-amber-600 text-white";
const PIXEL_BTN_INACTIVE = "bg-amber-200 text-amber-900 hover:bg-amber-300";

type TabType = "profile" | "activity" | "pet";

export default function UserInfoModal() {
  const { isOpen, targetUsername, closeModal } = useUserInfoStore();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const points = usePointStore((state) => state.points);

  const onClose = useCallback(() => {
    closeModal();
    setActiveTab("profile");
  }, [closeModal]);

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        className={`relative w-full max-w-4xl ${PIXEL_BG} ${PIXEL_BORDER} p-3 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex gap-2">
            <h2 className="text-xl font-extrabold tracking-wider text-amber-900">
              {targetUsername}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded border-2 border-amber-900/20 bg-amber-100 px-3 py-1 font-bold text-amber-800">
              <span>{points.toLocaleString()} P</span>
            </div>
            <button
              onClick={handleClose}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
            >
              X
            </button>
          </div>
        </div>

        <div className="mb-0 flex gap-1">
          <TabButton
            label="프로필"
            isActive={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
          <TabButton
            label="활동"
            isActive={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
          />
          <TabButton
            label="펫"
            isActive={activeTab === "pet"}
            onClick={() => setActiveTab("pet")}
          />
        </div>

        <div
          className={`my-2 bg-white/50 p-4 ${PIXEL_BORDER} retro-scrollbar h-[500px] overflow-y-auto`}
        >
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "activity" && <ActivityTab />}
          {activeTab === "pet" && <PetTab />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 cursor-pointer py-2 text-sm font-bold transition-all ${PIXEL_BORDER} ${isActive ? PIXEL_BTN_ACTIVE : PIXEL_BTN_INACTIVE} ${isActive && "hover:brightness-110"}`}
    >
      {label}
    </button>
  );
}
