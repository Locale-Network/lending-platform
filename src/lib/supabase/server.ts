import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Supabase client for use in Server Components and Route Handlers
 *
 * This client is used in Server Components, Server Actions, and API Routes
 * where we need to access Supabase with server-side authentication context.
 *
 * Note: We're using this alongside NextAuth for now. The Supabase client
 * provides direct database access without going through Prisma ORM.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Supabase Admin client with service role key
 *
 * WARNING: This client bypasses Row Level Security (RLS) and should only
 * be used in trusted server-side code for admin operations.
 *
 * Use cases:
 * - Syncing Alchemy auth to Supabase
 * - Admin operations that need to bypass RLS
 * - Background jobs and cron tasks
 *
 * Note: Uses createClient from @supabase/supabase-js directly (not @supabase/ssr)
 * because createServerClient doesn't properly bypass RLS with service role key.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
