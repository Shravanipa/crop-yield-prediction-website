"""
AgriForecast v5 — Complete Flask Backend
CIN: U62099PN2023PTC218917
All chart data returned as JSON for canvas rendering — no CDN needed.
"""
import os, sys, io, json, math, re, uuid
from functools import wraps
from datetime import datetime
import joblib, pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash

sys.path.append(os.path.join(os.path.dirname(__file__), "model"))
from weather_sim import get_weather_profile, get_seven_day_outlook

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app      = Flask(__name__)
app.secret_key = os.environ.get("AGRIFORECAST_SECRET_KEY", "agriforecast-dev-secret-change-me")

# ── Load model ───────────────────────────────────────────────────────────────
model    = joblib.load(os.path.join(BASE_DIR, "model", "yield_model.joblib"))
metadata = joblib.load(os.path.join(BASE_DIR, "model", "metadata.joblib"))

# ── Lightweight auth (JSON file user store — no external DB required) ───────
USERS_PATH = os.path.join(BASE_DIR, "data", "users.json")
EMAIL_RE   = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _load_users():
    if not os.path.exists(USERS_PATH):
        return {}
    try:
        with open(USERS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}

def _save_users(users):
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    with open(USERS_PATH, "w") as f:
        json.dump(users, f, indent=2)

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_email"):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)
    return wrapped

@app.context_processor
def inject_user():
    return {"current_user_name": session.get("user_name"), "is_authenticated": bool(session.get("user_email"))}

def api_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_email"):
            return jsonify({"error": "Please log in to use the prediction engine.", "login_required": True}), 401
        return view(*args, **kwargs)
    return wrapped

STATE_COORDS = {
    "Punjab":[31.1,75.6],"Haryana":[29.2,76.3],"Rajasthan":[26.9,73.8],
    "Gujarat":[22.7,71.6],"Maharashtra":[19.5,75.7],"Madhya Pradesh":[23.6,78.6],
    "Uttar Pradesh":[27.0,80.7],"Bihar":[25.6,85.7],"West Bengal":[23.8,87.5],
    "Assam":[26.4,92.9],"Odisha":[20.6,84.8],"Telangana":[18.1,79.2],
    "Andhra Pradesh":[15.9,79.7],"Karnataka":[15.3,75.7],"Kerala":[10.5,76.3],
    "Tamil Nadu":[11.1,78.6],
}

# Crops valid per season (mirrors generate_dataset.py)
SEASON_CROPS = {
    "Rainy":      ["Rice","Maize","Cotton(lint)","Jowar","Bajra","Groundnut",
                   "Soyabean","Tur","Jute","Onion","Moong"],
    "Winter":     ["Wheat","Maize","Mustard","Gram","Potato","Onion","Groundnut","Jowar"],
    "Summer":     ["Maize","Groundnut","Moong"],
    "Whole Year": ["Sugarcane","Banana"],
}
ALL_CROPS = ["Rice","Wheat","Maize","Sugarcane","Cotton(lint)","Jowar","Bajra",
             "Groundnut","Soyabean","Mustard","Gram","Tur","Jute","Banana","Onion","Potato","Moong"]

def _predict_safe(X):
    try:
        return [max(0.0, float(v)) for v in model.predict(X)]
    except Exception:
        return [0.0] * len(X)

def _make_rows(state, district, season, crop, areas, rains, years):
    return pd.DataFrame([{
        "State_Name":state,"District_Name":district,"Season":season,
        "Crop":crop,"Area":a,"Rainfall_mm":r,"Crop_Year":y
    } for a,r,y in zip(areas,rains,years)])

# ── Public marketing home page ────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("home.html",
        states=metadata["states"],
        metrics=metadata["metrics"],
        year_range=metadata["year_range"])

# ── Auth: Access Portal (Create Account / Secure Login) ──────────────────────
@app.route("/login", methods=["GET"])
def login():
    if session.get("user_email"):
        return redirect(url_for("dashboard"))
    return render_template("login.html", active_tab=request.args.get("tab", "login"))

@app.route("/signup", methods=["POST"])
def signup():
    name     = (request.form.get("name") or "").strip()
    email    = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    users = _load_users()
    error = None
    if not name or len(name) < 2:
        error = "Please enter your full name."
    elif not EMAIL_RE.match(email):
        error = "Please enter a valid email address."
    elif len(password) < 6:
        error = "Password must be at least 6 characters."
    elif email in users:
        error = "An account with this email already exists — please log in instead."
    if error:
        return render_template("login.html", active_tab="signup",
                                signup_error=error, signup_name=name, signup_email=email)
    users[email] = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "password_hash": generate_password_hash(password),
        "created_at": datetime.utcnow().isoformat(timespec="seconds"),
    }
    _save_users(users)
    session["user_email"] = email
    session["user_name"]  = name
    return redirect(url_for("welcome"))

