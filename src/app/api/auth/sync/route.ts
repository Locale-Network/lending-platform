import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { Role } from '@prisma/client';

/**
 * Auth Sync Endpoint
 *
 * Syncs authentication data from Alchemy Account Kit to Supabase database.
 * This endpoint should be called after successful Alchemy authentication.
 *
 * Flow:
 * 1. User authenticates via Alchemy Account Kit (email/social/passkey)
 * 2. Client gets wallet address and Alchemy user ID
 * 3. Client calls this endpoint with auth data
 * 4. Server syncs data to Supabase accounts table
 *
 * Security:
 * - Uses Supabase Admin client (bypasses RLS)
 * - Should be protected by Alchemy session verification in production
 */

interface SyncRequest {
  address: string;
  alchemyUserId: string;
  email?: string;
  authProvider: 'email' | 'google' | 'apple' | 'passkey' | 'wallet';
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();
    const { address, alchemyUserId, email, authProvider } = body;

    // Validate required fields
    if (!address || !alchemyUserId || !authProvider) {
      return NextResponse.json(
        { error: 'Missing required fields: address, alchemyUserId, authProvider' },
        { status: 400 }
      );
    }

    // Get Supabase admin client
    const supabase = createAdminClient();

    // Check if account already exists
    const { data: existingAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('address', address.toLowerCase())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (account doesn't exist)
      console.error('Error fetching account:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch account data' },
        { status: 500 }
      );
    }

    if (existingAccount) {
      // Account exists - update Alchemy fields only
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          alchemy_user_id: alchemyUserId,
          email: email || existingAccount.email,
          auth_provider: authProvider,
          updated_at: new Date().toISOString(),
        })
        .eq('address', address.toLowerCase());

      if (updateError) {
        console.error('Error updating account:', updateError);
        return NextResponse.json(
          { error: 'Failed to update account' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        account: {
          address: existingAccount.address,
          role: existingAccount.role,
          alchemyUserId,
        },
      });
    }

    // Account doesn't exist - create new account with BORROWER role
    const { data: newAccount, error: insertError } = await supabase
      .from('accounts')
      .insert({
        address: address.toLowerCase(),
        alchemy_user_id: alchemyUserId,
        email: email || null,
        auth_provider: authProvider,
        role: Role.BORROWER, // Default role for new users
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating account:', insertError);
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        address: newAccount.address,
        role: newAccount.role,
        alchemyUserId,
      },
      isNewUser: true,
    });
  } catch (error) {
    console.error('Auth sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
