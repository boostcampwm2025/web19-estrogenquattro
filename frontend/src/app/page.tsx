import AuthGuard from "@/_components/AuthGuard";
import ClientOnly from "@/_components/ClientOnly";
import Map from "@/_components/Map";
import TasksMenu from "./_components/TasksMenu/TasksMenu";
import UserInfoModal from "./_components/UserInfoModal";
import MusicPlayer from "./_components/MusicPlayer/MusicPlayer";
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
        <div className="absolute top-4 left-4 z-50">
          <MusicPlayer />
        </div>
        <div className="absolute top-4 right-4 z-50">
          <TasksMenu />
        </div>
        <div className="absolute bottom-4 left-4 z-50">
          <LeaderboardButton />
        </div>
      </div>
    </AuthGuard>
  );
}
