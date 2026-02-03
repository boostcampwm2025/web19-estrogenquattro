import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";

export default function ProfileTab() {
  const targetPlayerId = useModalStore(
    (state) => state.userInfoPayload?.playerId,
  );
  const { user } = useAuthStore();
  const playerId = targetPlayerId ?? user?.playerId ?? 0;

  return (
    <div className="space-y-4">
      <div className="text-amber-900">
        <h3 className="mb-2 text-lg font-bold">프로필</h3>
        <p>Player ID: {playerId}</p>
      </div>
    </div>
  );
}
