import type { Metadata } from "next";
import { AboutView } from "@/components/sites/leoparpeix/views/AboutView";

export const metadata: Metadata = {
  title: "About — Peanutto",
  description:
    "Learn more about Peanutto: background, engineering approach, cloud architecture and machine learning for products that scale.",
};

export default function Page() {
  return <AboutView />;
}
