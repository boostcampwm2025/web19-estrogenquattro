"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { chatApi, type ChatMessageItem } from "@/lib/api/chat";
import { useRoomStore } from "@/stores/useRoomStore";
import {
  useChatHistoryStore,
  type ChatHistoryEntry,
} from "@/stores/useChatHistoryStore";
import { useAuthStore } from "@/stores/authStore";

const STORAGE_KEY = "chat-history-window";
const WINDOW_WIDTH = 320;
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 140;
const TOP_FETCH_THRESHOLD = 48;

interface WindowState {
  x: number;
  y: number;
  height: number;
}

function loadState(): WindowState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return null;
    }
    return { x: parsed.x, y: parsed.y, height: parsed.height };
  } catch {
    return null;
  }
}

function clampToViewport(state: WindowState): WindowState {
  if (typeof window === "undefined") return state;
  const maxX = Math.max(0, window.innerWidth - WINDOW_WIDTH);
  const maxY = Math.max(0, window.innerHeight - state.height);
  return {
    height: state.height,
    x: Math.min(Math.max(0, state.x), maxX),
    y: Math.min(Math.max(0, state.y), maxY),
  };
}

function getChannelFromRoomId(roomId: string): number {
  const match = roomId.match(/^room-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function toChatHistoryEntry(
  item: ChatMessageItem,
  currentUsername?: string,
): ChatHistoryEntry {
  return {
    id: String(item.id),
    roomId: item.roomId,
    channel: getChannelFromRoomId(item.roomId),
    username: item.nickname,
    message: item.message,
    isMine: item.nickname === currentUsername,
    timestamp: new Date(item.createdAt).getTime(),
  };
}

export default function ChatHistoryWindow() {
  const roomId = useRoomStore((state) => state.roomId);
  const currentUsername = useAuthStore((state) => state.user?.username);
  const { messages, upsertMessages, clear } = useChatHistoryStore(
    useShallow((state) => ({
      messages: state.messages,
      upsertMessages: state.upsertMessages,
      clear: state.clear,
    })),
  );
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [state, setState] = useState<WindowState>(() => {
    const saved = loadState();
    if (saved) return saved;
    if (typeof window === "undefined") {
      return { x: 24, y: 24, height: DEFAULT_HEIGHT };
    }
    return {
      height: DEFAULT_HEIGHT,
      x: window.innerWidth - WINDOW_WIDTH - 24,
      y: window.innerHeight - DEFAULT_HEIGHT - 120,
    };
  });

  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeStart = useRef<{
    pointerY: number;
    origH: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRoomIdRef = useRef(roomId);
  const currentUsernameRef = useRef(currentUsername);
  const prependSnapshotRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    activeRoomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    const list = listRef.current;
    const previousMessageCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (!list || messages.length === previousMessageCount) {
      return;
    }

    if (prependSnapshotRef.current) {
      const { scrollHeight, scrollTop } = prependSnapshotRef.current;
      list.scrollTop = list.scrollHeight - scrollHeight + scrollTop;
      prependSnapshotRef.current = null;
      return;
    }

    if (shouldStickToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setState((prev) => clampToViewport(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!roomId) {
      clear();
      setNextCursor(null);
      setIsLoadingInitial(false);
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
      return;
    }

    const abortController = new AbortController();
    activeRoomIdRef.current = roomId;
    shouldStickToBottomRef.current = true;
    prependSnapshotRef.current = null;
    clear();
    setNextCursor(null);
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
    setIsLoadingInitial(true);

    void (async () => {
      try {
        const page = await chatApi.getMessages(
          roomId,
          undefined,
          abortController.signal,
        );
        if (activeRoomIdRef.current !== roomId) {
          return;
        }

        upsertMessages(
          page.items.map((item) =>
            toChatHistoryEntry(item, currentUsernameRef.current),
          ),
        );
        setNextCursor(page.nextCursor);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load chat history", error);
      } finally {
        if (activeRoomIdRef.current === roomId) {
          setIsLoadingInitial(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [roomId, clear, upsertMessages]);

  const loadOlderMessages = async () => {
    if (
      !roomId ||
      nextCursor === null ||
      isLoadingInitial ||
      isLoadingMoreRef.current
    ) {
      return;
    }

    const list = listRef.current;
    if (list) {
      prependSnapshotRef.current = {
        scrollHeight: list.scrollHeight,
        scrollTop: list.scrollTop,
      };
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const page = await chatApi.getMessages(roomId, nextCursor);
      if (activeRoomIdRef.current !== roomId) {
        return;
      }

      upsertMessages(
        page.items.map((item) =>
          toChatHistoryEntry(item, currentUsernameRef.current),
        ),
      );
      setNextCursor(page.nextCursor);
    } catch (error) {
      prependSnapshotRef.current = null;
      console.error("Failed to load older chat history", error);
    } finally {
      isLoadingMoreRef.current = false;
      if (activeRoomIdRef.current === roomId) {
        setIsLoadingMore(false);
      }
    }
  };

  const onListScroll = () => {
    const list = listRef.current;
    if (!list) return;

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 24;

    if (list.scrollTop <= TOP_FETCH_THRESHOLD) {
      void loadOlderMessages();
    }
  };

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      origX: state.x,
      origY: state.y,
    };
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;
    setState((prev) =>
      clampToViewport({
        ...prev,
        x: start.origX + dx,
        y: start.origY + dy,
      }),
    );
  };

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragStart.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeStart.current = {
      pointerY: e.clientY,
      origH: state.height,
    };
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    const dy = e.clientY - start.pointerY;
    setState((prev) => {
      const maxH =
        typeof window !== "undefined" ? window.innerHeight - prev.y : Infinity;
      return {
        ...prev,
        height: Math.min(Math.max(MIN_HEIGHT, start.origH + dy), maxH),
      };
    });
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    resizeStart.current = null;
  };

  const textShadow =
    "0 0 2px rgba(255,248,220,0.35), 1px 1px 1px rgba(120,53,15,0.18)";

  return (
    <div
      className="pointer-events-auto fixed z-[900] flex flex-col overflow-hidden border-2 border-amber-900/58 bg-[#f2dfb7]/78 shadow-[3px_3px_0_0_rgba(0,0,0,0.18)] backdrop-blur-[4px]"
      style={{
        left: state.x,
        top: state.y,
        width: WINDOW_WIDTH,
        height: state.height,
      }}
      role="region"
      aria-label="채팅 기록"
    >
      <div
        className="flex h-7 shrink-0 cursor-move items-center border-b border-amber-900/26 bg-[#f8ebcf]/78 px-2 select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <span
          className="font-['NeoDunggeunmo',_Arial,_sans-serif] text-sm text-amber-900"
          style={{ textShadow }}
        >
          채팅 기록
        </span>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 py-1.5 font-['NeoDunggeunmo',_Arial,_sans-serif] text-[15px] leading-relaxed"
        style={{ textShadow }}
        onScroll={onListScroll}
      >
        {isLoadingMore ? (
          <div className="pb-1 text-center text-[11px] text-amber-700/90">
            이전 채팅 불러오는 중...
          </div>
        ) : null}

        {isLoadingInitial ? (
          <div className="text-amber-700/90">채팅 기록 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-amber-700/90">아직 채팅 기록이 없습니다.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="break-words">
              <span className="text-amber-700/90">[{m.channel}채널]</span>
              <span
                className={`ml-1 font-bold ${m.isMine ? "text-[#9a5f2d]" : "text-[#6a3f2a]"}`}
              >
                {m.username}
              </span>
              <span>: </span>
              <span className={m.isMine ? "text-[#8b4f1f]" : "text-[#5f3828]"}>
                {m.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div
        className="absolute right-0 bottom-0 left-0 flex h-2.5 cursor-ns-resize items-center justify-center bg-[#f5e7c7]/72 hover:bg-[#efddb5]/82"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        aria-label="높이 조정"
      >
        <div className="h-0.5 w-8 rounded-full bg-amber-900/24" />
      </div>
    </div>
  );
}
