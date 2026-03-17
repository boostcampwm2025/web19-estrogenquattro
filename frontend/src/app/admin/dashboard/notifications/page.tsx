"use client";

import Toast from "@/app/_components/Toast";
import MarkdownEditor from "@/app/_components/MarkdownEditor";
import { useNotificationManagement } from "./useNotificationManagement";

export default function NotificationsManagementPage() {
  const {
    notifications,
    paginatedNotifications,
    currentPage,
    totalPages,
    setCurrentPage,
    isLoading,
    isProcessing,
    newTitle,
    setNewTitle,
    newContent,
    setNewContent,
    handleCreate,
    editTarget,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
    openEdit,
    handleUpdate,
    setEditTarget,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    toast,
    setToast,
  } = useNotificationManagement();

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-retro-text-primary mb-6 text-xl font-bold">
        공지사항 관리
      </h2>

      {/* 새 공지 작성 */}
      <div className="border-retro-border-darker bg-retro-bg-secondary mb-6 max-w-4xl border-3 p-4">
        <h3 className="text-retro-text-primary mb-3 font-bold">새 공지 작성</h3>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="제목"
          maxLength={200}
          className="border-retro-border-darker text-retro-text-primary mb-3 w-full border-3 bg-white px-3 py-2 outline-none"
        />
        <MarkdownEditor
          content={newContent}
          onChange={setNewContent}
          placeholder="내용을 입력하세요 (# 제목, **굵게**, *기울임* 등 마크다운 자동 변환)"
          className="border-retro-border-darker mb-3 border-3 bg-white"
        />
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={isProcessing || !newTitle.trim() || !newContent.trim()}
            className="border-retro-border-darker bg-retro-button-bg text-retro-button-text hover:bg-retro-button-hover cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? "작성 중..." : "작성"}
          </button>
        </div>
      </div>

      {/* 공지 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-retro-border-dark h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-retro-text-secondary py-8 text-center">
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <table className="border-retro-border-darker w-full max-w-4xl border-3">
          <thead>
            <tr className="bg-retro-bg-secondary">
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                ID
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                제목
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                작성자
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-left">
                작성일
              </th>
              <th className="border-retro-border-darker text-retro-text-primary border-b-3 px-4 py-2 text-center">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedNotifications.map((notification) => (
              <tr
                key={notification.id}
                className="border-retro-border-light border-b"
              >
                <td className="text-retro-text-primary px-4 py-2">
                  {notification.id}
                </td>
                <td className="text-retro-text-primary px-4 py-2">
                  {notification.title}
                </td>
                <td className="text-retro-text-primary px-4 py-2">
                  {notification.author?.nickname || "-"}
                </td>
                <td className="text-retro-text-secondary px-4 py-2 text-sm">
                  {new Date(notification.createdAt).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => openEdit(notification)}
                      className="border-retro-border-darker bg-retro-button-bg text-retro-button-text hover:bg-retro-button-hover cursor-pointer border-3 px-3 py-1 font-bold transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setDeleteTarget(notification)}
                      className="border-retro-border-darker cursor-pointer border-3 bg-red-700 px-3 py-1 font-bold text-white transition-colors hover:bg-red-800"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 페이지네이션 컨트롤 */}
      {!isLoading && notifications.length > 0 && (
        <div className="mt-6 mb-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-retro-border-darker bg-retro-bg-secondary text-retro-text-primary hover:bg-retro-hover-bg cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-retro-text-primary font-bold">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-retro-border-darker bg-retro-bg-secondary text-retro-text-primary hover:bg-retro-hover-bg cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="border-retro-border-darker bg-retro-bg-primary shadow-retro-xl w-full max-w-4xl border-3 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-retro-text-primary mb-4 text-lg font-bold">
              공지사항 수정
            </h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="제목"
              maxLength={200}
              className="border-retro-border-darker text-retro-text-primary mb-3 w-full border-3 bg-white px-3 py-2 outline-none"
            />
            <MarkdownEditor
              content={editContent}
              onChange={setEditContent}
              placeholder="내용을 입력하세요 (마크다운 자동 변환)"
              className="border-retro-border-darker mb-4 border-3 bg-white"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditTarget(null)}
                disabled={isProcessing}
                className="border-retro-border-darker bg-retro-bg-secondary text-retro-text-primary hover:bg-retro-hover-bg cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleUpdate}
                disabled={
                  isProcessing || !editTitle.trim() || !editContent.trim()
                }
                className="border-retro-border-darker bg-retro-button-bg text-retro-button-text hover:bg-retro-button-hover cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="border-retro-border-darker bg-retro-bg-primary shadow-retro-xl w-80 border-3 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-retro-text-primary mb-4 text-lg font-bold">
              &quot;{deleteTarget.title}&quot;을(를) 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isProcessing}
                className="border-retro-border-darker bg-retro-bg-secondary text-retro-text-primary hover:bg-retro-hover-bg cursor-pointer border-3 px-4 py-2 font-bold transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="border-retro-border-darker cursor-pointer border-3 bg-red-700 px-4 py-2 font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
              >
                {isProcessing ? "삭제 중..." : "삭제"}
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
