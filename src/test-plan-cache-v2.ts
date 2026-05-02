import { PlanCacheHelper } from './modules/scheduler/utils/plan-cache';

async function test() {
    // Mock NestJS environment variables
    process.env.NODE_ENV = 'development';
    
    const helper = new PlanCacheHelper();
    const guestId = 'test-guest-' + Date.now();
    

    
    try {

        await helper.set(guestId, {
            rawRestaurants: [{ id: '1', name: 'Test Restaurant' }],
            orderedPlan: [],
            mealBudgetConfig: { lunch: 100000, dinner: 200000 },
            preferences: { spicy: true },
            usedCategories: []
        });

        

        const data = await helper.get(guestId);
        if (data) {

        } else {

        }
        

        await helper.saveDayScores(guestId, 0, [{ id: '1', score: 10 }]);

        

        const scores = await helper.getDayScores(guestId, 0);
        if (scores) {

        } else {

        }
        
    } catch (error) {

    }
}

test();
