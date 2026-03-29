import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getServerUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}