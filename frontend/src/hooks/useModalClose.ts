import React, { useCallback, useEffect, useRef } from "react";

interface UseModalCloseProps {
  isOpen: boolean;
  onClose: () => void;
}

export function useModalClose({ isOpen, onClose }: UseModalCloseProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  // ESC 누를 때 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, handleClose]);

  // 모달 외부영역 클릭으로 모달 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    },
    [handleClose],
  );

  return {
    contentRef,
    handleClose,
    handleBackdropClick,
  };
}
