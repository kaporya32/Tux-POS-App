/* =========================================================
   TUX POS — SUPABASE CONNECTION
   ========================================================= */

const SUPABASE_URL = 'https://phqbvspvojvrgdagjlow.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_vBuemEyfJgNhddyDOAwcgg_MJqm9t1O';


/* =========================================================
   CREATE SUPABASE CLIENT
   ========================================================= */

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================================================
   TEST DATABASE CONNECTION
   ========================================================= */

async function testSupabaseConnection() {

  try {

    const { data, error } = await supabaseClient
      .from('workers')
      .select('id')
      .limit(1);

    if (error) {

      console.error(
        'TUX POS — Supabase connection error:',
        error
      );

      return {
        success: false,
        error: error.message
      };

    }

    console.log(
      'TUX POS — Supabase connected successfully.',
      data
    );

    return {
      success: true,
      data: data
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
   START CONNECTION TEST
   ========================================================= */

window.addEventListener('DOMContentLoaded', function () {

  testSupabaseConnection();

});