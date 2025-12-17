"use client";

import dynamic from "next/dynamic";

const ClientOnly = dynamic(
  () =>
    Promise.resolve(({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    )),
  { ssr: false },
);

export default ClientOnly;
