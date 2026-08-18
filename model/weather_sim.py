"""
Weather & soil simulator — AgriForecast
Seasons: Rainy (monsoon/Kharif), Winter (Rabi), Summer, Whole Year
"""
import hashlib, math

STATE_CLIMATE = {
    "Punjab":         {"temp": 24, "humidity": 55, "sun": 8.2, "wind": 10, "soils": ["Alluvial", "Loamy"]},
    "Haryana":        {"temp": 25, "humidity": 52, "sun": 8.4, "wind": 11, "soils": ["Alluvial", "Sandy Loam"]},
    "Uttar Pradesh":  {"temp": 26, "humidity": 62, "sun": 7.6, "wind": 9,  "soils": ["Alluvial", "Clay Loam"]},
    "Bihar":          {"temp": 26, "humidity": 68, "sun": 7.1, "wind": 8,  "soils": ["Alluvial", "Silty"]},
    "West Bengal":    {"temp": 27, "humidity": 76, "sun": 6.4, "wind": 9,  "soils": ["Alluvial", "Laterite"]},
    "Maharashtra":    {"temp": 27, "humidity": 58, "sun": 7.9, "wind": 13, "soils": ["Black (Regur)", "Red"]},
    "Karnataka":      {"temp": 26, "humidity": 60, "sun": 7.8, "wind": 12, "soils": ["Red", "Black (Regur)"]},
    "Tamil Nadu":     {"temp": 29, "humidity": 65, "sun": 8.0, "wind": 14, "soils": ["Red", "Laterite"]},
    "Andhra Pradesh": {"temp": 29, "humidity": 64, "sun": 8.1, "wind": 12, "soils": ["Red", "Black (Regur)"]},
    "Gujarat":        {"temp": 28, "humidity": 54, "sun": 8.6, "wind": 14, "soils": ["Black (Regur)", "Sandy"]},
    "Madhya Pradesh": {"temp": 27, "humidity": 56, "sun": 7.9, "wind": 10, "soils": ["Black (Regur)", "Red"]},
    "Rajasthan":      {"temp": 29, "humidity": 38, "sun": 9.1, "wind": 13, "soils": ["Sandy", "Sandy Loam"]},
    "Kerala":         {"temp": 27, "humidity": 82, "sun": 5.8, "wind": 8,  "soils": ["Laterite", "Alluvial"]},
    "Assam":          {"temp": 25, "humidity": 81, "sun": 5.5, "wind": 6,  "soils": ["Alluvial", "Laterite"]},
    "Odisha":         {"temp": 28, "humidity": 73, "sun": 6.9, "wind": 10, "soils": ["Laterite", "Alluvial"]},
    "Telangana":      {"temp": 28, "humidity": 58, "sun": 8.0, "wind": 11, "soils": ["Red", "Black (Regur)"]},
}

# Rainy = monsoon/Kharif, Winter = Rabi, Summer, Whole Year
SEASON_ADJUST = {
    "Rainy":      {"dtemp": +2.0,  "hum_mult": 1.35, "rain_mult": 1.8,  "sun_mult": 0.75, "wind_mult": 1.15,
                   "label": "Rainy Season", "icon": "🌧️", "months": "Jun–Sep"},
    "Winter":     {"dtemp": -5.5,  "hum_mult": 0.72, "rain_mult": 0.28, "sun_mult": 1.10, "wind_mult": 0.80,
                   "label": "Winter Season", "icon": "❄️", "months": "Oct–Feb"},
    "Summer":     {"dtemp": +5.5,  "hum_mult": 0.62, "rain_mult": 0.18, "sun_mult": 1.30, "wind_mult": 1.08,
                   "label": "Summer Season", "icon": "☀️", "months": "Mar–May"},
    "Whole Year": {"dtemp":  0.0,  "hum_mult": 1.00, "rain_mult": 1.00, "sun_mult": 1.00, "wind_mult": 1.00,
                   "label": "Whole Year",    "icon": "🗓️", "months": "Jan–Dec"},
}

SEASON_RAINFALL_BASE = {
    "Rainy": 900, "Winter": 110, "Summer": 55, "Whole Year": 900
}

def _seed(*parts):
    return int(hashlib.md5("|".join(parts).encode()).hexdigest()[:8], 16)

def _jitter(seed, idx, scale):
    return math.sin(seed * 0.0000001 * (idx + 7)) * scale

def get_weather_profile(state, district, season, base_rainfall_mm=None):
    base = STATE_CLIMATE.get(state, {"temp":27,"humidity":60,"sun":7.5,"wind":10,"soils":["Loamy","Alluvial"]})
    adj  = SEASON_ADJUST.get(season, SEASON_ADJUST["Whole Year"])
    seed = _seed(state, district, season)

    temp     = base["temp"] + adj["dtemp"] + _jitter(seed, 1, 1.8)
    humidity = max(12, min(98, base["humidity"] * adj["hum_mult"] + _jitter(seed, 2, 6)))
    sunlight = max(3.0, base["sun"] * adj["sun_mult"] + _jitter(seed, 3, 0.6))
    wind     = max(2, base["wind"] * adj["wind_mult"] + _jitter(seed, 4, 2.5))
    rainfall = base_rainfall_mm if base_rainfall_mm is not None else \
               max(8, SEASON_RAINFALL_BASE[season] * (base["humidity"]/60) + _jitter(seed, 5, 80))

    primary_pct = 55 + (seed % 30)
    soils = base["soils"]
    soil_mix = [
        {"type": soils[0], "pct": primary_pct},
        {"type": soils[1] if len(soils) > 1 else "Loamy", "pct": 100 - primary_pct},
    ]
    wind_dirs = [0, 45, 90, 135, 180, 225, 270, 315]
    wind_dir  = wind_dirs[seed % 8]

    return {
        "temperature_c": round(temp, 1),
        "humidity_pct":  round(humidity, 1),
        "rainfall_mm":   round(rainfall, 1),
        "sunlight_hrs":  round(sunlight, 1),
        "wind_kmph":     round(wind, 1),
        "wind_dir_deg":  wind_dir,
        "soil_mix":      soil_mix,
        "season_label":  adj["label"],
        "season_icon":   adj["icon"],
        "season_months": adj["months"],
    }

def get_seven_day_outlook(state, district, season):
    profile = get_weather_profile(state, district, season)
    day_names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    days = []
    for i in range(7):
        seed = _seed(state, district, season, str(i))
        wobble_t = math.sin(seed * 0.000001) * 2.5
        wobble_h = math.cos(seed * 0.0000013) * 9
        wobble_r = abs(math.sin(seed * 0.0000017)) * profile["rainfall_mm"] * 0.20
        days.append({
            "day": i + 1,
            "day_label": day_names[i],
            "temp_high":     round(profile["temperature_c"] + wobble_t, 1),
            "temp_low":      round(profile["temperature_c"] + wobble_t - 5.5, 1),
            "humidity_pct":  round(max(12, min(98, profile["humidity_pct"] + wobble_h)), 1),
            "rain_mm":       round(max(0, profile["rainfall_mm"] / 7 + wobble_r), 1),
        })
    return days
