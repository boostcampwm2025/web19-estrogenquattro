import { useState, useEffect } from "react";

export default function DemoSection() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
              title="펫 뽑기와 밥주기 사용하기"
              loading="lazy"
              allowFullScreen
              allow="clipboard-write"
              className="absolute inset-0 h-full w-full"
              style={{ colorScheme: "light" }}
            />
          )}
        </div>
        <div className="font-display pt-8 text-[10px] tracking-[0.2em] text-amber-900/30 uppercase">
          © 2024 ESTROGEN QUATTRO. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
