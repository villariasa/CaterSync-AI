import os
import sys
import pandas as pd
import numpy as np
import psycopg2
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
import joblib

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings

def load_data():
    """
    Connects to database to load consumption data.
    If database fails, returns simulated training dataset of 500 records.
    """
    try:
        print("🔌 Connecting to database for training data...")
        conn = psycopg2.connect(settings.DATABASE_URL)
        query = """
            SELECT 
                cl.guests,
                e.event_type,
                e.theme,
                e.is_outdoor,
                cl.planned_qty,
                cl.actual_qty_consumed
            FROM consumption_logs cl
            JOIN events e ON cl.event_id = e.id
        """
        df = pd.read_sql(query, conn)
        conn.close()
        print(f"✅ Loaded {len(df)} records from database.")
        if len(df) > 10:
            return df
    except Exception as e:
        print(f"⚠️ Database connection failed or empty table: {str(e)}.")
        
    print("ℹ️ Simulating 500 training records for XGBoost Model bootstrapping...")
    
    # Generate mock training dataset
    np.random.seed(42)
    n_samples = 500
    
    guests = np.random.randint(30, 300, n_samples)
    event_types = np.random.choice(['Wedding', 'Corporate Seminar', 'Birthday Party', 'Social Gathering'], n_samples)
    themes = np.random.choice(['Modern Elegant', 'Rustic Barn', 'Tropical Luau', 'Corporate Minimalist'], n_samples)
    is_outdoor = np.random.choice([True, False], n_samples, p=[0.4, 0.6])
    
    # Base planned quantity: 0.40 kg per guest
    planned_qty = guests * 0.40
    
    # Actual consumed has dependency on type, outdoor, and noise
    actual_qty_consumed = []
    for i in range(n_samples):
        mult = 0.40
        if event_types[i] == 'Wedding':
            mult = 0.48
        elif event_types[i] == 'Corporate Seminar':
            mult = 0.34
            
        if is_outdoor[i]:
            mult += 0.04
            
        # Add random noise
        qty = guests[i] * mult * np.random.normal(1.0, 0.08)
        actual_qty_consumed.append(max(0, qty))
        
    df = pd.DataFrame({
        'guests': guests,
        'event_type': event_types,
        'theme': themes,
        'is_outdoor': is_outdoor.astype(int),
        'planned_qty': planned_qty,
        'actual_qty_consumed': actual_qty_consumed
    })
    
    return df

def train():
    df = load_data()
    
    # Preprocess categorical features using dummy encoding (one-hot)
    # We will save the columns layout so that the prediction step matches the columns precisely
    categorical_cols = ['event_type', 'theme']
    df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=False)
    
    X = df_encoded.drop(columns=['actual_qty_consumed'])
    y = df_encoded['actual_qty_consumed']
    
    # Save column names for matching during online prediction
    feature_names = list(X.columns)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("🚀 Training XGBoost Regressor model...")
    model = XGBRegressor(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=4,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Log metrics
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    print(f"📈 Model R^2 Score - Train: {train_score:.4f} | Test: {test_score:.4f}")
    
    # Bundle the model with features list
    model_bundle = {
        'model': model,
        'features': feature_names,
        'categorical_cols': categorical_cols
    }
    
    # Save bundle to models folder
    models_dir = settings.MODELS_DIR
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'food_qty_xgboost.pkl')
    
    print(f"💾 Saving serialized model bundle to {model_path}...")
    joblib.dump(model_bundle, model_path)
    print("✅ Model training complete.")

if __name__ == '__main__':
    train()
