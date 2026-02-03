import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { roomApi } from "../room";

export const useRoomSystem = (options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();

  // 채널(방) 목록 조회
  const { data: rooms = {}, isLoading } = useQuery({
    queryKey: queryKeys.rooms.all,
    queryFn: roomApi.getRooms,
    // 채널 정보는 자주 바뀔 수 있으므로 staleTime을 짧게 설정하거나 0으로 유지
    staleTime: 0,
    enabled: options?.enabled,
  });

  // 채널 입장 (예약)
  const joinRoomMutation = useMutation({
    mutationFn: (roomId: string) => roomApi.joinRoom(roomId),
    onSuccess: () => {
      // 입장 후 최신 상태 갱신
      queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.all,
      });
    },
  });

  return {
    rooms,
    isLoading,
    joinRoom: joinRoomMutation.mutateAsync,
  };
};
