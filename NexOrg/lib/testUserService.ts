import { supabase } from './supabase';

/**
 * Simple test function to check what tables are accessible
 */
export async function testDatabaseAccess() {
  console.log('Testing database access...');
  
  // Test 1: Check current user first
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Cannot get current user:', error);
    } else {
      console.log('✅ Current user:', user?.email, 'ID:', user?.id);
    }
  } catch (err) {
    console.error('❌ Exception getting current user:', err);
  }

  // Test 2: List all available tables
  try {
    const { data, error } = await supabase.rpc('get_schema_tables');
    if (error) {
      console.log('Cannot list tables (expected):', error.message);
    } else {
      console.log('Available tables:', data);
    }
  } catch (err) {
    console.log('Cannot list tables (expected)');
  }
  
  // Test 3: Check if we can access the profiles table at all
  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Cannot access profiles table:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    } else {
      console.log('✅ Profiles table accessible, count:', count);
    }
  } catch (err) {
    console.error('❌ Exception accessing users table:', err);
  }

  // Test 4: Try to get just one row from profiles
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .limit(1);
    
    if (error) {
      console.error('❌ Cannot select from profiles table:', error);
    } else {
      console.log('✅ Successfully selected from profiles table:', data);
    }
  } catch (err) {
    console.error('❌ Exception selecting from profiles table:', err);
  }

  // Test 3: Check current user
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Cannot get current user:', error);
    } else {
      console.log('✅ Current user:', user?.email);
    }
  } catch (err) {
    console.error('❌ Exception getting current user:', err);
  }
}
