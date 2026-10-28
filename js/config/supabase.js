
/* =========================================================
   TUX POS — SUPABASE CONNECTION
   Main database client + Tux Admin authentication client
   + Temporary authentication diagnostics
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
  'https://phqbvspvojvrgdagjlow.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_vBuemEyfJgNhddyDOAwcgg_MJqm9t1O';


/* =========================================================
   VALIDATE CONFIGURATION
   ========================================================= */

if (
  !window.supabase ||
  typeof window.supabase.createClient !== 'function'
) {
  throw new Error(
    'TUX POS: Supabase library is missing or loaded incorrectly.'
  );
}


if (
  !SUPABASE_URL ||
  !SUPABASE_KEY
) {
  throw new Error(
    'TUX POS: Supabase URL or public API key is missing.'
  );
}


/* =========================================================
   MAIN SUPABASE CLIENT
   Used for:
   - Orders
   - Gam3ya
   - Stock
   - Expenses
   - Reports
   - Workers
   ========================================================= */

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   SEPARATE TUX ADMIN AUTH CLIENT
   Uses a separate session storage key.
   ========================================================= */

const tuxAdminAuthClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        storageKey: 'tux-admin-auth-session',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );


/* =========================================================
   GLOBAL CLIENT REFERENCES
   Preserve compatibility with existing files.
   ========================================================= */

window.supabaseClient =
  supabaseClient;

window.tuxAdminAuthClient =
  tuxAdminAuthClient;


/* =========================================================
   TEST DATABASE CONNECTION
   ========================================================= */

async function testSupabaseConnection() {

  try {

    const {
      data,
      error
    } = await supabaseClient
      .from('workers')
      .select('id')
      .limit(1);


    if (error) {

      console.error(
        'TUX POS — Supabase connection error:',
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      );


      return {
        success: false,
        error: error.message
      };

    }


    console.log(
      'TUX POS — Supabase connected successfully.'
    );


    return {
      success: true,
      data
    };

  } catch (error) {

    console.error(
      'TUX POS — Supabase connection failed:',
      error
    );


    return {
      success: false,
      error: error.message
    };

  }

}


/* =========================================================
   TEMPORARY AUTHENTICATION DIAGNOSTIC
   Checks both clients without changing their sessions.
   ========================================================= */

async function diagnoseTuxSupabaseAuth() {

  try {

    const [
      mainSessionResult,
      adminSessionResult
    ] = await Promise.all([

      supabaseClient.auth.getSession(),

      tuxAdminAuthClient.auth.getSession()

    ]);


    const mainSession =
      mainSessionResult.data?.session || null;


    const adminSession =
      adminSessionResult.data?.session || null;


    console.log(
      'TUX POS — Supabase authentication diagnostic:',
      {
        mainClient: {
          hasSession:
            Boolean(mainSession),

          userId:
            mainSession?.user?.id || null
        },

        tuxAdminAuthClient: {
          hasSession:
            Boolean(adminSession),

          userId:
            adminSession?.user?.id || null
        }
      }
    );


    if (mainSessionResult.error) {

      console.error(
        'TUX POS — Main client session error:',
        mainSessionResult.error.message
      );

    }


    if (adminSessionResult.error) {

      console.error(
        'TUX POS — Tux Admin client session error:',
        adminSessionResult.error.message
      );

    }


    return {

      mainClient: {
        hasSession:
          Boolean(mainSession),

        userId:
          mainSession?.user?.id || null
      },

      tuxAdminAuthClient: {
        hasSession:
          Boolean(adminSession),

        userId:
          adminSession?.user?.id || null
      }

    };

  } catch (error) {

    console.error(
      'TUX POS — Authentication diagnostic failed:',
      error
    );


    return {
      error: error.message
    };

  }

}


/* =========================================================
   GLOBAL DIAGNOSTIC REFERENCE
   Allows testing from the browser console.
   ========================================================= */

window.diagnoseTuxSupabaseAuth =
  diagnoseTuxSupabaseAuth;


/* =========================================================
   START CONNECTION TEST
   ========================================================= */

window.addEventListener(
  'DOMContentLoaded',
  function () {

    testSupabaseConnection();

  }
);

