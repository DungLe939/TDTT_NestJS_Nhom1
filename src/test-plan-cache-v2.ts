import { PlanCacheHelper } from './modules/scheduler/utils/plan-cache';

async function test() {
    // Mock NestJS environment variables
    process.env.NODE_ENV = 'development';
    
    const helper = new PlanCacheHelper();
    const guestId = 'test-guest-' + Date.now();
    
    console.log('--- Testing PlanCacheHelper (Axios Bypass) ---');
    
    try {
        console.log(`Setting cache for ${guestId}...`);
        await helper.set(guestId, {
            rawRestaurants: [{ id: '1', name: 'Test Restaurant' }],
            orderedPlan: [],
            mealBudgetConfig: { lunch: 100000, dinner: 200000 },
            preferences: { spicy: true },
            usedCategories: []
        });
        console.log('✅ Set successful');
        
        console.log(`Getting cache for ${guestId}...`);
        const data = await helper.get(guestId);
        if (data) {
            console.log('✅ Get successful:', data.rawRestaurants[0].name);
        } else {
            console.log('❌ Get failed: No data found');
        }
        
        console.log(`Updating DayScores for ${guestId}...`);
        await helper.saveDayScores(guestId, 0, [{ id: '1', score: 10 }]);
        console.log('✅ Update DayScores successful');
        
        console.log(`Verifying DayScores for ${guestId}...`);
        const scores = await helper.getDayScores(guestId, 0);
        if (scores) {
            console.log('✅ Get DayScores successful:', scores[0].score);
        } else {
            console.log('❌ Get DayScores failed');
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
    }
}

test();
