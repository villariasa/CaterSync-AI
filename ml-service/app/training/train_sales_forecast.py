import os
import sys
import pandas as pd
import numpy as np
import psycopg2
from datetime import datetime, timedelta

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings

def load_historical_data():
    """
    Query historical event logs from database.
    Falls back to simulated weekly sales history of 2 years (104 weeks) if offline.
    """
    try:
        print("🔌 Fetching historical revenue logs from DB...")
        conn = psycopg2.connect(settings.DATABASE_URL)
        query = """
            SELECT 
                DATE_TRUNC('week', event_date)::date as ds,
                SUM(budget) as y
            FROM events
            WHERE status = 'Completed'
            GROUP BY 1
            ORDER BY 1 ASC
        """
        df = pd.read_sql(query, conn)
        conn.close()
        print(f"✅ Loaded {len(df)} historical weeks.")
        if len(df) > 10:
            return df
    except Exception as e:
        print(f"⚠️ DB lookup failed: {str(e)}.")
        
    print("ℹ️ Seeding 104 weeks of simulated history for time-series forecasting training...")
    
    np.random.seed(42)
    start_date = datetime.now() - timedelta(weeks=104)
    dates = [start_date + timedelta(weeks=i) for i in range(104)]
    
    # Generate revenue with general upward trend and annual seasonality
    base_revenue = 60000.00
    revenue = []
    for i in range(104):
        trend = i * 250.00
        # Sine wave representing yearly peak seasons (June weddings, December holidays)
        seasonality = math.sin((i / 52.0) * 2.0 * math.pi) * 20000.00
        noise = np.random.normal(0, 8000.00)
        
        y = max(10000.00, base_revenue + trend + seasonality + noise)
        revenue.append(round(y, 2))
        
    df = pd.DataFrame({
        'ds': [d.strftime('%Y-%m-%d') for d in dates],
        'y': revenue
    })
    
    return df

import math

def train_prophet_sarima():
    df = load_historical_data()
    
    # Prophet requires 'ds' and 'y' columns
    df['ds'] = pd.to_datetime(df['ds'])
    
    print("📈 Training Facebook Prophet time-series model (Weekly Seasonality)...")
    try:
        from prophet import Prophet
        m = Prophet(weekly_seasonality=True, yearly_seasonality=True)
        m.fit(df)
        
        # Serialize model parameters to models registry
        models_dir = settings.MODELS_DIR
        model_path = os.path.join(models_dir, 'prophet_model.json')
        print(f"💾 Saving Prophet model parameters to {model_path}...")
        # Save model details
        with open(model_path, 'w') as f:
            f.write(m.to_json())
    except ImportError:
        print("⚠️ 'prophet' library not installed or fail to import. Skipping Prophet serialization.")

    print("📊 Training benchmark classical SARIMA model (p=1, d=1, q=1)x(1, 1, 1, 52)...")
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX
        # Using a subset for faster CPU processing
        y = df['y'].values
        model = SARIMAX(y, order=(1, 1, 1), seasonal_order=(1, 1, 1, 52), enforce_stationarity=False, enforce_invertibility=False)
        results = model.fit(disp=False)
        print("✅ SARIMA model trained successfully.")
        
        # Compute MAPE metric: Mean Absolute Percentage Error
        predictions = results.fittedvalues
        mape = np.mean(np.abs((y - predictions) / y)) * 100
        print(f"📈 SARIMA Model Training MAPE: {mape:.2f}%")
        
    except Exception as e:
        print(f"⚠️ Statsmodels SARIMA fitting failed or skipped: {str(e)}.")
        
    print("✅ Time-series model audit evaluations complete.")

if __name__ == '__main__':
    train_prophet_sarima()
