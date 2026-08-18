# AgriForecast v5 — AI Crop Yield Intelligence for India
**CIN: U62099PN2023PTC218917**

A full-stack crop yield prediction platform for Indian farmers, lenders and
agri-input companies — Random Forest ML model, an interactive geographically
accurate India map, weather intelligence, historical trend charts, and a
complete public site with account login.

## What's New in v5
- ✅ **Public marketing home page** (hero, problem/solution, features, tech stack, footer)
- ✅ **Access Portal** — Create Account / Secure Login with real session-based auth
  (passwords hashed with Werkzeug `scrypt`, stored in `data/users.json`)
- ✅ **Post-login hub page** (`/welcome`) with tile navigation into the Analytics Hub
- ✅ **Dark navy + emerald theme** across every page, matching the AgriForecast brand
- ✅ **Geographically accurate India state map** — real state boundaries (OpenStreetMap-derived,
  via the Highcharts Map Collection), sharing exact borders so there are **no gaps** between states
- ✅ Every dashboard API route is login-protected
- ✅ Farm-field photography used as the home page hero background

## Pages & Routes
| Route | Description | Auth |
|---|---|---|
| `/` | Public marketing home page | Public |
| `/login` , `/login?tab=signup` | Access Portal (Secure Login / Create Account) | Public |
| `/welcome` | Post-login hub — tiles into Analytics Hub, weather, trends, community | Required |
| `/dashboard` | The full working ML dashboard (India map, prediction engine, charts) | Required |
| `/logout` | Clears session | — |
| `/api/*` | JSON prediction/chart endpoints used by the dashboard | Required |

## Libraries Used (all local — no internet required at runtime)
| Library | Purpose |
|---|---|
| Flask | Web server + routing + sessions |
| Werkzeug | Password hashing (`generate_password_hash` / `check_password_hash`) |
| Scikit-learn | Random Forest Regressor |
| Pandas / NumPy | Data manipulation |
| Joblib | Model serialization |
| Vanilla JS (canvas) | Charts + interactive India map — no CDN chart library needed |

## Setup (One-Time)
```bash
# 1. Install dependencies
pip install flask werkzeug pandas numpy scikit-learn joblib

# 2. Generate the training dataset
python data/generate_dataset.py

# 3. Train the Random Forest model
python model/train_model.py

# 4. Pre-compute chart JSON (historical trend data)
python data/precompute_charts.py

# 5. Run the server
python app.py
```
Then open **http://localhost:5000** — you'll land on the public home page.
Click **Get Started** to create an account, or **Login** if you already have one.

> Accounts are stored in `data/users.json` (created automatically on first
> signup). Delete that file to reset all accounts. Set the
> `AGRIFORECAST_SECRET_KEY` environment variable to a random string before
> deploying anywhere other than your own machine.

## Key Features (Analytics Hub)
- Click any Indian state on the **geographically accurate map** → see its
  districts → click a district to auto-fill the form
- Choose season via pills: Rainy / Winter / Summer / Whole Year
- **Predict Yield** → kg/ha estimate with a 90% confidence interval
- **Best Crop** → ranks every valid crop for the selected district & season
- Sensitivity charts (yield vs. area, rainfall impact), Random Forest
  prediction-distribution histogram
- Weather dashboard: temperature, humidity, rainfall, sunlight, 7-day outlook
- Historical trends: 16-year line/bar chart, YoY growth %, radar, top crops

## Project Structure
```
app.py                     Flask backend - routes, auth, prediction API
data/
  generate_dataset.py      Synthetic-but-realistic crop production dataset generator
  precompute_charts.py     Pre-computes historical trend JSON
  crop_production.csv      Generated dataset (16 states, 2008-2023)
model/
  train_model.py           Trains the Random Forest Regressor
  weather_sim.py           Deterministic weather simulator (per district/season)
  yield_model.joblib       Trained model (generated)
  metadata.joblib          States/crops/metrics metadata (generated)
templates/
  home.html                Public marketing landing page
  login.html               Access Portal (Create Account / Secure Login)
  welcome.html             Post-login hub
  dashboard.html           The Analytics Hub (main working app)
static/
  css/style.css            Base design system (original AgriForecast theme)
  css/theme-dark.css       Dark navy + emerald overlay (loaded after style.css)
  css/landing.css          Home / login / welcome page styles
  js/app.js, charts.js, india-map.js   Dashboard logic + interactive map
  img/hero-field.jpg       Home page hero background photo
```
