import type { ReactNode } from "react";
import { AppNav } from "./app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6">{children}</main>
    </>
  );
}
