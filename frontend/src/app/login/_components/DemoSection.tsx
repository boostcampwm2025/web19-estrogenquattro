import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function DemoSection() {
  const { t } = useTranslation("login");

  const isMounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <footer className="mx-auto w-[70%] py-24">
      <div className="space-y-8 text-center">
        <h2 className="font-display text-sm font-bold tracking-[0.3em] text-amber-900/40 uppercase">
          Service Demo
        </h2>
        <div className="relative aspect-video overflow-hidden border-amber-900/10 bg-white/5 shadow-2xl backdrop-blur-sm">
          {isMounted && (
            <iframe
              src="https://demo.arcade.software/4gu3eVafFI6UHrOYCR37?embed&embed_mobile=inline&embed_desktop=inline&show_copy_link=true"
              title={t((r) => r.demo.iframeTitle)}
              loading="lazy"
              allowFullScreen
              allow="clipboard-write"
              className="absolute inset-0 h-full w-full"
              style={{ colorScheme: "light" }}
            />
          )}
        </div>
        <div className="font-display pt-8 text-[10px] tracking-[0.2em] text-amber-900/30 uppercase">
          © 2026 ESTROGEN QUATTRO. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
