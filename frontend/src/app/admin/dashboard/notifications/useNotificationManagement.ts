"use client";

import { useEffect, useRef, useState } from "react";
import {
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  type AdminNotification,
} from "@/lib/api/admin";

export function useNotificationManagement() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 새 공지 작성 폼
  const [newTitleKo, setNewTitleKo] = useState("");
  const [newContentKo, setNewContentKo] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newContentEn, setNewContentEn] = useState("");

  // 수정 모달
  const [editTarget, setEditTarget] = useState<AdminNotification | null>(null);
  const [editTitleKo, setEditTitleKo] = useState("");
  const [editContentKo, setEditContentKo] = useState("");
  const [editTitleEn, setEditTitleEn] = useState("");
  const [editContentEn, setEditContentEn] = useState("");

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(
    null,
  );

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchNotifications = async (page: number = currentPage) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const data = await getNotifications(
        page,
        ITEMS_PER_PAGE,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setNotifications(data.items);
      setTotalPagesState(data.totalPages);
    } catch (error) {
      if (controller.signal.aborted) return;
      setToast({
        message: "공지사항을 불러올 수 없습니다.",
        variant: "error",
      });
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNotifications(currentPage);
    return () => {
      abortRef.current?.abort();
    };
  }, [currentPage]);

  const handleCreate = async () => {
    if (
      !newTitleKo.trim() ||
      !newContentKo.trim() ||
      !newTitleEn.trim() ||
      !newContentEn.trim()
    )
      return;
    setIsProcessing(true);
    try {
      await createNotification(
        newTitleKo.trim(),
        newContentKo.trim(),
        newTitleEn.trim(),
        newContentEn.trim(),
      );
      setNewTitleKo("");
      setNewContentKo("");
      setNewTitleEn("");
      setNewContentEn("");
      setToast({ message: "공지사항을 작성했습니다.", variant: "success" });
      await fetchNotifications();
    } catch {
      setToast({ message: "작성에 실패했습니다.", variant: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const openEdit = (notification: AdminNotification) => {
    setEditTarget(notification);
    setEditTitleKo(notification.titleKo || "");
    setEditContentKo(notification.contentKo || "");
    setEditTitleEn(notification.titleEn || "");
    setEditContentEn(notification.contentEn || "");
  };

  const handleUpdate = async () => {
    if (
      !editTarget ||
      !editTitleKo.trim() ||
      !editContentKo.trim() ||
      !editTitleEn.trim() ||
      !editContentEn.trim()
    )
      return;
    setIsProcessing(true);
    try {
      await updateNotification(
        editTarget.id,
        editTitleKo.trim(),
        editContentKo.trim(),
        editTitleEn.trim(),
        editContentEn.trim(),
      );
      setEditTarget(null);
      setToast({ message: "공지사항을 수정했습니다.", variant: "success" });
      await fetchNotifications();
    } catch {
      setToast({ message: "수정에 실패했습니다.", variant: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      await deleteNotification(deleteTarget.id);
      setDeleteTarget(null);
      setToast({ message: "공지사항을 삭제했습니다.", variant: "success" });
      await fetchNotifications();
    } catch {
      setToast({ message: "삭제에 실패했습니다.", variant: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = Math.max(1, totalPagesState);
  const paginatedNotifications = notifications;

  return {
    notifications, // Note: now represents the paginated list, kept for compatibility if needed.
    paginatedNotifications,
    currentPage,
    totalPages,
    setCurrentPage,
    isLoading,
    isProcessing,
    newTitleKo,
    setNewTitleKo,
    newContentKo,
    setNewContentKo,
    newTitleEn,
    setNewTitleEn,
    newContentEn,
    setNewContentEn,
    handleCreate,
    editTarget,
    editTitleKo,
    setEditTitleKo,
    editContentKo,
    setEditContentKo,
    editTitleEn,
    setEditTitleEn,
    editContentEn,
    setEditContentEn,
    openEdit,
    handleUpdate,
    setEditTarget,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    toast,
    setToast,
  };
}
