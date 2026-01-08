import AuthGuard from "@/components/AuthGuard";
import ClientOnly from "./_components/ClientOnly";
import Map from "./_components/Map";
import UserInfoModal from "@/components/UserInfoModal";

export default function Home() {
  return (
    <AuthGuard>
      <div className="h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
          <UserInfoModal />
        </ClientOnly>
      </div>
    </AuthGuard>
  );
}
