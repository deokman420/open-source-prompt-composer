import type { Metadata } from "next";
import DraftsLibraryClient from "./DraftsLibraryClient";

export const metadata: Metadata = {
  title: "Drafts",
  description:
    "Everything you've saved — prompts, orchestras, pipelines, loops, tools, and eval runs — in one searchable local library.",
  robots: { index: false, follow: false },
};

export default function DraftsPage() {
  return (
    <>
      <h1 className="page-h1">Drafts</h1>
      <p className="page-sub">
        Everything you&rsquo;ve saved, in this browser only. Export a backup from
        Settings if you want a copy that survives clearing site data.
      </p>
      <div style={{ marginTop: 28 }}>
        <DraftsLibraryClient />
      </div>
    </>
  );
}