@app.route("/signin", methods=["POST"])
def signin():
    email    = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    users = _load_users()
    user  = users.get(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return render_template("login.html", active_tab="login",
                                login_error="Incorrect email or password. Please try again.",
                                login_email=email)
    session["user_email"] = email
    session["user_name"]  = user["name"]
    nxt = request.form.get("next") or url_for("welcome")
    return redirect(nxt)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

# ── Post-login home / hub selector ───────────────────────────────────────────
@app.route("/welcome")
@login_required
def welcome():
    return render_template("welcome.html",
        states=metadata["states"], metrics=metadata["metrics"], year_range=metadata["year_range"])

# ── Analytics Hub — the working ML dashboard ─────────────────────────────────
@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html",
        states=metadata["states"],
        metrics=metadata["metrics"],
        year_range=metadata["year_range"])

# ── Dropdowns ─────────────────────────────────────────────────────────────────
@app.route("/api/states")
@api_login_required
def api_states():
    return jsonify({"states": metadata["states"], "coords": STATE_COORDS})

@app.route("/api/districts/<state>")
@api_login_required
def api_districts(state):
    return jsonify({"districts": metadata["state_districts"].get(state, [])})

@app.route("/api/seasons")
@api_login_required
def api_seasons():
    return jsonify({"seasons": metadata["seasons"]})

@app.route("/api/crops/<state>/<season>")
@api_login_required
def api_crops(state, season):
    # Return only crops valid for this season
    season_valid = SEASON_CROPS.get(season, ALL_CROPS)
    # Intersect with what's in the model metadata for this state+season
    meta_crops = metadata.get("state_season_crops",{}).get(state,{}).get(season, season_valid)
    crops = [c for c in season_valid if c in meta_crops] or season_valid
    return jsonify({"crops": sorted(set(crops))})

# ── Weather ───────────────────────────────────────────────────────────────────
@app.route("/api/weather")
@api_login_required
def api_weather():
    state   = request.args.get("state")
    district= request.args.get("district","")
    season  = request.args.get("season","Rainy")
    if not state:
        return jsonify({"error":"state required"}), 400
    if not district:
        district = (metadata["state_districts"].get(state) or [""])[0]
    rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season)
    profile = get_weather_profile(state, district, season, base_rainfall_mm=rain)
    outlook = get_seven_day_outlook(state, district, season)
    return jsonify({"state":state,"district":district,"season":season,
                    "current":profile,"outlook_7day":outlook})

# ── Predict ───────────────────────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
@api_login_required
def api_predict():
    p = request.get_json(force=True)
    for k in ["state","district","season","crop","area"]:
        if not p.get(k) and p.get(k) != 0:
            return jsonify({"error":f"Missing: {k}"}), 400
    state    = p["state"]
    district = p["district"]
    season   = p["season"]
    crop     = p["crop"]
    try:   area = float(p["area"])
    except: return jsonify({"error":"area must be a number"}), 400
    rain = p.get("rainfall")
    if rain in (None,"","auto"):
        rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    else:
        try:    rain = float(rain)
        except: rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    year = int(p.get("year", metadata["year_range"][1]))
    X = _make_rows(state, district, season, crop, [area], [float(rain)], [year])
    preds = _predict_safe(X)
    pred  = preds[0]
    total = pred * area / 1000.0
    # Confidence from tree variance
    try:
        rf  = model.named_steps["rf"]
        Xt  = model.named_steps["preprocess"].transform(X)
        trees = [max(0.0,float(t.predict(Xt)[0])) for t in rf.estimators_]
        std   = float(np.std(trees))
        lo, hi = max(0.0, pred-1.64*std), pred+1.64*std
    except Exception:
        std=0.0; lo=pred*0.82; hi=pred*1.18
    return jsonify({
        "predicted_yield_kg_per_ha": round(pred,1),
        "predicted_total_production_tonnes": round(total,3),
        "confidence_interval_90": [round(lo,1), round(hi,1)],
        "std_dev": round(std,1),
        "inputs_used": {
            "state":state,"district":district,"season":season,"crop":crop,
            "area_ha":area,"rainfall_mm":round(float(rain),1),"crop_year":year
        },
    })

