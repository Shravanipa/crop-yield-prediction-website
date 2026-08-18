"""
Generates a realistic synthetic Crop Production dataset for India.
Seasons renamed: Rainy (was Kharif), Winter (was Rabi), Summer, Whole Year
"""
import os
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

rng = np.random.default_rng(42)

STATES = {
    "Punjab":        {"districts": ["Ludhiana", "Amritsar", "Patiala", "Bathinda", "Jalandhar"], "rain_base": 650,  "rain_var": 80,  "irrigation": 0.97},
    "Haryana":       {"districts": ["Hisar", "Karnal", "Rohtak", "Sirsa", "Panipat"],             "rain_base": 600,  "rain_var": 90,  "irrigation": 0.93},
    "Uttar Pradesh": {"districts": ["Meerut", "Lucknow", "Kanpur Nagar", "Varanasi", "Agra"],     "rain_base": 950,  "rain_var": 150, "irrigation": 0.75},
    "Bihar":         {"districts": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga"],    "rain_base": 1150, "rain_var": 180, "irrigation": 0.55},
    "West Bengal":   {"districts": ["Bardhaman", "Hooghly", "Nadia", "Murshidabad", "Malda"],     "rain_base": 1450, "rain_var": 200, "irrigation": 0.60},
    "Maharashtra":   {"districts": ["Pune", "Nashik", "Nagpur", "Solapur", "Kolhapur"],           "rain_base": 850,  "rain_var": 300, "irrigation": 0.40},
    "Karnataka":     {"districts": ["Belagavi", "Mysuru", "Ballari", "Tumakuru", "Shivamogga"],   "rain_base": 900,  "rain_var": 280, "irrigation": 0.42},
    "Tamil Nadu":    {"districts": ["Coimbatore", "Thanjavur", "Madurai", "Salem", "Tiruchirappalli"], "rain_base": 950, "rain_var": 200, "irrigation": 0.55},
    "Andhra Pradesh":{"districts": ["Krishna", "Guntur", "East Godavari", "Kurnool", "Chittoor"], "rain_base": 1000, "rain_var": 220, "irrigation": 0.58},
    "Gujarat":       {"districts": ["Ahmedabad", "Surat", "Rajkot", "Vadodara", "Bhavnagar"],     "rain_base": 800,  "rain_var": 350, "irrigation": 0.45},
    "Madhya Pradesh":{"districts": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain"],         "rain_base": 1050, "rain_var": 260, "irrigation": 0.48},
    "Rajasthan":     {"districts": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Udaipur"],           "rain_base": 450,  "rain_var": 200, "irrigation": 0.35},
    "Kerala":        {"districts": ["Thrissur", "Kottayam", "Palakkad", "Alappuzha", "Kannur"],   "rain_base": 2700, "rain_var": 300, "irrigation": 0.50},
    "Assam":         {"districts": ["Kamrup", "Dibrugarh", "Jorhat", "Nagaon", "Barpeta"],        "rain_base": 2200, "rain_var": 250, "irrigation": 0.30},
    "Odisha":        {"districts": ["Cuttack", "Puri", "Ganjam", "Sambalpur", "Balasore"],        "rain_base": 1450, "rain_var": 220, "irrigation": 0.40},
    "Telangana":     {"districts": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"], "rain_base": 950, "rain_var": 230, "irrigation": 0.50},
}

CROPS = {
    "Rice":        {"base": 2500, "rain_sens": 1.3, "seasons": ["Rainy"],            "temp_opt": 28},
    "Wheat":       {"base": 3200, "rain_sens": 0.6, "seasons": ["Winter"],           "temp_opt": 18},
    "Maize":       {"base": 2800, "rain_sens": 0.9, "seasons": ["Rainy", "Winter", "Summer"], "temp_opt": 25},
    "Sugarcane":   {"base": 68000,"rain_sens": 1.0, "seasons": ["Whole Year"],       "temp_opt": 27},
    "Cotton(lint)":{"base": 450,  "rain_sens": 0.7, "seasons": ["Rainy"],            "temp_opt": 28},
    "Jowar":       {"base": 950,  "rain_sens": 0.5, "seasons": ["Rainy", "Winter"], "temp_opt": 27},
    "Bajra":       {"base": 900,  "rain_sens": 0.4, "seasons": ["Rainy"],            "temp_opt": 30},
    "Groundnut":   {"base": 1400, "rain_sens": 0.8, "seasons": ["Rainy", "Winter", "Summer"], "temp_opt": 27},
    "Soyabean":    {"base": 1150, "rain_sens": 0.9, "seasons": ["Rainy"],            "temp_opt": 26},
    "Mustard":     {"base": 1250, "rain_sens": 0.4, "seasons": ["Winter"],           "temp_opt": 17},
    "Gram":        {"base": 1050, "rain_sens": 0.5, "seasons": ["Winter"],           "temp_opt": 20},
    "Tur":         {"base": 800,  "rain_sens": 0.6, "seasons": ["Rainy"],            "temp_opt": 26},
    "Jute":        {"base": 2300, "rain_sens": 1.2, "seasons": ["Rainy"],            "temp_opt": 29},
    "Banana":      {"base": 36000,"rain_sens": 1.0, "seasons": ["Whole Year"],       "temp_opt": 27},
    "Onion":       {"base": 16000,"rain_sens": 0.6, "seasons": ["Winter", "Rainy"], "temp_opt": 22},
    "Potato":      {"base": 19000,"rain_sens": 0.5, "seasons": ["Winter"],           "temp_opt": 19},
    "Moong":       {"base": 700,  "rain_sens": 0.5, "seasons": ["Summer", "Rainy"], "temp_opt": 29},
}

SEASONS = ["Rainy", "Winter", "Summer", "Whole Year"]
YEARS = list(range(2008, 2024))

rows = []
for state, sinfo in STATES.items():
    for district in sinfo["districts"]:
        dist_offset = rng.normal(0, 0.05)
        for year in YEARS:
            year_trend = (year - 2008) * 0.012
            for crop, cinfo in CROPS.items():
                for season in cinfo["seasons"]:
                    season_factor = {"Rainy": 1.0, "Winter": 0.25, "Summer": 0.15, "Whole Year": 1.0}[season]
                    rainfall = max(50, rng.normal(sinfo["rain_base"] * season_factor, sinfo["rain_var"] * season_factor * 0.5 + 20))
                    area = max(50, rng.normal(3500, 1800)) if cinfo["base"] > 5000 else max(80, rng.normal(8000, 4000))
                    irrigation_boost = 0.55 + 0.55 * sinfo["irrigation"]
                    rain_ratio = rainfall / (sinfo["rain_base"] * season_factor + 1e-6)
                    rain_response = 1 - cinfo["rain_sens"] * 0.35 * (rain_ratio - 1) ** 2 + cinfo["rain_sens"] * 0.15 * np.log1p(rain_ratio)
                    rain_response = np.clip(rain_response, 0.35, 1.45)
                    noise = rng.normal(1.0, 0.10)
                    yield_per_ha = cinfo["base"] * irrigation_boost * rain_response * (1 + year_trend) * (1 + dist_offset) * noise
                    yield_per_ha = max(yield_per_ha, cinfo["base"] * 0.15)
                    production = yield_per_ha * area / 1000
                    rows.append({
                        "State_Name": state, "District_Name": district, "Crop_Year": year,
                        "Season": season, "Crop": crop, "Area": round(area, 1),
                        "Rainfall_mm": round(rainfall, 1), "Production": round(production, 2),
                        "Yield_kg_per_ha": round(yield_per_ha, 1),
                    })

df = pd.DataFrame(rows)
out_path = os.path.join(BASE_DIR, "data", "crop_production.csv")
df.to_csv(out_path, index=False)
print(df.shape)
print("\nSeasons:", df.Season.unique().tolist())
print("States:", df.State_Name.nunique(), "| Crops:", df.Crop.nunique())
