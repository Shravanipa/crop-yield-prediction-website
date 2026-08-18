/* ===========================================================================
   charts.js v3 — All prediction, weather, trend, sensitivity charts
   =========================================================================== */
const ChartFactory = (() => {
  const instances = {};
  const C = {
    gold:"#D4A017",goldL:"#F2C94C",goldP:"#FDF3D0",
    leaf:"#3A5C2A",leafM:"#4A6B3A",leafL:"#6B8F58",leafP:"#D8EDCC",
    sky:"#3D7FA6",skyL:"#7BB5D4",skyP:"#D0E9F5",
    terra:"#B8421F",terraL:"#E8673A",terraP:"#FFE8DF",
    soil:"#2D1F0E",soilL:"#5A4530",
    cream:"#F5EFE0",line:"rgba(221,213,188,0.5)",
  };
  const FF = "'Inter',system-ui,sans-serif";
  const FM = "'JetBrains Mono',monospace";

  const TIP = {
    backgroundColor:"rgba(20,10,2,0.93)",
    titleFont:{family:FF,size:12,weight:"700"},
    bodyFont:{family:FM,size:12},
    padding:12,cornerRadius:10,borderWidth:1,
    borderColor:"rgba(212,160,23,0.3)",
    titleColor:"#F5EFE0",bodyColor:"#D4A017",
  };
  const GRID = { color:C.line, drawBorder:false };
  const TICK = (color=C.soilL) => ({ font:{family:FF,size:10}, color });
  const AXIS = (title="",color=C.soilL) => ({
    grid:GRID, ticks:TICK(color), border:{display:false},
    title:title?{display:true,text:title,font:{family:FF,size:10},color}:undefined,
  });

  function kill(id) { if(instances[id]){instances[id].destroy();delete instances[id];} }
  function make(id,cfg) {
    kill(id);
    const canvas=document.getElementById(id);
    if(!canvas)return null;
    instances[id]=new Chart(canvas.getContext("2d"),cfg);
    return instances[id];
  }

  // ── 7-day Outlook (rainfall bar + temp line) ────────────────────────────
  function buildOutlookChart(days) {
    make("outlookChart",{
      type:"bar",
      data:{
        labels:days.map(d=>d.day_label),
        datasets:[
          {
            label:"Rainfall (mm)",data:days.map(d=>d.rain_mm),yAxisID:"y",
            backgroundColor:days.map((_,i)=>`rgba(61,127,166,${0.5+i*0.06})`),
            borderColor:C.sky,borderWidth:1,borderRadius:6,borderSkipped:false,barPercentage:0.6,
          },
          {
            label:"Temp °C",data:days.map(d=>d.temp_high),yAxisID:"y1",type:"line",
            borderColor:C.terra,backgroundColor:"rgba(184,66,31,0.07)",
            borderWidth:2.5,pointRadius:4,pointHoverRadius:7,
            pointBackgroundColor:C.terra,pointBorderColor:"#fff",pointBorderWidth:2,
            tension:0.4,fill:true,
          },
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,position:"bottom",labels:{font:{family:FF,size:10},color:C.soilL,boxWidth:10,padding:10}},tooltip:TIP},
        scales:{
          x:AXIS(),
          y:{...AXIS("mm",C.sky),position:"left"},
          y1:{...AXIS("°C",C.terra),position:"right",grid:{drawOnChartArea:false}},
        },
      },
    });
    buildOutlookStrip(days);
  }

  function buildOutlookStrip(days) {
    const el=document.getElementById("outlookStrip");
    if(!el)return;
    el.innerHTML=days.map((d,i)=>`
      <div class="outlook-day ${i===0?"today":""}">
        <div class="od-label">${d.day_label}</div>
        <div class="od-icon">${d.rain_mm>15?"🌧️":d.rain_mm>5?"🌦️":d.temp_high>35?"🌞":"⛅"}</div>
        <div class="od-temp">${d.temp_high}°C</div>
        <div class="od-rain">${d.rain_mm}mm</div>
      </div>`).join("");
  }

  // ── Temp/Humidity dual-axis ─────────────────────────────────────────────
  function buildHumidityChart(days) {
    make("humidityChart",{
      type:"line",
      data:{
        labels:days.map(d=>d.day_label),
        datasets:[
          {label:"Temp (°C)",data:days.map(d=>d.temp_high),yAxisID:"y",
           borderColor:C.terra,backgroundColor:"rgba(184,66,31,0.07)",
           borderWidth:2.5,pointRadius:4,pointHoverRadius:7,
           pointBackgroundColor:C.terra,pointBorderColor:"#fff",pointBorderWidth:2,tension:0.45,fill:true},
          {label:"Humidity (%)",data:days.map(d=>d.humidity_pct),yAxisID:"y1",
           borderColor:C.sky,backgroundColor:"rgba(61,127,166,0.06)",
           borderWidth:2.5,borderDash:[5,3],
           pointRadius:4,pointHoverRadius:7,
           pointBackgroundColor:C.sky,pointBorderColor:"#fff",pointBorderWidth:2,tension:0.45,fill:true},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,position:"bottom",labels:{font:{family:FF,size:10},color:C.soilL,boxWidth:10,padding:10}},tooltip:TIP},
        scales:{
          x:AXIS(),
          y:{...AXIS("°C",C.terra),position:"left"},
          y1:{...AXIS("%",C.sky),position:"right",grid:{drawOnChartArea:false},min:0,max:100},
        },
      },
    });
  }

  // ── Soil donut ──────────────────────────────────────────────────────────
  function buildSoilDonutChart(soilMix) {
    const colors=["#8B4513","#D4A017","#4A6B3A","#5B8AA6","#B8421F","#6B5A2A"];
    make("soilDonutChart",{
      type:"doughnut",
      data:{
        labels:soilMix.map(s=>s.type),
        datasets:[{data:soilMix.map(s=>s.pct),backgroundColor:colors,borderColor:"rgba(253,250,244,0.9)",borderWidth:3,hoverOffset:8}],
      },
      options:{
        responsive:true,maintainAspectRatio:true,cutout:"62%",
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.label}: ${c.raw}%`}}},
        animation:{animateRotate:true,duration:900},
      },
    });
    const legend=document.getElementById("soilLegend");
    if(legend) legend.innerHTML=soilMix.map((s,i)=>`<span><span class="dot" style="background:${colors[i]}"></span>${s.type} <b style="color:var(--soil-mid)">${s.pct}%</b></span>`).join("");
    const tl=document.getElementById("soilTypesList");
    if(tl){const icons={"Clay":"🟤","Sandy":"🏜️","Loam":"🌱","Alluvial":"💧","Black":"⬛","Red":"🔴","Laterite":"🟠","Saline":"🧂"};
      tl.innerHTML=soilMix.map(s=>`<div class="soil-type-row"><span class="soil-type-icon">${icons[s.type.split(" ")[0]]||"🌍"}</span><span>${s.type}</span><span class="soil-type-pct">${s.pct}%</span></div>`).join("");}
  }

  // ── Wind + Sun + Humidity gauges ────────────────────────────────────────
  function updateWindCompass(kmph,deg) {
    const n=document.getElementById("compassNeedle");
    if(n)n.setAttribute("transform",`rotate(${deg} 60 60)`);
    const s=document.getElementById("compassSpeed");
    if(s)s.textContent=`${kmph} km/h`;
  }
  function updateSunGauge(hrs) {
    const f=document.getElementById("sunArcFill");
    if(f)f.setAttribute("stroke-dasharray",`${Math.min(hrs/12,1)*220} 220`);
    const t=document.getElementById("sunHrsText");
    if(t)t.textContent=hrs;
  }
  function updateHumidityDrop(pct) {
    const r=document.getElementById("liquidRect");
    if(r){r.style.transition="y 1.2s ease";r.setAttribute("y",135-(127*(Math.min(pct,100)/100)));}
    const t=document.getElementById("humidText");
    if(t)t.textContent=`${pct}%`;
  }

  // ── Historical trend ────────────────────────────────────────────────────
  function buildTrendChart(labels,values,yLabel,type="line") {
    const gradFn=(ctx)=>{
      const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
      g.addColorStop(0,"rgba(74,107,58,0.35)");g.addColorStop(1,"rgba(74,107,58,0.02)");return g;
    };
    make("trendChart",{
      type,
      data:{labels,datasets:[{
        label:yLabel,data:values,
        borderColor:C.leafM,
        backgroundColor:type==="line"?gradFn:labels.map((_,i)=>`rgba(${74+Math.round(60*(i/(labels.length||1)))},107,58,0.75)`),
        borderWidth:type==="line"?2.5:0,
        pointRadius:type==="line"?5:0,pointHoverRadius:8,
        pointBackgroundColor:C.leafM,pointBorderColor:"#fff",pointBorderWidth:2,
        tension:0.45,fill:type==="line",
        borderRadius:type==="bar"?6:0,borderSkipped:false,
      }]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.parsed.y.toLocaleString("en-IN")} ${yLabel}`}}},
        scales:{x:AXIS(),y:{...AXIS(yLabel)}},
        animation:{duration:800,easing:"easeOutCubic"},
      },
    });
  }

  // ── Season share pie ─────────────────────────────────────────────────────
  function buildPieChart(labels,values) {
    const colors=[C.gold,C.leafM,C.sky,C.terra,"#9B6B2A","#5B8AA6","#538046","#C1502E"];
    make("pieChart",{
      type:"doughnut",
      data:{labels,datasets:[{data:values,backgroundColor:colors.slice(0,labels.length),borderColor:"rgba(253,250,244,0.9)",borderWidth:3,hoverOffset:10}]},
      options:{
        responsive:true,maintainAspectRatio:true,cutout:"55%",
        plugins:{
          legend:{display:true,position:"right",labels:{font:{family:FF,size:11},color:C.soilL,boxWidth:11,padding:10,usePointStyle:true,pointStyle:"circle"}},
          tooltip:{...TIP,callbacks:{label:(c)=>` ${c.label}: ${c.raw.toLocaleString("en-IN")} kg/ha`}},
        },
        animation:{animateRotate:true,animateScale:true,duration:900},
      },
    });
  }

  // ── Top crops horizontal bar ────────────────────────────────────────────
  function buildTopCropsChart(crops,yields) {
    const colors=crops.map((_,i)=>{
      const p=i/Math.max(crops.length-1,1);
      return `rgba(${Math.round(74+100*p)},${Math.round(107+30*(1-p))},${Math.round(58+80*p)},0.82)`;
    });
    make("topCropsChart",{
      type:"bar",
      data:{labels:crops,datasets:[{label:"Yield (kg/ha)",data:yields,backgroundColor:colors,borderRadius:5,borderSkipped:false}]},
      options:{
        indexAxis:"y",responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha`}}},
        scales:{x:{...AXIS("kg/ha"),beginAtZero:true},y:{...AXIS(),ticks:{font:{family:FF,size:9.5},color:C.soilL}}},
        animation:{duration:700,easing:"easeOutQuart"},
      },
    });
  }

  // ── Crop yield vs. national average (NOT a time series — do not reuse
  //    the YoY-growth math for this; that compared adjacent sorted crops
  //    to each other and produced meaningless deltas) ──────────────────────
  function buildCropVsAvgChart(labels,values) {
    const avg = values.reduce((a,b)=>a+b,0) / (values.length||1);
    const diffPct = values.map(v => parseFloat((((v-avg)/avg)*100).toFixed(1)));
    make("yoyChart",{
      type:"bar",
      data:{
        labels,
        datasets:[{
          label:"vs Avg %",data:diffPct,
          backgroundColor:diffPct.map(v=>v>=0?"rgba(74,107,58,0.78)":"rgba(184,66,31,0.78)"),
          borderRadius:4,borderSkipped:false,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw>0?"+":""}${c.raw}% vs avg`}}},
        scales:{
          x:AXIS(),
          y:{...AXIS("%"),ticks:{...TICK(C.soilL),callback:(v)=>`${v>0?"+":""}${v}%`}},
        },
        animation:{duration:700},
      },
    });
  }

  // ── Year-on-Year % change ───────────────────────────────────────────────
  function buildYoYChart(labels,values) {
    const yoy=values.map((v,i)=>i===0?0:parseFloat(((v-values[i-1])/values[i-1]*100).toFixed(1)));
    make("yoyChart",{
      type:"bar",
      data:{
        labels:labels.slice(1),
        datasets:[{
          label:"YoY Growth %",data:yoy.slice(1),
          backgroundColor:yoy.slice(1).map(v=>v>=0?"rgba(74,107,58,0.78)":"rgba(184,66,31,0.78)"),
          borderRadius:4,borderSkipped:false,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw>0?"+":""}${c.raw}%`}}},
        scales:{
          x:AXIS(),
          y:{...AXIS("%"),ticks:{...TICK(C.soilL),callback:(v)=>`${v>0?"+":""}${v}%`}},
        },
        animation:{duration:700},
      },
    });
  }

  // ── Radar chart: seasonal pattern ───────────────────────────────────────
  function buildRadarChart(seasons,avgYields) {
    make("radarChart",{
      type:"radar",
      data:{
        labels:seasons,
        datasets:[{
          label:"Avg Yield (kg/ha)",data:avgYields,
          backgroundColor:"rgba(74,107,58,0.18)",
          borderColor:C.leafM,borderWidth:2.5,
          pointBackgroundColor:C.leafM,pointBorderColor:"#fff",pointBorderWidth:2,pointRadius:4,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha`}}},
        scales:{r:{
          angleLines:{color:C.line},grid:{color:C.line},
          ticks:{font:{family:FM,size:9},color:C.soilL,backdropColor:"transparent"},
          pointLabels:{font:{family:FF,size:11,weight:"600"},color:C.soilL},
        }},
        animation:{duration:900},
      },
    });
  }

  // ── Yield sensitivity: real model predictions across an area sweep ──────
  // areas/yields come straight from /api/sensitivity (actual RF model output),
  // not a client-side guess — this makes the chart reflect genuine predictions.
  function buildYieldSensChart(areas,yields,baseArea) {
    make("yieldSensChart",{
      type:"line",
      data:{
        labels:areas.map(a=>`${a.toLocaleString("en-IN")}ha`),
        datasets:[{
          label:"Predicted Yield (kg/ha)",data:yields,
          borderColor:C.gold,backgroundColor:"rgba(212,160,23,0.1)",
          borderWidth:2.5,pointRadius:4,pointHoverRadius:7,
          pointBackgroundColor:areas.map(a=>Math.abs(a-baseArea)<Math.max(baseArea*0.05,0.5)?"#FFD700":C.gold),
          pointBorderColor:"#fff",pointBorderWidth:2,
          tension:0.3,fill:true,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha`}}},
        scales:{x:{...AXIS("Area (ha)"),ticks:{font:{family:FF,size:9.5},color:C.soilL}},y:{...AXIS("kg/ha")}},
        animation:{duration:600},
      },
    });
  }

  // ── Rainfall impact: real model predictions across a rainfall sweep ─────
  // rains/yields come straight from /api/sensitivity (actual RF model output).
  function buildRainfallImpactChart(rains,yields,baseRain) {
    make("rainfallImpactChart",{
      type:"line",
      data:{
        labels:rains.map(r=>`${r}mm`),
        datasets:[{
          label:"Predicted Yield",data:yields,
          borderColor:C.sky,backgroundColor:"rgba(61,127,166,0.1)",
          borderWidth:2.5,pointRadius:4,pointHoverRadius:7,
          pointBackgroundColor:rains.map(r=>Math.abs(r-baseRain)<100?"#FFD700":C.sky),
          pointBorderColor:"#fff",pointBorderWidth:2,tension:0.4,fill:true,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha`}}},
        scales:{x:{...AXIS("Rainfall"),ticks:{font:{family:FF,size:9},color:C.soilL}},y:{...AXIS("kg/ha")}},
        animation:{duration:600},
      },
    });
  }

  return {
    buildOutlookChart,buildHumidityChart,buildSoilDonutChart,
    buildTrendChart,buildPieChart,buildTopCropsChart,buildYoYChart,buildCropVsAvgChart,
    buildRadarChart,buildYieldSensChart,buildRainfallImpactChart,
    updateWindCompass,updateSunGauge,updateHumidityDrop,
  };
})();

  // ── Crop comparison horizontal bar (all crops for district+season) ─────
  function buildCropCompareChart(crops, yields, selectedCrop) {
    const paired = crops.map((c,i)=>({c,v:yields[i]})).sort((a,b)=>b.v-a.v).slice(0,12);
    make("cropCompareChart", {
      type:"bar",
      data:{
        labels: paired.map(p=>p.c),
        datasets:[{
          label:"Predicted Yield (kg/ha)",
          data: paired.map(p=>p.v),
          backgroundColor: paired.map(p=>p.c===selectedCrop?"#D4A017":"rgba(74,107,58,0.72)"),
          borderColor:     paired.map(p=>p.c===selectedCrop?"#B8421F":"rgba(74,107,58,0.9)"),
          borderWidth: paired.map(p=>p.c===selectedCrop?2.5:1),
          borderRadius:5, borderSkipped:false,
        }],
      },
      options:{
        indexAxis:"y",
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP, callbacks:{label:c=>` ${Math.round(c.raw).toLocaleString("en-IN")} kg/ha`}},
        },
        scales:{
          x:{...AXIS("kg/ha"), ticks:{font:{family:FF,size:9},color:C.soilL,
              callback:v=>v>=1000?Math.round(v/100)/10+"k":Math.round(v)}},
          y:{grid:{display:false}, ticks:{font:{family:FF,size:9},color:C.soilL}},
        },
        animation:{duration:700},
      },
    });
  }

  // ── Year-over-year trend for a specific crop+district (prediction panel) ─
  function buildYieldTrendPredChart(years, yields, cropName) {
    make("yieldTrendPredChart", {
      type:"line",
      data:{
        labels: years.map(y=>`'${String(y).slice(2)}`),
        datasets:[{
          label:`${cropName} yield`,
          data: yields,
          borderColor: C.terra,
          backgroundColor:"rgba(184,66,31,0.08)",
          borderWidth:2.5, pointRadius:4, pointHoverRadius:8,
          pointBackgroundColor:C.terra, pointBorderColor:"#fff", pointBorderWidth:2,
          tension:0.4, fill:true,
        }],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false},
          tooltip:{...TIP,callbacks:{label:c=>` ${Math.round(c.raw).toLocaleString("en-IN")} kg/ha`}}},
        scales:{
          x:{...AXIS("Year"), ticks:{font:{family:FF,size:9},color:C.soilL}},
          y:{...AXIS("kg/ha"), ticks:{font:{family:FF,size:9.5},color:C.soilL,
              callback:v=>v>=1000?Math.round(v/100)/10+"k":Math.round(v)}},
        },
        animation:{duration:700},
      },
    });
  }

  // ── Season comparison bar (same crop, 4 seasons) ──────────────────────────
  function buildSeasonCompareChart(seasons, yields, activeSeason) {
    const SCOLS = {
      "Rainy":"#3D7FA6","Winter":"#5B8AA6","Summer":"#E8673A","Whole Year":"#4A6B3A"
    };
    make("seasonCompareChart", {
      type:"bar",
      data:{
        labels: seasons,
        datasets:[{
          label:"Predicted Yield (kg/ha)",
          data: yields,
          backgroundColor: seasons.map(s=>s===activeSeason?SCOLS[s]||C.gold:(SCOLS[s]||C.leaf)+"99"),
          borderColor:     seasons.map(s=>s===activeSeason?SCOLS[s]||C.gold:SCOLS[s]||C.leaf),
          borderWidth: seasons.map(s=>s===activeSeason?2.5:1),
          borderRadius:8, borderSkipped:false,
        }],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP,callbacks:{label:c=>` ${Math.round(c.raw).toLocaleString("en-IN")} kg/ha`,
            title:t=>t[0].label}},
        },
        scales:{
          x:{grid:{display:false}, ticks:{font:{family:FF,size:10},color:C.soilL}},
          y:{...AXIS("kg/ha"), ticks:{font:{family:FF,size:9},color:C.soilL,
              callback:v=>v>=1000?Math.round(v/100)/10+"k":Math.round(v)}},
        },
        animation:{duration:600},
      },
    });
  }

  // ── Confidence distribution (simulated from CI + normal distribution) ────
  function buildConfidenceChart(predictedYield, lo90, hi90) {
    const std  = (hi90 - lo90) / (2 * 1.645);
    const pts  = [];
    const lbls = [];
    const n    = 40;
    const rangeW = std * 6;
    const start  = Math.max(0, predictedYield - rangeW / 2);
    for (let i = 0; i <= n; i++) {
      const x = start + (rangeW * i / n);
      const z = (x - predictedYield) / (std || 1);
      const y = Math.exp(-0.5 * z * z) / ((std || 1) * Math.sqrt(2 * Math.PI));
      lbls.push(x >= 1000 ? (Math.round(x / 100) / 10) + "k" : Math.round(x));
      pts.push(parseFloat(y.toFixed(6)));
    }
    make("confidenceChart", {
      type:"line",
      data:{
        labels: lbls,
        datasets:[
          {
            label:"Probability Density",
            data: pts,
            borderColor: C.leaf,
            backgroundColor:"rgba(74,107,58,0.18)",
            borderWidth:2.5, pointRadius:0, tension:0.4, fill:true,
          },
          {
            label:"90% CI range",
            data: lbls.map((_, i) => {
              const x = start + (rangeW * i / n);
              if (x >= lo90 && x <= hi90) {
                const z = (x - predictedYield) / (std || 1);
                return parseFloat((Math.exp(-0.5*z*z)/((std||1)*Math.sqrt(2*Math.PI))).toFixed(6));
              }
              return null;
            }),
            borderColor:"transparent",
            backgroundColor:"rgba(184,66,31,0.18)",
            fill:true, pointRadius:0, tension:0.4,
          },
        ],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:true, position:"bottom",
            labels:{font:{family:FF,size:9.5},color:C.soilL,boxWidth:10,padding:10}},
          tooltip:{...TIP, callbacks:{label:()=>""}},
        },
        scales:{
          x:{grid:{display:false},
             ticks:{font:{family:FF,size:9},color:C.soilL,maxTicksLimit:8}},
          y:{display:false},
        },
        animation:{duration:700},
      },
    });
  }

  // Export new functions — append to existing return
  ChartFactory.buildCropCompareChart    = buildCropCompareChart;
  ChartFactory.buildYieldTrendPredChart = buildYieldTrendPredChart;
  ChartFactory.buildSeasonCompareChart  = buildSeasonCompareChart;
  ChartFactory.buildConfidenceChart     = buildConfidenceChart;

