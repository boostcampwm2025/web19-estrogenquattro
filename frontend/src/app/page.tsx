import AuthGuard from "@/_components/AuthGuard";
import ClientOnly from "@/_components/ClientOnly";
import Map from "@/_components/Map";
import UserInfoModal from "./_components/UserInfoModal";
import FocusPanel from "./_components/FocusPanel";
import LeaderboardModal from "./_components/LeaderboardModal";
import ChannelSelectModal from "./_components/ChannelSelectModal";
import BugReportModal from "./_components/BugReportModal";
import BugReportButton from "./_components/BugReportButton";
import NoticeModal from "./_components/NoticeModal";
import NoticeButton from "./_components/NoticeButton";
import NoticePopup from "./_components/NoticePopup";
import GuestbookModal from "./_components/GuestbookModal/GuestbookModal";
import LeaderboardButton from "./_components/LeaderboardButton";
import ChannelSelectButton from "./_components/ChannelSelectButton";
import GuestbookButton from "./_components/GuestbookButton";
import UserInfoButton from "./_components/UserInfoButton";
import ProgressBar from "@/_components/ui/ProgressBar";
import { OnboardingTour } from "./_components/OnboardingTour";
import ConnectionLostOverlay from "@/_components/ConnectionLostOverlay";

export default function Home() {
  return (
    <AuthGuard>
      <div className="relative h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
          <ProgressBar />
          <UserInfoModal />
          <LeaderboardModal />
          <ChannelSelectModal />
          <BugReportModal />
          <NoticeModal />
          <GuestbookModal />
          <NoticePopup />
          <OnboardingTour />
        </ClientOnly>
        <div className="absolute top-4 right-4 z-40">
          <FocusPanel />
        </div>
        <div className="absolute top-4 bottom-4 left-4 z-30 flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            <UserInfoButton />
            <LeaderboardButton />
            <ChannelSelectButton />
            <GuestbookButton />
          </div>
          <div className="flex flex-col gap-2">
            <NoticeButton />
            <BugReportButton />
          </div>
        </div>
        <ConnectionLostOverlay />
      </div>
    </AuthGuard>
  );
}
