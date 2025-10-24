/**
 * Test Script for TradingView Service
 * Tests basic functionality without database
 */

const TradingViewCollector = require('./collector');

console.log('🧪 TradingView Service Test\n');

async function runTests() {
  // Initialize collector
  const collector = new TradingViewCollector({
    // No auth tokens for basic test
  });

  collector.initialize();

  console.log('✅ Collector initialized\n');

  // Test 1: Search for symbols
  console.log('📝 Test 1: Search for symbols');
  try {
    const results = await collector.searchSymbols('CBOT');
    console.log(`✅ Found ${results.length} symbols`);
    console.log('   First 3 results:');
    results.slice(0, 3).forEach(r => {
      console.log(`   - ${r.symbol}: ${r.description}`);
    });
  } catch (err) {
    console.error('❌ Search test failed:', err.message);
  }

  console.log('');

  // Test 2: Subscribe to a symbol
  console.log('📝 Test 2: Subscribe to 10Y T-Note futures');
  try {
    const subscriptionId = collector.subscribeToSymbol('CBOT:ZN1!', {
      timeframe: '5',
      indicators: [],
      saveToDb: false, // Don't save to DB in test
      onUpdate: (priceData) => {
        console.log(`   📊 Price update: $${priceData.close.toFixed(2)}`);
      }
    });
    console.log(`✅ Subscribed: ${subscriptionId}`);
  } catch (err) {
    console.error('❌ Subscribe test failed:', err.message);
  }

  console.log('');

  // Test 3: Wait for some updates
  console.log('📝 Test 3: Waiting for 10 seconds of price updates...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test 4: Get latest price
  console.log('\n📝 Test 4: Get latest price');
  const subscriptionId = 'CBOT:ZN1!_5';
  const price = collector.getLatestPrice(subscriptionId);
  if (price) {
    console.log('✅ Latest price retrieved:');
    console.log(`   Close: $${price.close.toFixed(2)}`);
    console.log(`   High:  $${price.high.toFixed(2)}`);
    console.log(`   Low:   $${price.low.toFixed(2)}`);
    console.log(`   Volume: ${price.volume.toFixed(0)}`);
  } else {
    console.log('⚠️  No price data available yet');
  }

  console.log('');

  // Test 5: List subscriptions
  console.log('📝 Test 5: List active subscriptions');
  const subscriptions = collector.getSubscriptions();
  console.log(`✅ Active subscriptions: ${subscriptions.length}`);
  subscriptions.forEach(sub => {
    console.log(`   - ${sub.id}: ${sub.description || 'Loading...'}`);
  });

  console.log('');

  // Cleanup
  console.log('🧹 Cleaning up...');
  await collector.shutdown();

  console.log('\n✅ All tests completed!');
  console.log('\nNext steps:');
  console.log('  1. Set up database: psql -d interest_rates_db -f schema.sql');
  console.log('  2. Configure .env file');
  console.log('  3. Run: npm start');
  console.log('  4. Test with: curl http://localhost:3001/health');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

