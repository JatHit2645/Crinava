
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { CricketDataService } from '../src/services/cricketData';

async function testConnection() {
  console.log('Testing Supabase Connection...');
  try {
    const matches = await CricketDataService.getRecentMatches();
    console.log('Successfully connected to Supabase!');
    console.log(`Found ${matches?.length || 0} matches.`);
    if (matches && matches.length > 0) {
      console.log('First match sample:', JSON.stringify(matches[0], null, 2));
    }
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
  }
}

testConnection();
