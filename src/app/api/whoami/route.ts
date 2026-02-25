import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  return NextResponse.json({
    cookieNames,
    hasSbCookie: cookieNames.some((n) => n.startsWith("sb-")),
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    error: error?.message ?? null,
  });
}