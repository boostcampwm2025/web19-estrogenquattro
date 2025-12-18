import AuthGuard from "@/components/AuthGuard";
import ClientOnly from "./_components/ClientOnly";
import Map from "./_components/Map";

export default function Home() {
  return (
    <AuthGuard>
      <div className="h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
        </ClientOnly>
      </div>
    </AuthGuard>
  );
}
