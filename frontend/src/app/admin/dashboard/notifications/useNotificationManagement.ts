"use client";

import { useEffect, useState } from "react";
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

  // 새 공지 작성 폼
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // 수정 모달
  const [editTarget, setEditTarget] = useState<AdminNotification | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(
    null,
  );

  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      setToast({
        message: "공지사항을 불러올 수 없습니다.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsProcessing(true);
    try {
      await createNotification(newTitle.trim(), newContent.trim());
      setNewTitle("");
      setNewContent("");
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
    setEditTitle(notification.title);
    setEditContent(notification.content);
  };

  const handleUpdate = async () => {
    if (!editTarget || !editTitle.trim() || !editContent.trim()) return;
    setIsProcessing(true);
    try {
      await updateNotification(
        editTarget.id,
        editTitle.trim(),
        editContent.trim(),
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

  return {
    notifications,
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
  };
}
