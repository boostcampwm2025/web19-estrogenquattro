"use client";

import Toast from "@/app/_components/Toast";
import { useBanManagement } from "./useBanManagement";

export default function BanManagementPage() {
  const {
    players,
    search,
    setSearch,
    isLoading,
    confirmTarget,
    setConfirmTarget,
    reason,
    setReason,
    isProcessing,
    toast,
    setToast,
    closeConfirm,
    executeAction,
  } = useBanManagement();

  return (
    <div>
      <h2 className="text-retro-text-primary mb-6 text-xl font-bold">
        유저 밴 관리
      </h2>

      {/* 검색 */}
      <div className="mb-4 max-w-md">
        <label htmlFor="ban-search" className="sr-only">
          닉네임으로 검색
        </label>
        <input
          id="ban-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="닉네임으로 검색"
          className="border-retro-border-darker text-retro-text-primary w-full border-3 bg-white px-3 py-2 outline-none"
        />
      </div>

      {/* 유저 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-retro-border-dark h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      ) : players.length === 0 ? (
        <p className="text-retro-text-secondary py-8 text-center">
          검색 결과가 없습니다.
        </p>
      ) : (
        <table className="border-retro-border-darker w-full max-w-2xl border-3">
          <thead>
            <tr className="bg-retro-bg-secondary">
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                ID
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                닉네임
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                상태
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                사유
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-center">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.id}
                className="border-retro-border-light border-b"
              >
                <td className="text-retro-text-primary px-4 py-2">
                  {player.id}
                </td>
                <td className="text-retro-text-primary px-4 py-2">
                  {player.nickname}
                </td>
                <td className="px-4 py-2">
                  {player.isBanned ? (
                    <span className="font-bold text-red-700">밴</span>
                  ) : (
                    <span className="text-retro-text-secondary">정상</span>
                  )}
                </td>
                <td className="text-retro-text-secondary px-4 py-2">
                  {player.banReason || "-"}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => setConfirmTarget(player)}
                    className={`border-retro-border-darker cursor-pointer border-3 px-3 py-1 font-bold text-white transition-colors ${
                      player.isBanned
                        ? "bg-retro-button-bg hover:bg-retro-button-hover"
                        : "bg-red-700 hover:bg-red-800"
                    }`}
                  >
                    {player.isBanned ? "밴 해제" : "밴"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 확인 모달 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeConfirm}
        >
          <div
            className="border-retro-border-darker bg-retro-bg-primary shadow-retro-xl w-80 border-3 p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-confirm-title"
          >
            <p
              id="ban-confirm-title"
              className="text-retro-text-primary mb-4 text-lg font-bold"
            >
              {confirmTarget.nickname}을(를){" "}
              {confirmTarget.isBanned ? "밴 해제" : "밴"}하시겠습니까?
            </p>
            {!confirmTarget.isBanned && (
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="사유 (선택)"
                className="border-retro-border-darker text-retro-text-primary mb-4 w-full border-3 bg-white px-3 py-2 outline-none"
              />
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirm}
                disabled={isProcessing}
                className="border-retro-border-darker bg-retro-bg-secondary text-retro-text-primary hover:bg-retro-hover-bg cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={executeAction}
                disabled={isProcessing}
                className={`border-retro-border-darker cursor-pointer border-3 px-4 py-2 font-bold text-white transition-colors disabled:opacity-50 ${
                  confirmTarget.isBanned
                    ? "bg-retro-button-bg hover:bg-retro-button-hover"
                    : "bg-red-700 hover:bg-red-800"
                }`}
              >
                {isProcessing ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
