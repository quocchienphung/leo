import type { Metadata } from "next";
import { PlaygroundView } from "@/components/sites/leoparpeix/views/PlaygroundView";

export const metadata: Metadata = {
  title: "Playground — Peanutto",
  description:
    "Code experiments, WebGL tests and machine learning demos from Peanutto’s playground — fullstack, cloud and ML engineer.",
};

export default function Page() {
  return <PlaygroundView />;
}
