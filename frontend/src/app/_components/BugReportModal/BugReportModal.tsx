"use client";

import { useState, useRef, useCallback } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { ImagePlus, Send, X, Upload, Trash2, Loader2 } from "lucide-react";
import Toast from "@/app/_components/Toast";
import { collectDiagnostics } from "@/lib/diagnostics";
import { useTranslation } from "react-i18next";
import { API_URL } from "@/lib/api/client";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";
const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface AttachedFile {
  file: File;
  preview: string;
}

export default function BugReportModal() {
  const { t } = useTranslation("ui");
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );

  const isOpen = activeModal === MODAL_TYPES.BUG_REPORT;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.preview));
      setDescription("");
      setAttachments([]);
      closeModal();
    },
  });

  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [fileSizeError, setFileSizeError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 용량 초과 파일 체크를 state updater 밖에서 먼저 수행
    const hasOversized = fileArray.some(
      (file) => file.type.startsWith("image/") && file.size > MAX_FILE_SIZE,
    );

    const validFiles = fileArray.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE,
    );

    if (validFiles.length > 0) {
      setAttachments((prev) => {
        const remaining = MAX_ATTACHMENTS - prev.length;
        if (remaining <= 0) return prev;

        return [
          ...prev,
          ...validFiles.slice(0, remaining).map((file) => ({
            file,
            preview: URL.createObjectURL(file),
          })),
        ];
      });
    }

    if (hasOversized) {
      setFileSizeError(true);
      setTimeout(() => setFileSizeError(false), 3000);
    }
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

  const handleSubmit = useCallback(async () => {
    if (!description.trim() && attachments.length === 0) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 진단 정보 자동 수집
      const diagnostics = collectDiagnostics();

      const formData = new FormData();
      formData.append("content", description.trim());
      formData.append("diagnostics", JSON.stringify(diagnostics));
      attachments.forEach((a) => formData.append("images", a.file));

      const response = await fetch(`${API_URL}/api/bug-reports`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // 초기화
      attachments.forEach((a) => URL.revokeObjectURL(a.preview));
      setDescription("");
      setAttachments([]);
      closeModal();
      setShowToast(true);
    } catch (error) {
      console.error("Bug report submission failed:", error);
      setShowErrorToast(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [description, attachments, closeModal, isSubmitting]);

  const handleModalClose = handleClose;

  return (
    <>
      {showToast && (
        <Toast
          message={t(($) => $.bugReport.successToast)}
          onClose={() => setShowToast(false)}
        />
      )}
      {showErrorToast && (
        <Toast
          message={t(($) => $.bugReport.errorToast)}
          variant="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
      {isOpen && (
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
                {t(($) => $.bugReport.title)}
              </h2>
              <button
                onClick={handleModalClose}
                aria-label={t(($) => $.bugReport.closeModal)}
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
                  placeholder={t(($) => $.bugReport.placeholder)}
                  maxLength={500}
                  rows={5}
                  className="w-full resize-none border-none bg-transparent p-3 text-sm text-amber-900 placeholder-amber-400 outline-none"
                />
                <div className="px-3 pb-2 text-right text-[11px] text-amber-500">
                  {t(($) => $.bugReport.charCount, {
                    current: description.length,
                    max: 500,
                  })}
                </div>
              </div>

              {/* 파일 첨부 영역 */}
              {attachments.length < MAX_ATTACHMENTS && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer ${PIXEL_BORDER} flex flex-col p-4 transition-colors ${
                    isDragOver
                      ? "border-amber-500 bg-amber-300"
                      : "border-dashed bg-white hover:bg-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {isDragOver ? (
                      <Upload className="h-8 w-8 text-amber-600" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-amber-400" />
                    )}
                    <p className="text-center text-sm text-amber-700">
                      {isDragOver
                        ? t(($) => $.bugReport.dropHere)
                        : t(($) => $.bugReport.attachHint, {
                            current: attachments.length,
                            max: MAX_ATTACHMENTS,
                          })}
                    </p>
                  </div>
                  <p className="text-center text-[11px] text-amber-500">
                    {t(($) => $.bugReport.fileSizeLimit)}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </div>
              )}

              {/* 용량 초과 알림 */}
              {fileSizeError && (
                <p className="mt-2 text-center text-xs font-bold text-red-500">
                  {t(($) => $.bugReport.fileSizeError)}
                </p>
              )}

              {/* 전체 삭제 버튼 */}
              {attachments.length > 0 && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={removeAllAttachments}
                    className="flex cursor-pointer items-center gap-1 text-xs font-bold text-red-500 transition-colors hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t(($) => $.bugReport.deleteAll)}</span>
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
                      <img
                        src={attachment.preview}
                        alt={t(($) => $.bugReport.attachedImage, {
                          index: index + 1,
                        })}
                        className="h-24 w-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(index);
                        }}
                        className="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={t(($) => $.bugReport.deleteFile, {
                          index: index + 1,
                        })}
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
                disabled={
                  isSubmitting ||
                  (!description.trim() && attachments.length === 0)
                }
                className={`flex items-center gap-2 px-6 py-2 font-bold tracking-wider text-white transition-all ${
                  isSubmitting ||
                  (!description.trim() && attachments.length === 0)
                    ? "cursor-not-allowed bg-zinc-500 shadow-[inset_-4px_-4px_0px_0px_#555,inset_4px_4px_0px_0px_#aaa]"
                    : "cursor-pointer bg-amber-500 shadow-[inset_-4px_-4px_0px_0px_#b45309,inset_4px_4px_0px_0px_#fcd34d] hover:bg-amber-400 active:shadow-[inset_4px_4px_0px_0px_#b45309]"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>{t(($) => $.bugReport.submit)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