/* ── PATCH: 4 new prediction chart functions appended ── */
;(()=>{
  const C2={
    gold:"#D4A017",sky:"#3D7FA6",leaf:"#3A5C2A",leafM:"#4A6B3A",leafL:"#6B8F58",
    terra:"#B8421F",terraL:"#E8673A",soilL:"#5A4530",cream:"#F5EFE0",
    SCOLS:{"Rainy":"#3D7FA6","Winter":"#5B8AA6","Summer":"#E8673A","Whole Year":"#4A6B3A"},
  };
  const FF2="'Inter',system-ui,sans-serif";
  const FM2="'JetBrains Mono',monospace";
  const TIP2={
    backgroundColor:"rgba(20,10,2,0.93)",
    titleFont:{family:FF2,size:12,weight:"700"},
    bodyFont:{family:FM2,size:12},padding:12,cornerRadius:10,
    borderWidth:1,borderColor:"rgba(212,160,23,0.3)",
    titleColor:"#F5EFE0",bodyColor:"#D4A017",
  };
  const instances2={};
  function kill2(id){if(instances2[id]){instances2[id].destroy();delete instances2[id];}}
  function make2(id,cfg){
    kill2(id);
    const canvas=document.getElementById(id);
    if(!canvas)return null;
    instances2[id]=new Chart(canvas.getContext("2d"),cfg);
    return instances2[id];
  }

  /* 1. Crop comparison — horizontal bar, highlight selected crop */
  ChartFactory.buildCropCompareChart = function(data){
    if(!data)return;
    const {crops,yields,selected_crop,season}=data;
    const bgColors=crops.map(c=>
      c===selected_crop?"rgba(184,66,31,0.88)":"rgba(58,92,42,0.72)"
    );
    const borderColors=crops.map(c=>c===selected_crop?"#FFD700":"#fff");
    make2("cropCompareChart",{
      type:"bar",
      data:{
        labels:crops.map(c=>c.length>16?c.slice(0,15)+"…":c),
        datasets:[{
          label:`Yield (kg/ha) — ${season} season`,
          data:yields,
          backgroundColor:bgColors,
          borderColor:borderColors,
          borderWidth:crops.map(c=>c===selected_crop?2.5:0),
          borderRadius:5,borderSkipped:false,
        }],
      },
      options:{
        indexAxis:"y",responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP2,callbacks:{
            title:(items)=>crops[items[0].dataIndex],
            label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha${crops[c.dataIndex]===selected_crop?" ← Your crop":""}`,
          }},
        },
        scales:{
          x:{grid:{color:"rgba(221,213,188,0.4)"},ticks:{font:{family:FM2,size:9.5},color:C2.soilL},border:{display:false}},
          y:{grid:{display:false},ticks:{font:{family:FF2,size:9.5},color:C2.soilL},border:{display:false}},
        },
        animation:{duration:700,easing:"easeOutQuart"},
      },
    });
  };

  /* 2. Year-over-year yield trend for the predicted crop */
  ChartFactory.buildYieldTrendPredChart = function(data){
    if(!data)return;
    const {years,yields,crop,district,season}=data;
    const gradFn=(ctx)=>{
      const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
      g.addColorStop(0,"rgba(184,66,31,0.3)"); g.addColorStop(1,"rgba(184,66,31,0.02)");
      return g;
    };
    make2("yieldTrendPredChart",{
      type:"line",
      data:{
        labels:years.map(y=>`'${String(y).slice(2)}`),
        datasets:[{
          label:`${crop} yield (kg/ha)`,
          data:yields,
          borderColor:C2.terra,
          backgroundColor:gradFn,
          borderWidth:2.5,
          pointRadius:4,pointHoverRadius:8,
          pointBackgroundColor:yields.map((v,i)=>i===yields.length-1?"#FFD700":C2.terra),
          pointBorderColor:"#fff",pointBorderWidth:2,
          tension:0.4,fill:true,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP2,callbacks:{
            title:(items)=>`Year ${years[items[0].dataIndex]}`,
            label:(c)=>` ${c.raw.toLocaleString("en-IN")} kg/ha`,
          }},
        },
        scales:{
          x:{grid:{color:"rgba(221,213,188,0.35)"},ticks:{font:{family:FF2,size:9.5},color:C2.soilL},border:{display:false}},
          y:{grid:{color:"rgba(221,213,188,0.35)"},ticks:{font:{family:FM2,size:10},color:C2.soilL,callback:v=>v>=1000?Math.round(v/100)/10+"k":v},border:{display:false}},
        },
        animation:{duration:800,easing:"easeOutCubic"},
      },
    });
  };

  /* 3. Season comparison — bar showing crop yield in all 4 seasons */
  ChartFactory.buildSeasonCompareChart = function(data){
    if(!data)return;
    const {seasons,yields,crop,active_season}=data;
    const bgColors=seasons.map(s=>
      s===active_season?C2.SCOLS[s]||C2.leafM:
      `${C2.SCOLS[s]||"#888888"}88`
    );
    const borderColors=seasons.map(s=>s===active_season?"#FFD700":"transparent");
    make2("seasonCompareChart",{
      type:"bar",
      data:{
        labels:seasons.map(s=>{
          const icons={"Rainy":"🌧️","Winter":"❄️","Summer":"☀️","Whole Year":"🗓️"};
          return `${icons[s]||""} ${s}`;
        }),
        datasets:[{
          label:`${crop} yield (kg/ha)`,
          data:yields,
          backgroundColor:bgColors,
          borderColor:borderColors,
          borderWidth:seasons.map(s=>s===active_season?2.5:0),
          borderRadius:6,borderSkipped:false,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP2,callbacks:{
            title:(items)=>seasons[items[0].dataIndex],
            label:(c)=>c.raw===0?` Not grown in this season`:` ${c.raw.toLocaleString("en-IN")} kg/ha`,
          }},
        },
        scales:{
          x:{grid:{display:false},ticks:{font:{family:FF2,size:10},color:C2.soilL},border:{display:false}},
          y:{grid:{color:"rgba(221,213,188,0.4)"},ticks:{font:{family:FM2,size:10},color:C2.soilL,callback:v=>v>=1000?Math.round(v/100)/10+"k":v},border:{display:false},beginAtZero:true},
        },
        animation:{duration:700,easing:"easeOutBounce"},
      },
    });
  };

  /* 4. Forest confidence histogram — shows model uncertainty */
  ChartFactory.buildConfidenceChart = function(data){
    if(!data)return;
    const {bin_labels,bin_counts,mean,lo90,hi90,n_trees,std}=data;
    const meanIdx=bin_counts.indexOf(Math.max(...bin_counts));
    const bgColors=bin_labels.map((_,i)=>{
      const v=parseFloat(bin_labels[i].replace("k",""))*
               (bin_labels[i].includes("k")?1000:1);
      const vF=lo90/1000;
      // colour bins inside 90% CI in leaf, outside in sky, peak in gold
      return i===meanIdx?"rgba(212,160,23,0.90)":
             "rgba(58,92,42,0.68)";
    });
    make2("confidenceChart",{
      type:"bar",
      data:{
        labels:bin_labels,
        datasets:[{
          label:`${n_trees} trees`,
          data:bin_counts,
          backgroundColor:bgColors,
          borderRadius:3,borderSkipped:false,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{...TIP2,callbacks:{
            title:(items)=>`~${items[0].label} kg/ha`,
            label:(c)=>` ${c.raw} trees predicted this`,
          }},
          annotation:{} // placeholder
        },
        scales:{
          x:{
            grid:{display:false},
            ticks:{font:{family:FM2,size:8.5},color:C2.soilL,maxRotation:30},
            border:{display:false},
            title:{display:true,text:`Predicted Yield (kg/ha)  ·  Mean: ${mean.toLocaleString("en-IN")}  ·  σ: ${std.toLocaleString("en-IN")}  ·  90% CI: ${lo90.toLocaleString("en-IN")} – ${hi90.toLocaleString("en-IN")}`,
              font:{family:FF2,size:9},color:C2.soilL},
          },
          y:{
            grid:{color:"rgba(221,213,188,0.3)"},
            ticks:{font:{family:FM2,size:9},color:C2.soilL},
            border:{display:false},
            title:{display:true,text:"No. of Trees",font:{family:FF2,size:9},color:C2.soilL},
          },
        },
        animation:{duration:600},
      },
    });
  };
})();
