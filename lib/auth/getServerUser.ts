import { supabaseServer } from '@/lib/supabase/supabaseServer';

export async function getServerUser() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}