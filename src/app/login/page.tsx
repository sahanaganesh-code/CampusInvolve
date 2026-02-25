import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return <LoginClient />;
}