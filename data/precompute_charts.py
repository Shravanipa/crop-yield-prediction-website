"""
Pre-computes aggregated views of the dataset for fast chart rendering on the
frontend, and writes them to static/data/*.json so the browser can fetch them
directly without hitting the model on every chart redraw.
"""
import os
import pandas as pd
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

df = pd.read_csv(os.path.join(BASE_DIR, "data", "crop_production.csv"))

# 1) Yield trend by state + season + crop_year (averaged across districts & crops)
trend = (
    df.groupby(["State_Name", "Season", "Crop_Year"])["Yield_kg_per_ha"]
    .mean()
    .round(1)
    .reset_index()
)
trend_nested = {}
for state, g in trend.groupby("State_Name"):
    trend_nested[state] = {}
    for season, g2 in g.groupby("Season"):
        trend_nested[state][season] = {
            "years": g2.Crop_Year.tolist(),
            "yield": g2.Yield_kg_per_ha.tolist(),
        }

with open(os.path.join(BASE_DIR, "static", "data", "state_season_trend.json"), "w") as f:
    json.dump(trend_nested, f)

# 2) Best crop per state+season (avg yield rank) -> for crop recommendation fallback/explanation
best_crop = (
    df.groupby(["State_Name", "Season", "Crop"])["Yield_kg_per_ha"]
    .mean()
    .round(1)
    .reset_index()
)
best_crop_nested = {}
for state, g in best_crop.groupby("State_Name"):
    best_crop_nested[state] = {}
    for season, g2 in g.groupby("Season"):
        ranked = g2.sort_values("Yield_kg_per_ha", ascending=False)
        best_crop_nested[state][season] = [
            {"crop": r.Crop, "avg_yield": r.Yield_kg_per_ha} for r in ranked.itertuples()
        ]

with open(os.path.join(BASE_DIR, "static", "data", "state_season_best_crop.json"), "w") as f:
    json.dump(best_crop_nested, f)

# 3) National crop-wise average yield (for pie/bar comparisons)
crop_avg = df.groupby("Crop")["Yield_kg_per_ha"].mean().round(1).sort_values(ascending=False)
with open(os.path.join(BASE_DIR, "static", "data", "national_crop_avg.json"), "w") as f:
    json.dump(crop_avg.to_dict(), f)

print("Wrote chart JSON files.")
print(list(trend_nested.keys())[:3], "...")
