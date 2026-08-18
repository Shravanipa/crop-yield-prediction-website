"""
Trains a Random Forest Regressor to predict crop yield (kg/hectare) from
state, district, season, crop, area sown, and rainfall.

Saves:
- model/yield_model.joblib       (trained pipeline: preprocessing + RF)
- model/metadata.joblib          (label lists, feature importances, metrics)
"""
import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

df = pd.read_csv(os.path.join(BASE_DIR, "data", "crop_production.csv"))

FEATURES_CAT = ["State_Name", "District_Name", "Season", "Crop"]
FEATURES_NUM = ["Area", "Rainfall_mm", "Crop_Year"]
TARGET = "Yield_kg_per_ha"

X = df[FEATURES_CAT + FEATURES_NUM]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

preprocessor = ColumnTransformer(transformers=[
    ("cat", OneHotEncoder(handle_unknown="ignore"), FEATURES_CAT),
    ("num", StandardScaler(), FEATURES_NUM),
])

model = Pipeline(steps=[
    ("preprocess", preprocessor),
    ("rf", RandomForestRegressor(
        n_estimators=200,
        max_depth=18,
        min_samples_leaf=3,
        n_jobs=-1,
        random_state=42,
    )),
])

print("Training Random Forest Regressor...")
model.fit(X_train, y_train)

pred = model.predict(X_test)
r2 = r2_score(y_test, pred)
mae = mean_absolute_error(y_test, pred)
rmse = np.sqrt(mean_squared_error(y_test, pred))

print(f"R^2:  {r2:.4f}")
print(f"MAE:  {mae:.1f} kg/ha")
print(f"RMSE: {rmse:.1f} kg/ha")

joblib.dump(model, os.path.join(BASE_DIR, "model", "yield_model.joblib"))

metadata = {
    "states": sorted(df.State_Name.unique().tolist()),
    "state_districts": {s: sorted(df[df.State_Name == s].District_Name.unique().tolist()) for s in df.State_Name.unique()},
    "seasons": sorted(df.Season.unique().tolist()),
    "crops": sorted(df.Crop.unique().tolist()),
    "state_season_crops": {
        s: {
            se: sorted(df[(df.State_Name == s) & (df.Season == se)].Crop.unique().tolist())
            for se in df[df.State_Name == s].Season.unique()
        }
        for s in df.State_Name.unique()
    },
    "metrics": {"r2": round(r2, 4), "mae": round(mae, 1), "rmse": round(rmse, 1), "n_train": len(X_train), "n_test": len(X_test)},
    "year_range": [int(df.Crop_Year.min()), int(df.Crop_Year.max())],
    "area_typical_range": {
        c: [float(df[df.Crop == c].Area.quantile(0.1)), float(df[df.Crop == c].Area.quantile(0.9))]
        for c in df.Crop.unique()
    },
    "rainfall_typical": {
        s: {se: float(df[(df.State_Name == s) & (df.Season == se)].Rainfall_mm.mean()) for se in df[df.State_Name == s].Season.unique()}
        for s in df.State_Name.unique()
    },
}
joblib.dump(metadata, os.path.join(BASE_DIR, "model", "metadata.joblib"))

print("\nSaved model and metadata.")
print("States:", len(metadata["states"]), "| Crops:", len(metadata["crops"]))
