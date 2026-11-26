import type { Metadata } from "next";
import { LookupView } from "./lookup-view";

export const metadata: Metadata = { title: "Tra giá" };

export default function HomePage() {
  return <LookupView />;
}
