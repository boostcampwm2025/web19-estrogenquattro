import AuthGuard from "@/_components/AuthGuard";
import ClientOnly from "@/_components/ClientOnly";
import Map from "@/_components/Map";
import TasksMenu from "./_components/TasksMenu/TasksMenu";

export default function Home() {
  return (
    <AuthGuard>
      <div className="relative h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
        </ClientOnly>
        <div className="absolute top-4 right-4 z-50">
          <TasksMenu />
        </div>
      </div>
    </AuthGuard>
  );
}
