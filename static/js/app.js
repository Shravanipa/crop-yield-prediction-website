/* ===========================================================================
   app.js v3 — AgriForecast full wiring with all prediction charts
   =========================================================================== */
(() => {
  const $ = id => document.getElementById(id);
  const stateSelect    = $("stateSelect");
  const districtSelect = $("districtSelect");
  const seasonSelect   = $("seasonSelect");
  const cropSelect     = $("cropSelect");
  const areaInput      = $("areaInput");
  const rainfallInput  = $("rainfallInput");
  const predictForm    = $("predictForm");
  const predictBtn     = $("predictBtn");
  const recommendBtn   = $("recommendBtn");
  const resultsArea    = $("resultsArea");
  const toast          = $("toast");

  let allSeasons = [];
  let currentTrendMode = "state";
  let currentChartType = "line";
  let lastPrediction   = null;

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    animateCounters();
    startParticles();
    const statesRes  = await fetchJSON("/api/states");
    IndiaMap.render(statesRes.states);
    IndiaMap.onSelect(handleStateSelected);
    const seasonsRes = await fetchJSON("/api/seasons");
    allSeasons = seasonsRes.seasons;
    populateSeasons(seasonSelect, allSeasons);
    wireEvents();
  }

  // ─── Counter animation ────────────────────────────────────────────────────
  function animateCounters() {
    document.querySelectorAll(".stat .num").forEach(el => {
      const target = parseFloat(el.dataset.count);
      const dec    = el.dataset.count.includes(".");
      const dur    = 1400; const t0 = performance.now();
      const tick   = now => {
        const p = Math.min(1,(now-t0)/dur);
        const e = 1-Math.pow(1-p,4);
        el.textContent = dec ? (target*e).toFixed(1) : Math.round(target*e).toLocaleString("en-IN");
        if(p<1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ─── Particles ────────────────────────────────────────────────────────────
  function startParticles() {
    const canvas = $("particles-canvas");
    if(!canvas)return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const pts = Array.from({length:35},()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      r:Math.random()*1.8+0.4, vx:(Math.random()-.5)*0.25,
      vy:-Math.random()*0.35-0.08, a:Math.random()*0.35+0.08,
      c:Math.random()>.5?"212,160,23":"74,107,58",
    }));
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.y<-10){p.y=canvas.height+10;p.x=Math.random()*canvas.width;}
        if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.c},${p.a})`; ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  function wireEvents() {
    stateSelect.addEventListener("change", () => {
      if(stateSelect.value) IndiaMap.selectStateExternally(stateSelect.value);
      else { IndiaMap.clearSelection(); resetDownstream(); }
    });
    districtSelect.addEventListener("change", () => { updateStep(2); maybeWeather(); });
    seasonSelect.addEventListener("change", () => {
      // Sync active pill to match dropdown selection
      const val = seasonSelect.value;
      document.querySelectorAll(".season-pill").forEach(b =>
        b.classList.toggle("active", b.dataset.season === val));
      onSeasonChange();
      maybeWeather();
    });
    $("clearSelection").addEventListener("click", () => {
      IndiaMap.clearSelection();
      stateSelect.value=""; resetDownstream();
      $("selectedBanner").classList.remove("show");
      $("weatherPanel").style.display="none";
      $("trendPanel").style.display="none";
      $("predictionCharts").style.display="none";
      resetSteps();
    });
    predictForm.addEventListener("submit", e=>{e.preventDefault();runPredict();});
    recommendBtn.addEventListener("click", runRecommend);
    document.querySelectorAll("#trendTabs button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        document.querySelectorAll("#trendTabs button").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        currentTrendMode=btn.dataset.mode;
        loadTrend();
      });
    });
    document.querySelectorAll(".chart-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".chart-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        currentChartType=btn.dataset.chartType;
        loadTrend();
      });
    });
  }

  function resetDownstream() {
    districtSelect.innerHTML=`<option value="">Select state first…</option>`; districtSelect.disabled=true;
    cropSelect.innerHTML=`<option value="">Select season first…</option>`; cropSelect.disabled=true;
    resultsArea.innerHTML=emptyStateHTML();
  }

  function emptyStateHTML() {
    return `<div class="empty-state"><div class="empty-orb"></div>
      <div class="empty-icon">🌱</div>
      <strong>Your forecast appears here</strong>
      <p>Click a state on the map, fill the form, then hit <em>Predict Yield</em>.</p>
      <div class="empty-features"><span>📊 kg/ha estimate</span><span>🎯 90% CI</span><span>🏆 Crop rank</span><span>📈 Trend chart</span></div>
    </div>`;
  }

  function updateStep(n) {
    document.querySelectorAll(".step-pill").forEach(p=>{
      const s=parseInt(p.dataset.step);
      p.className=s<n?"step-pill done":s===n?"step-pill active":"step-pill";
    });
  }
  function resetSteps() {
    document.querySelectorAll(".step-pill").forEach((p,i)=>p.className=i===0?"step-pill active":"step-pill");
  }

  // ─── State selected ───────────────────────────────────────────────────────
  async function handleStateSelected(state) {
    if(!state) return;
    stateSelect.value=state;
    $("selectedBanner").classList.add("show");
    $("selectedStateLabel").textContent=state;
    $("mapPanelSub").textContent=`${state} selected · pick a district`;
    $("mapBadge").textContent=state;
    updateStep(2);
    const dr=await fetchJSON(`/api/districts/${encodeURIComponent(state)}`);
    populateSelect(districtSelect, dr.districts, "Choose district…");
    districtSelect.disabled=false;
    onSeasonChange();
    maybeWeather();
    loadTrend();
    slideIn($("trendPanel"));
  }

  function slideIn(el) {
    if(!el) return;
    el.style.display="block";
    el.style.opacity="0"; el.style.transform="translateY(18px)";
    requestAnimationFrame(()=>{
      el.style.transition="opacity 0.45s ease,transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)";
      el.style.opacity="1"; el.style.transform="translateY(0)";
    });
  }

  async function onSeasonChange() {
    const state=stateSelect.value, season=seasonSelect.value;
    if(!state||!season){cropSelect.innerHTML=`<option value="">Select season first…</option>`;cropSelect.disabled=true;return;}
    const cr=await fetchJSON(`/api/crops/${encodeURIComponent(state)}/${encodeURIComponent(season)}`);
    populateSelect(cropSelect, cr.crops, "Choose crop…");
    cropSelect.disabled=false;
    updateStep(2);
  }

  async function maybeWeather() {
    const state=stateSelect.value; if(!state) return;
    const district=districtSelect.value||"";
    const season=seasonSelect.value||"Kharif";
    const data=await fetchJSON(`/api/weather?state=${enc(state)}&district=${enc(district)}&season=${enc(season)}`);
    renderWeather(data);
  }

  function renderWeather(data) {
    slideIn($("weatherPanel"));
    $("weatherLocLabel").textContent = `${data.district ? data.district + ", " : ""}${data.state}`;

    // Rich season badge with icon + months
    const sb = $("weatherSeasonBadge");
    const sm = SEASON_META[data.season] || { icon:"🗓️", label: data.season, months:"", color:"#4A6B3A" };
    if (sb) {
      sb.innerHTML = `${sm.icon} ${sm.label} <span style="font-size:10px;opacity:0.75;margin-left:4px">${sm.months}</span>`;
      sb.style.background = sm.bg || "rgba(74,107,58,0.1)";
      sb.style.color = sm.color;
      sb.style.borderColor = sm.border || "rgba(74,107,58,0.3)";
    }

    // Season context banner inside weather panel
    const seasonCtx = $("weatherSeasonCtx");
    if (seasonCtx) {
      seasonCtx.innerHTML = `
        <span class="sctx-icon">${sm.icon}</span>
        <div class="sctx-body">
          <strong>${sm.label}</strong>
          <span>${sm.desc || ""} · ${sm.months}</span>
        </div>`;
      seasonCtx.style.borderColor = sm.border || "";
      seasonCtx.style.background  = sm.bg || "";
    }

    // Sync season pills active state
    document.querySelectorAll(".season-pill").forEach(b => {
      b.classList.toggle("active", b.dataset.season === data.season);
    });

    const c = data.current;
    const tempColor = data.season === "Summer" ? "#E8673A" :
                      data.season === "Winter" ? "#5B8AA6" :
                      data.season === "Rainy"  ? "#3D7FA6" : "#D4A017";
    const cards = [
      { icon:"🌡️", val:`${c.temperature_c}°C`, lbl:"Temperature",   color: tempColor        },
      { icon:"💧",  val:`${c.humidity_pct}%`,   lbl:"Humidity",      color:"#3D7FA6"         },
      { icon:"🌧️", val:`${c.rainfall_mm}mm`,   lbl:"Rainfall",      color:"#5B8AA6"         },
      { icon:"☀️",  val:`${c.sunlight_hrs}hrs`, lbl:"Sunlight",      color:"#D4A017"         },
      { icon:"💨",  val:`${c.wind_kmph}km/h`,   lbl:"Wind Speed",    color:"#4A6B3A"         },
    ];
    $("weatherGrid").innerHTML = cards.map((card, i) => `
      <div class="weather-card" style="animation-delay:${i * .07}s">
        <div class="wc-icon">${card.icon}</div>
        <div class="val" style="color:${card.color}">${card.val}</div>
        <div class="lbl">${card.lbl}</div>
      </div>`).join("");

    ChartFactory.buildOutlookChart(data.outlook_7day);
    ChartFactory.buildHumidityChart(data.outlook_7day);
    ChartFactory.buildSoilDonutChart(c.soil_mix);
    ChartFactory.updateWindCompass(c.wind_kmph, c.wind_dir_deg || 135);
    ChartFactory.updateSunGauge(c.sunlight_hrs);
    ChartFactory.updateHumidityDrop(c.humidity_pct);
  }

  // ─── Trend charts ─────────────────────────────────────────────────────────
  async function loadTrend() {
    const state=stateSelect.value; if(!state) return;
    if(currentTrendMode==="state") {
      const season=seasonSelect.value||allSeasons[0]||"Kharif";
      const data=await fetchJSON(`/api/trend?state=${enc(state)}&season=${enc(season)}`);
      $("trendSubLabel").textContent=`${state} · ${season}`;
      $("trendTitle").textContent=`${state} — ${season} Yield Trend`;
      ChartFactory.buildTrendChart(data.years, data.yield, "kg/ha", currentChartType);
      $("yoyChartTitle").textContent = "📉 Year-on-Year Growth";
      $("yoyChartBadge").textContent = "% Change";
      ChartFactory.buildYoYChart(data.years, data.yield);
      buildSeasonRadar(state);
      buildTopCropsForState(state, season);
    } else {
      const data=await fetchJSON("/api/national_crop_avg");
      $("trendSubLabel").textContent="National average across all states";
      $("trendTitle").textContent="National Average Yield by Crop";
      const sorted=Object.entries(data).map(([l,v])=>({l,v})).sort((a,b)=>b.v-a.v).slice(0,8);
      ChartFactory.buildTrendChart(sorted.map(s=>s.l),sorted.map(s=>s.v),"kg/ha",currentChartType);
      ChartFactory.buildPieChart(sorted.map(s=>s.l),sorted.map(s=>s.v));
      ChartFactory.buildTopCropsChart(sorted.map(s=>s.l),sorted.map(s=>s.v));
      $("yoyChartTitle").textContent = "📊 Yield vs National Avg";
      $("yoyChartBadge").textContent = "% Diff";
      ChartFactory.buildCropVsAvgChart(sorted.map(s=>s.l).slice(0,8),[...sorted.map(s=>s.v)]);
    }
  }

  async function buildSeasonRadar(state) {
    const results=await Promise.all(allSeasons.map(s=>
      fetchJSON(`/api/trend?state=${enc(state)}&season=${enc(s)}`)
        .then(d=>({s,avg:d.yield.length?d.yield.reduce((a,b)=>a+b,0)/d.yield.length:0}))
        .catch(()=>({s,avg:0}))
    ));
    const f=results.filter(r=>r.avg>0);
    ChartFactory.buildRadarChart(f.map(r=>r.s), f.map(r=>Math.round(r.avg)));
    ChartFactory.buildPieChart(f.map(r=>r.s), f.map(r=>Math.round(r.avg)));
  }

  async function buildTopCropsForState(state, season) {
    const area=parseFloat(areaInput.value)||1000;
    const payload={state,district:districtSelect.value||"",season,area};
    const res=await fetch("/api/recommend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!res.ok) return;
    const data=await res.json();
    const top=data.ranking.slice(0,8);
    ChartFactory.buildTopCropsChart(top.map(r=>r.crop), top.map(r=>r.predicted_yield_kg_per_ha));
  }

  // ─── Predict ───────────────────────────────────────────────────────────────
  async function runPredict() {
    if(!validateForm()) return;
    setLoading(predictBtn, true, "🔮");
    const payload={
      state:stateSelect.value, district:districtSelect.value,
      season:seasonSelect.value, crop:cropSelect.value,
      area:areaInput.value, rainfall:rainfallInput.value||"auto",
    };
    try {
      const res=await fetch("/api/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Prediction failed");
      lastPrediction=data;
      renderResult(data);
      updateStep(3);
      showToast(`🌾 ${data.predicted_yield_kg_per_ha.toLocaleString("en-IN")} kg/ha for ${payload.crop}`);
      await showPredictionCharts(data, payload);
    } catch(e){showToast(e.message,true);}
    finally{setLoading(predictBtn,false,"🔮","Predict Yield");}
  }

  async function showPredictionCharts(predData, payload) {
    const pc = $("predictionCharts");
    if (!pc) return;
    pc.style.display = "block";

    // Update context labels
    const pcCropCtx   = $("pcCropCtx");
    const pcTrendCtx  = $("pcTrendCtx");
    const pcSeasonCtx = $("pcSeasonCtx");
    const ctx = payload.district + ", " + payload.state;
    if (pcCropCtx)   pcCropCtx.textContent   = ctx + " · " + payload.season;
    if (pcTrendCtx)  pcTrendCtx.textContent   = payload.crop;
    if (pcSeasonCtx) pcSeasonCtx.textContent  = payload.crop;

    const chartPayload = Object.assign({}, payload,
      { pred_yield: predData.predicted_yield_kg_per_ha });

    // Run both APIs in parallel
    const [sensRes, chartRes] = await Promise.allSettled([
      fetch("/api/sensitivity", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload),
      }).then(r => r.json()),
      fetch("/api/charts/prediction", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(chartPayload),
      }).then(r => r.json()),
    ]);

    // Charts 1 & 2: Sensitivity
    if (sensRes.status === "fulfilled" && !sensRes.value.error) {
      const s = sensRes.value;
      ChartFactory.buildYieldSensChart(
        s.area_sensitivity.area_ha,
        s.area_sensitivity.predicted_yield_kg_per_ha,
        s.base.area_ha,
      );
      ChartFactory.buildRainfallImpactChart(
        s.rainfall_sensitivity.rainfall_mm,
        s.rainfall_sensitivity.predicted_yield_kg_per_ha,
        s.base.rainfall_mm,
      );
    } else {
      showToast("Sensitivity charts: API error", true);
    }

    // Charts 3-6: Crop compare, Trend, Season compare, Confidence
    if (chartRes.status === "fulfilled" && !chartRes.value.error) {
      const d = chartRes.value;
      if (d.crop_compare)   ChartFactory.buildCropCompareChart(d.crop_compare);
      if (d.year_trend)     ChartFactory.buildYieldTrendPredChart(d.year_trend);
      if (d.season_compare) ChartFactory.buildSeasonCompareChart(d.season_compare);
      if (d.forest_dist)    ChartFactory.buildConfidenceChart(d.forest_dist);
    } else {
      showToast("Extended charts: API error", true);
    }

    // Smooth scroll to charts
    setTimeout(() => pc.scrollIntoView({behavior:"smooth", block:"nearest"}), 400);
  }

  function renderResult(data) {
    const ci=data.confidence_interval_90;
    const inp=data.inputs_used;
    const confPct=Math.min(100,Math.max(0,((inp.rainfall_mm/1500)*60+30)));
    resultsArea.innerHTML=`
      <div class="result-hero">
        <div class="rh-label">Predicted Yield · ${inp.crop} · ${inp.district}, ${inp.state}</div>
        <div class="rh-value" id="rvCounter" data-target="${data.predicted_yield_kg_per_ha}">0<span class="rh-unit">kg/ha</span></div>
        <div class="rh-sub">≈ <b>${data.predicted_total_production_tonnes.toLocaleString("en-IN")}</b> tonnes total · Area: <b>${inp.area_ha} ha</b> · Season: <b>${inp.season}</b></div>
      </div>
      <div class="confidence-bar-wrap">
        <div class="ci-label">
          <span>🎯 90% Confidence Interval</span>
          <span style="font-family:var(--font-mono);color:var(--terra)">${ci[0].toLocaleString("en-IN")} – ${ci[1].toLocaleString("en-IN")} kg/ha</span>
        </div>
        <div class="confidence-track">
          <div class="confidence-fill"></div>
          <div class="confidence-marker" style="left:${confPct}%"></div>
        </div>
      </div>
      <div class="res-mini-grid">
        <div class="rmc"><div class="rmc-icon">📍</div><div class="rmc-val">${inp.district}</div><div class="rmc-lbl">District</div></div>
        <div class="rmc"><div class="rmc-icon">🗓️</div><div class="rmc-val" style="color:var(--sky)">${inp.season}</div><div class="rmc-lbl">Season</div></div>
        <div class="rmc"><div class="rmc-icon">🌧️</div><div class="rmc-val" style="color:var(--leaf-mid)">${inp.rainfall_mm} mm</div><div class="rmc-lbl">Rainfall</div></div>
      </div>
    `;
    animCount($("rvCounter"), data.predicted_yield_kg_per_ha);
  }

  function animCount(el, target) {
    if(!el) return;
    const dur=900, t0=performance.now();
    const tick=now=>{
      const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
      el.innerHTML=`${Math.round(target*e).toLocaleString("en-IN")}<span class="rh-unit">kg/ha</span>`;
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── Recommend ─────────────────────────────────────────────────────────────
  async function runRecommend() {
    if(!stateSelect.value||!districtSelect.value||!seasonSelect.value)
      return showToast("Select state, district and season first",true);
    setLoading(recommendBtn,true,"🏆");
    const payload={state:stateSelect.value,district:districtSelect.value,season:seasonSelect.value,area:areaInput.value||1000};
    try {
      const res=await fetch("/api/recommend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Failed");
      renderRecommend(data);
      updateStep(3);
    } catch(e){showToast(e.message,true);}
    finally{setLoading(recommendBtn,false,"🏆","Best Crop");}
  }

  function renderRecommend(data) {
    const top=data.ranking[0];
    const maxY=top.predicted_yield_kg_per_ha;
    resultsArea.innerHTML=`
      <div class="recommend-card">
        <div class="rc-header">
          <div>
            <div class="rc-title">🏆 Best crop · ${data.district} · ${data.season}</div>
            <div class="rc-winner">${top.crop}</div>
          </div>
          <div class="rc-winner-yield">${top.predicted_yield_kg_per_ha.toLocaleString("en-IN")} kg/ha</div>
        </div>
        <div class="crop-rank-list">
          ${data.ranking.slice(0,8).map((r,i)=>`
            <div class="crop-rank-row ${i===0?"top1":""}" style="animation-delay:${i*.07}s">
              <div class="rank">${i===0?"🥇":i+1}</div>
              <div class="crop-name-bar">
                <span class="crop-label">${r.crop}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${(r.predicted_yield_kg_per_ha/maxY*100).toFixed(0)}%;animation-delay:${i*.08}s"></div></div>
              </div>
              <div class="yield-val">${r.predicted_yield_kg_per_ha.toLocaleString("en-IN")} kg/ha</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function validateForm() {
    if(!stateSelect.value)    return showToast("Please select a state",true),false;
    if(!districtSelect.value) return showToast("Please select a district",true),false;
    if(!seasonSelect.value)   return showToast("Please select a season",true),false;
    if(!cropSelect.value)     return showToast("Please select a crop",true),false;
    if(!areaInput.value||parseFloat(areaInput.value)<=0) return showToast("Enter a valid area in hectares",true),false;
    return true;
  }
  /* ── Season metadata for icons, colors, descriptions ────────────────── */
  const SEASON_META = {
    "Rainy":      { icon:"🌧️", color:"#3D7FA6", bg:"rgba(61,127,166,0.12)", border:"rgba(61,127,166,0.3)",  months:"Jun – Sep", desc:"Monsoon / High rainfall",     label:"Rainy Season"  },
    "Winter":     { icon:"❄️", color:"#5B8AA6", bg:"rgba(91,138,166,0.12)", border:"rgba(91,138,166,0.3)",  months:"Oct – Feb", desc:"Cool & dry conditions",        label:"Winter Season" },
    "Summer":     { icon:"☀️", color:"#E8673A", bg:"rgba(232,103,58,0.11)", border:"rgba(232,103,58,0.3)",  months:"Mar – May", desc:"Hot & low rainfall",           label:"Summer Season" },
    "Whole Year": { icon:"🗓️", color:"#4A6B3A", bg:"rgba(74,107,58,0.11)",  border:"rgba(74,107,58,0.3)",   months:"Jan – Dec", desc:"Perennial / Year-round crops", label:"Whole Year"    },
  };

  function populateSeasons(sel, seasons) {
    sel.innerHTML = `<option value="">Choose season…</option>` +
      seasons.map(s => {
        const m = SEASON_META[s] || { icon:"🗓️", label:s };
        return `<option value="${s}">${m.icon} ${m.label || s}</option>`;
      }).join("");

    // Build quick-pick season pills below the select
    const pillsEl = document.getElementById("seasonPills");
    if (!pillsEl) return;
    pillsEl.innerHTML = seasons.map(s => {
      const m = SEASON_META[s] || { icon:"🗓️", color:"#4A6B3A", bg:"rgba(74,107,58,0.1)", border:"rgba(74,107,58,0.3)", months:"", desc:"" };
      return `<button type="button" class="season-pill" data-season="${s}"
        style="--sp-color:${m.color};--sp-bg:${m.bg};--sp-border:${m.border}">
        <span class="sp-icon">${m.icon}</span>
        <span class="sp-name">${m.label || s}</span>
        <span class="sp-months">${m.months}</span>
      </button>`;
    }).join("");

    pillsEl.querySelectorAll(".season-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const s = btn.dataset.season;
        sel.value = s;
        sel.dispatchEvent(new Event("change"));
        pillsEl.querySelectorAll(".season-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  function populateSelect(sel,items,ph) {
    sel.innerHTML=`<option value="">${ph}</option>`+items.map(i=>`<option value="${i}">${i}</option>`).join("");
  }
  function setLoading(btn,on,icon="",label="") {
    btn.disabled=on;
    if(on){btn.dataset.ol=btn.querySelector(".btn-label")?.textContent||"";
      btn.innerHTML=`<span class="spinner"></span><span class="btn-label">Working…</span><span class="btn-shimmer"></span>`;}
    else{btn.innerHTML=`<span class="btn-icon">${icon}</span><span class="btn-label">${label||btn.dataset.ol}</span><span class="btn-shimmer"></span>`;}
  }
  function showToast(msg,err=false) {
    toast.innerHTML=msg; toast.classList.toggle("error",err); toast.classList.add("show");
    clearTimeout(toast._t); toast._t=setTimeout(()=>toast.classList.remove("show"),3400);
  }
  async function fetchJSON(url) {
    const r=await fetch(url); if(!r.ok) throw new Error(`Request failed: ${url}`); return r.json();
  }
  const enc = encodeURIComponent;

  // ─── Mini result grid CSS (injected once) ─────────────────────────────────
  const style=document.createElement("style");
  style.textContent=`
    .res-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 20px 18px;}
    .rmc{background:rgba(255,255,255,0.07);border:1px solid rgba(224,216,192,0.2);border-radius:12px;padding:12px;text-align:center;}
    .rmc-icon{font-size:20px;margin-bottom:6px;}
    .rmc-val{font-size:12px;font-weight:600;color:rgba(245,239,224,0.85);}
    .rmc-lbl{font-size:9px;color:rgba(245,239,224,0.45);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  `;
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", init);
})();
