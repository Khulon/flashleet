"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const LearnPage = dynamic(() => import("@/components/LearnTab"), { ssr: false });

export default function PersistentLearn() {
  const pathname = usePathname();
  const isLearn = pathname === "/learn" || pathname === "/";

  return (
    <div style={isLearn ? undefined : {
      visibility: "hidden",
      pointerEvents: "none",
      position: "fixed",
      inset: 0,
      zIndex: -1,
    }}>
      <LearnPage />
    </div>
  );
}
