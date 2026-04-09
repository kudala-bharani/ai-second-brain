import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/public-env";
import LandingPage from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Second Brain — Your personal knowledge base",
  description:
    "Store notes, tag memories, and ask questions. Get answers grounded in your own data with semantic search and RAG.",
  robots: { index: true, follow: true },
};

export default async function RootPage() {
  const env = getSupabasePublicEnv();

  if (!env) {
    return <LandingPage showConfigWarning />;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      redirect("/dashboard");
    }
  } catch {
    // Invalid cookies or transient Supabase errors: still show marketing page
  }

  return <LandingPage />;
}
