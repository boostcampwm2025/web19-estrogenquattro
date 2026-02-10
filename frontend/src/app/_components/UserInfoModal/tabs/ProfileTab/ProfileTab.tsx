"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/_components/ui/button";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";
import { useGithubUser, useFollowStatus } from "@/lib/api/hooks/useGithub";
import { useFollowMutation } from "@/lib/api/hooks/useFollowMutation";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

export default function ProfileTab() {
  const { t } = useTranslation("ui");
  const { targetUsername, targetPlayerId } = useModalStore(
    useShallow((state) => ({
      targetUsername: state.userInfoPayload?.username,
      targetPlayerId: state.userInfoPayload?.playerId,
    })),
  );

  const { user, logout } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      logout: state.logout,
    })),
  );

  const isOwnProfile = !targetPlayerId || targetPlayerId === user?.playerId;
  const username = targetUsername ?? user?.username ?? "";

  const { user: githubUser } = useGithubUser(username);
  const { isFollowing, isLoading: isLoadingFollowStatus } = useFollowStatus(
    !isOwnProfile ? username : "",
  );
  const { handleFollowToggle, isSubmitting } = useFollowMutation(username);

  const profileData = {
    avatarUrl:
      githubUser?.avatar_url ??
      user?.avatarUrl ??
      "https://avatars.githubusercontent.com/u/0?v=4",
    githubUsername: githubUser?.login ?? username ?? "Unknown",
    followers: githubUser?.followers ?? 0,
    following: githubUser?.following ?? 0,
  };

  return (
    <div className="space-y-6 px-4 pt-20 pb-4">
      {/* 프로필 헤더 */}
      <div className="flex flex-col items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
          <img
            src={profileData.avatarUrl}
            alt={t("userInfoModal.profile.avatarAlt", {
              username: profileData.githubUsername,
            })}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex items-center justify-center">
          <a
            href={`https://github.com/${profileData.githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative cursor-pointer text-lg font-bold text-amber-900 transition-colors hover:text-amber-700"
          >
            {profileData.githubUsername}
            <span className="absolute top-1/2 right-0 translate-x-[calc(100%+8px)] -translate-y-1/2">
              <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        </div>
      </div>

      {/* 팔로워/팔로잉 */}
      <div className="flex justify-center gap-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-900">
            {profileData.followers}
          </div>
          <div className="text-sm text-amber-700">
            {t("userInfoModal.profile.followers")}
          </div>
        </div>
        <div className="h-12 w-px bg-amber-900/20" />
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-900">
            {profileData.following}
          </div>
          <div className="text-sm text-amber-700">
            {t("userInfoModal.profile.following")}
          </div>
        </div>
      </div>

      {/* 팔로우 버튼 */}
      {!isOwnProfile && (
        <div className="flex justify-center">
          <Button
            onClick={() => handleFollowToggle(isFollowing)}
            disabled={isLoadingFollowStatus || isSubmitting}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-none border-2 py-2 font-bold transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${
              isFollowing
                ? "border-red-700 bg-red-600 text-white shadow-[4px_4px_0px_0px_#7f1d1d] hover:bg-red-700"
                : "border-amber-900 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] hover:bg-amber-800"
            }`}
          >
            {isLoadingFollowStatus || isSubmitting
              ? "..."
              : isFollowing
                ? t("userInfoModal.profile.unfollow")
                : t("userInfoModal.profile.follow")}
          </Button>
        </div>
      )}

      {/* 로그아웃 버튼 */}
      {isOwnProfile && (
        <div className="flex justify-center">
          <Button
            onClick={logout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-none border-2 border-red-700 bg-red-600 py-2 font-bold text-white shadow-[4px_4px_0px_0px_#7f1d1d] transition-all hover:bg-red-700 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <LogOut className="h-4 w-4" />
            {t("userInfoModal.profile.logout")}
          </Button>
        </div>
      )}
    </div>
  );
}