# ── Recommend — season-aware, scored by model ─────────────────────────────────
@app.route("/api/recommend", methods=["POST"])
@api_login_required
def api_recommend():
    p = request.get_json(force=True)
    state    = p.get("state"); district = p.get("district"); season = p.get("season")
    if not all([state, district, season]):
        return jsonify({"error":"state, district, season required"}), 400
    area = float(p.get("area",1000))
    rain = float(p.get("rainfall") or
                 metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800))
    year = int(p.get("year", metadata["year_range"][1]))
    # Only use crops that are valid for the selected season
    crops = SEASON_CROPS.get(season, ALL_CROPS)
    meta_crops = metadata.get("state_season_crops",{}).get(state,{}).get(season, crops)
    crops = [c for c in crops if c in meta_crops] or crops
    if not crops:
        crops = ALL_CROPS
    n = len(crops)
    X = _make_rows(state, district, season, crops[0],
                   [area]*n, [rain]*n, [year]*n)
    # Overwrite crop column with all crops
    X["Crop"] = crops
    preds = _predict_safe(X)
    ranking = sorted(
        [{"crop":c,"predicted_yield_kg_per_ha":round(v,1)} for c,v in zip(crops,preds)],
        key=lambda r: r["predicted_yield_kg_per_ha"], reverse=True
    )
    return jsonify({
        "state":state,"district":district,"season":season,
        "ranking":ranking,
        "season_crops_only": True,
        "note": f"Ranked {len(ranking)} crops valid for {season} season"
    })

# ── Trend ─────────────────────────────────────────────────────────────────────
@app.route("/api/trend")
@api_login_required
def api_trend():
    state  = request.args.get("state")
    season = request.args.get("season")
    path   = os.path.join(BASE_DIR,"static","data","state_season_trend.json")
    with open(path) as f: trend = json.load(f)
    data = trend.get(state,{}).get(season)
    return jsonify(data if data else {"years":[],"yield":[]})

@app.route("/api/national_crop_avg")
@api_login_required
def api_national():
    with open(os.path.join(BASE_DIR,"static","data","national_crop_avg.json")) as f:
        return jsonify(json.load(f))

# ── Sensitivity — real RF model sweeps ────────────────────────────────────────
@app.route("/api/sensitivity", methods=["POST"])
@api_login_required
def api_sensitivity():
    p = request.get_json(force=True)
    for k in ["state","district","season","crop","area"]:
        if not p.get(k) and p.get(k) != 0:
            return jsonify({"error":f"Missing: {k}"}), 400
    state=p["state"]; district=p["district"]; season=p["season"]; crop=p["crop"]
    try:   base_area = float(p["area"])
    except: return jsonify({"error":"area must be numeric"}), 400
    base_rain = p.get("rainfall")
    if base_rain in (None,"","auto"):
        base_rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    else:
        try:    base_rain = float(base_rain)
        except: base_rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    base_rain = float(base_rain)
    year = int(p.get("year", metadata["year_range"][1]))

    # Area sweep
    area_pts = [round(max(base_area*m, 0.5), 2) for m in [0.1,0.25,0.5,0.75,1,1.5,2,3,5,8,12]]
    n = len(area_pts)
    X_area = _make_rows(state,district,season,crop,area_pts,[base_rain]*n,[year]*n)
    area_preds = [round(v,1) for v in _predict_safe(X_area)]

    # Rainfall sweep
    rain_pts = [50,100,200,350,500,700,900,1100,1400,1700,2100,2600]
    m2 = len(rain_pts)
    X_rain = _make_rows(state,district,season,crop,[base_area]*m2,rain_pts,[year]*m2)
    rain_preds = [round(v,1) for v in _predict_safe(X_rain)]

    return jsonify({
        "area_sensitivity":   {"area_ha":area_pts, "predicted_yield_kg_per_ha":area_preds},
        "rainfall_sensitivity":{"rainfall_mm":rain_pts,"predicted_yield_kg_per_ha":rain_preds},
        "base": {"area_ha":base_area,"rainfall_mm":base_rain},
    })

