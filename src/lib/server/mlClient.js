import { env } from '$env/dynamic/private';

const ML_SERVICE_URL = env.ML_SERVICE_URL || 'http://localhost:8000/api/v1';

/**
 * Shared API client for contacting the self-hosted Python FastAPI ML microservice.
 * This runs entirely server-side to hide the FastAPI service from direct public browser access.
 */
export const mlClient = {
  /**
   * Helper to perform POST requests to FastAPI endpoints
   */
  async post(endpoint, data = {}) {
    const url = `${ML_SERVICE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ ML Service API Error [${response.status}] for ${endpoint}:`, errText);
        throw new Error(`ML Service responded with status ${response.status}: ${errText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Network error contacting ML service at ${url}:`, error);
      throw error;
    }
  },

  /**
   * Helper to perform GET requests to FastAPI endpoints
   */
  async get(endpoint) {
    const url = `${ML_SERVICE_URL}${endpoint}`;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ ML Service API Error [${response.status}] for ${endpoint}:`, errText);
        throw new Error(`ML Service responded with status ${response.status}: ${errText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Network error contacting ML service at ${url}:`, error);
      throw error;
    }
  },

  // --- Module Enpoints ---

  /**
   * Module 1: Predict food quantity needed for a dish
   */
  async predictFoodQuantity(eventId, dishId, guestCount) {
    return this.post('/predict/food-quantity', {
      event_id: eventId,
      dish_id: dishId,
      guest_count: guestCount
    });
  },

  /**
   * Module 2: Generate optimized menu within budget
   */
  async generateMenu(budgetValue, guestCount, themeName) {
    return this.post('/optimize/menu-generation', {
      budget: budgetValue,
      guest_count: guestCount,
      theme: themeName
    });
  },

  /**
   * Module 3: Calculate ingredient reorder points and purchase options
   */
  async calculateIngredientPurchasing(ingredientsList) {
    return this.post('/optimize/ingredient-purchasing', {
      ingredients: ingredientsList
    });
  },

  /**
   * Module 4: Solve prep schedule using OR-Tools CP-SAT
   */
  async generateKitchenSchedule(eventId) {
    return this.post('/optimize/kitchen-schedule', {
      event_id: eventId
    });
  },

  /**
   * Module 5: Recommends staff counts and matches rosters using Hungarian algorithm
   */
  async optimizeStaffAssignment(eventId) {
    return this.post('/optimize/staff-assignment', {
      event_id: eventId
    });
  },

  /**
   * Module 6: Analyze post-event profitability and flags anomalies via Isolation Forest
   */
  async analyzeProfitAnomaly(eventId) {
    return this.post('/analyze/profit', {
      event_id: eventId
    });
  },

  /**
   * Module 7: Recommends customer dishes/themes using content similarity
   */
  async recommendCustomerPreferences(customerId) {
    return this.post('/recommend/customer-preferences', {
      customer_id: customerId
    });
  },

  /**
   * Module 8: Predict event risks (weather, staff, outdoor conflicts)
   */
  async predictEventRisk(eventId) {
    return this.post('/predict/event-risk', {
      event_id: eventId
    });
  },

  /**
   * Module 9: Forecast sales/revenue using Facebook Prophet / SARIMA
   */
  async fetchSalesForecast() {
    return this.get('/predict/sales-forecast');
  }
};
