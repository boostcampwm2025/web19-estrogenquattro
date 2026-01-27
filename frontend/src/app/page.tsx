import AuthGuard from "@/_components/AuthGuard";
import ClientOnly from "@/_components/ClientOnly";
import Map from "@/_components/Map";
import UserInfoModal from "./_components/UserInfoModal";
import FocusPanel from "./_components/FocusPanel";
import LeaderboardModal from "./_components/LeaderboardModal";
import LeaderboardButton from "./_components/LeaderboardButton";

export default function Home() {
  return (
    <AuthGuard>
      <div className="relative h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
          <UserInfoModal />
          <LeaderboardModal />
        </ClientOnly>
        <div className="absolute top-4 right-4 z-40">
          <FocusPanel />
        </div>
        <div className="absolute bottom-4 left-4 z-30">
          <LeaderboardButton />
        </div>
      </div>
    </AuthGuard>
  );
}