# ── Charts data — JSON for all 6 prediction analysis charts ──────────────────
@app.route("/api/charts/prediction", methods=["POST"])
@api_login_required
def api_prediction_charts():
    p = request.get_json(force=True)
    for k in ["state","district","season","crop","area"]:
        if not p.get(k) and p.get(k) != 0:
            return jsonify({"error":f"Missing: {k}"}), 400
    state    = p["state"]
    district = p["district"]
    season   = p["season"]
    crop     = p["crop"]
    try:   base_area = float(p["area"])
    except: return jsonify({"error":"area must be numeric"}), 400
    base_rain = p.get("rainfall")
    if base_rain in (None,"","auto"):
        base_rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    else:
        try:    base_rain = float(base_rain)
        except: base_rain = metadata.get("rainfall_typical",{}).get(state,{}).get(season, 800)
    base_rain = float(base_rain)
    year = int(p.get("year", metadata["year_range"][1]))

    result = {}

    # 1. Crop comparison — season-valid crops only
    season_crops = SEASON_CROPS.get(season, ALL_CROPS)
    meta_crops   = metadata.get("state_season_crops",{}).get(state,{}).get(season, season_crops)
    valid_crops  = [c for c in season_crops if c in meta_crops] or season_crops
    nc = len(valid_crops)
    Xc = _make_rows(state,district,season,valid_crops[0],[base_area]*nc,[base_rain]*nc,[year]*nc)
    Xc["Crop"] = valid_crops
    c_preds = _predict_safe(Xc)
    crop_data = sorted(zip(valid_crops,c_preds),key=lambda x:x[1],reverse=True)
    result["crop_compare"] = {
        "crops":  [x[0] for x in crop_data],
        "yields": [round(x[1],1) for x in crop_data],
        "selected_crop": crop,
        "season": season,
    }

    # 2. Year-over-year trend
    years = list(range(metadata["year_range"][0], metadata["year_range"][1]+1))
    ny = len(years)
    Xy = _make_rows(state,district,season,crop,[base_area]*ny,[base_rain]*ny,years)
    y_preds = [round(v,1) for v in _predict_safe(Xy)]
    result["year_trend"] = {
        "years":  years,
        "yields": y_preds,
        "crop":   crop,
        "district": district,
        "season": season,
    }

    # 3. Season comparison — same crop all 4 seasons
    all_seasons = metadata.get("seasons",["Rainy","Winter","Summer","Whole Year"])
    s_preds = []
    s_labels = []
    for s in all_seasons:
        r_s = metadata.get("rainfall_typical",{}).get(state,{}).get(s, 400)
        # Only predict if crop is valid for this season
        if crop in SEASON_CROPS.get(s, ALL_CROPS):
            Xs = _make_rows(state,district,s,crop,[base_area],[float(r_s)],[year])
            val = _predict_safe(Xs)[0]
        else:
            val = 0.0
        s_labels.append(s)
        s_preds.append(round(val,1))
    result["season_compare"] = {
        "seasons": s_labels,
        "yields":  s_preds,
        "crop":    crop,
        "district": district,
        "active_season": season,
    }

    # 4. Forest confidence distribution (tree-level predictions)
    try:
        rf  = model.named_steps["rf"]
        X1  = _make_rows(state,district,season,crop,[base_area],[base_rain],[year])
        Xt  = model.named_steps["preprocess"].transform(X1)
        tree_preds = [max(0.0,float(t.predict(Xt)[0])) for t in rf.estimators_]
        mean_v = float(np.mean(tree_preds))
        std_v  = float(np.std(tree_preds))
        lo90   = max(0.0, mean_v - 1.64*std_v)
        hi90   = mean_v + 1.64*std_v
        # Build histogram bins
        n_bins = 25
        mn_t = max(0, min(tree_preds))
        mx_t = max(tree_preds)
        bin_w = (mx_t - mn_t) / n_bins if mx_t > mn_t else 1.0
        hist_counts = [0]*n_bins
        hist_labels = []
        for i in range(n_bins):
            lo_b = mn_t + i*bin_w
            hi_b = lo_b + bin_w
            hist_labels.append(f"{int(lo_b/1000*10)/10}k" if lo_b>=1000 else str(int(lo_b)))
            hist_counts[i] = sum(1 for v in tree_preds if lo_b<=v<hi_b)
        result["forest_dist"] = {
            "bin_labels":  hist_labels,
            "bin_counts":  hist_counts,
            "mean":        round(mean_v,1),
            "std":         round(std_v,1),
            "lo90":        round(lo90,1),
            "hi90":        round(hi90,1),
            "n_trees":     len(tree_preds),
        }
    except Exception as e:
        result["forest_dist"] = None

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
