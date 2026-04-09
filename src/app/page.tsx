import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Second Brain — Your personal knowledge base",
  description:
    "Store notes, tag memories, and ask questions. Get answers grounded in your own data with semantic search and RAG.",
  robots: { index: true, follow: true },
};

export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
