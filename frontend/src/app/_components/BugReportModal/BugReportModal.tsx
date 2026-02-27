"use client";

import { useState, useRef, useCallback } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { ImagePlus, Send, X, Upload, Trash2 } from "lucide-react";
import { collectDiagnostics } from "@/lib/diagnostics";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";
const MAX_ATTACHMENTS = 3;

interface AttachedFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

export default function BugReportModal() {
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );

  const isOpen = activeModal === MODAL_TYPES.BUG_REPORT;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    // FileList는 live DOM 객체이므로 input value 리셋 시 비워짐
    // 상태 업데이트 전에 미리 배열로 복사
    const fileArray = Array.from(files);

    setAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) return prev;

      const newAttachments: AttachedFile[] = [];

      fileArray.slice(0, remaining).forEach((file) => {
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          const preview = URL.createObjectURL(file);
          newAttachments.push({
            file,
            preview,
            type: file.type.startsWith("image/") ? "image" : "video",
          });
        }
      });

      return [...prev, ...newAttachments];
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const toRemove = prev[index];
      URL.revokeObjectURL(toRemove.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const removeAllAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleSubmit = useCallback(() => {
    if (!description.trim() && attachments.length === 0) return;

    // 진단 정보 자동 수집
    const diagnostics = collectDiagnostics();

    // TODO: 실제 API 연동 시 여기에 전송 로직 추가
    console.log("Bug report submitted:", {
      description,
      attachments: attachments.map((a) => a.file.name),
      diagnostics,
    });

    // 초기화
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setDescription("");
    setAttachments([]);
    closeModal();
  }, [description, attachments, closeModal]);

  const handleModalClose = useCallback(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setDescription("");
    setAttachments([]);
    handleClose();
  }, [attachments, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className={`relative w-full max-w-lg ${PIXEL_BG} ${PIXEL_BORDER} p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="bug-report-title"
            className="text-xl font-extrabold tracking-wider text-amber-900"
          >
            버그 제보
          </h2>
          <button
            onClick={handleModalClose}
            aria-label="모달 닫기"
            className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
          >
            X
          </button>
        </div>

        {/* 컨텐츠 영역 */}
        <div
          className={`${PIXEL_BORDER} relative overflow-hidden bg-white/50 p-3`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-5" />

          {/* 텍스트 입력 */}
          <div className={`${PIXEL_BORDER} mb-3 bg-white`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="버그나 오류 내용을 입력하세요..."
              maxLength={500}
              rows={5}
              className="w-full resize-none border-none bg-transparent p-3 text-sm text-amber-900 placeholder-amber-400 outline-none"
            />
            <div className="px-3 pb-2 text-right text-[11px] text-amber-500">
              {description.length}/500
            </div>
          </div>

          {/* 파일 첨부 영역 */}
          {attachments.length < MAX_ATTACHMENTS && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer ${PIXEL_BORDER} flex items-center justify-center gap-2 p-4 transition-colors ${
                isDragOver
                  ? "border-amber-500 bg-amber-100"
                  : "border-dashed bg-white hover:bg-amber-50"
              }`}
            >
              {isDragOver ? (
                <Upload className="h-8 w-8 text-amber-600" />
              ) : (
                <ImagePlus className="h-8 w-8 text-amber-400" />
              )}
              <p className="text-center text-sm text-amber-700">
                {isDragOver
                  ? "여기에 놓으세요!"
                  : `클릭하거나 이미지/동영상을 드래그하여 첨부 ( ${attachments.length} / ${MAX_ATTACHMENTS} )`}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </div>
          )}

          {/* 전체 삭제 버튼 */}
          {attachments.length > 0 && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={removeAllAttachments}
                className="flex cursor-pointer items-center gap-1 text-xs font-bold text-red-500 transition-colors hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>전체 삭제</span>
              </button>
            </div>
          )}

          {/* 첨부 파일 미리보기 */}
          {attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className={`group relative overflow-hidden ${PIXEL_BORDER} bg-white`}
                >
                  {attachment.type === "image" ? (
                    <img
                      src={attachment.preview}
                      alt={`첨부 이미지 ${index + 1}`}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <video
                      src={attachment.preview}
                      className="h-24 w-full object-cover"
                      muted
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(index);
                    }}
                    className="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`첨부 파일 ${index + 1} 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 bottom-0 left-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                    {attachment.file.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 제출 버튼 */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!description.trim() && attachments.length === 0}
            className={`flex items-center gap-2 px-6 py-2 font-bold tracking-wider text-white transition-all ${
              !description.trim() && attachments.length === 0
                ? "cursor-not-allowed bg-zinc-500 shadow-[inset_-4px_-4px_0px_0px_#555,inset_4px_4px_0px_0px_#aaa]"
                : "cursor-pointer bg-amber-500 shadow-[inset_-4px_-4px_0px_0px_#b45309,inset_4px_4px_0px_0px_#fcd34d] hover:bg-amber-400 active:shadow-[inset_4px_4px_0px_0px_#b45309]"
            }`}
          >
            <Send className="h-4 w-4" />
            <span>전송</span>
          </button>
        </div>
      </div>
    </div>
  );
}
