import AuthGuard from "@/components/AuthGuard";
import Map from "@/components/Map";

export default function Home() {
  return (
    <AuthGuard>
      <div className="h-screen w-screen overflow-hidden">
        <Map />
      </div>
    </AuthGuard>
  );
}
