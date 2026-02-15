import React, { useState, useEffect, useMemo } from 'react';
import { Scatter, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { useRustWasm } from './useRustWasm';

Chart.register(...registerables);

// ==========================================
// 1. 定数・マッピング定義 (資産リスト)
// ==========================================
const TICKER_MAPPING = {
  // Global / US
  "Stk_AllCountry": "All Country (全世界株式)",
  "Stk_SP500": "S&P 500 (米国大型株)",
  "Stk_Nasdaq": "NASDAQ 100 (米国テック株)",
  "Stk_NYDow": "NY Dow (ダウ工業株30種)",
  "Stk_US_HighDiv": "US High Div (米国高配当株)",
  "Stk_FangPlus": "FANG+ (米国大手テック10社)",
  "Stk_Kokusai": "Dev ex-US (先進国株式)",
  
  // Japan
  "Stk_JP_Nikkei": "Nikkei 225 (日経平均)",
  "Stk_JP_Topix": "TOPIX (東証株価指数)",
  "Stk_JP_JPX400": "JPX-Nikkei 400",
  "Stk_JP_HighDiv": "JP High Div (日経高配当株)",
  
  // Emerging
  "Stk_Emerging": "Emerging (新興国株式)",
  "Stk_India": "India (インド株式)",
  
  // Bonds
  "Bnd_US_Short": "US Short Bond (米国短期債)",
  "Bnd_US_Agg": "US Agg Bond (米国総合債)",
  "Bnd_US_20y": "US 20y Bond (米国超長期債)",
  "Bnd_US_HighYld": "US High Yield (ハイイールド債)",
  "Bnd_JP": "JP Bond (国内債券)",
  
  // REIT
  "Reit_JP": "J-REIT (国内不動産)",
  "Reit_Global": "Global REIT (先進国不動産)",
  
  // Commodities / Crypto
  "Cmdty_Gold": "Gold (金)",
  "Cmdty_Silver": "Silver (銀)",
  "Cmdty_Oil": "Oil (原油)",
  "Crypto_BTC": "Bitcoin (ビットコイン)"
};

const ASSET_GROUPS = [
  { 
    id: 'GlobalStocks', 
    label: 'Global / US Stocks', 
    members: ["Stk_AllCountry", "Stk_SP500", "Stk_Nasdaq", "Stk_FangPlus", "Stk_NYDow", "Stk_US_HighDiv", "Stk_Kokusai"] 
  },
  { 
    id: 'JapanStocks', 
    label: 'Japan Stocks', 
    members: ["Stk_JP_Topix", "Stk_JP_Nikkei", "Stk_JP_JPX400", "Stk_JP_HighDiv"] 
  },
  { 
    id: 'Emerging', 
    label: 'Emerging Stocks', 
    members: ["Stk_Emerging", "Stk_India"] 
  },
  { 
    id: 'Bonds', 
    label: 'Bonds', 
    members: ["Bnd_JP", "Bnd_US_Short", "Bnd_US_Agg", "Bnd_US_20y", "Bnd_US_HighYld"] 
  },
  { 
    id: 'Alts', 
    label: 'Alternatives', 
    members: ["Reit_JP", "Reit_Global", "Cmdty_Gold", "Cmdty_Silver", "Cmdty_Oil", "Crypto_BTC"] 
  }
];

const ASSET_COLORS = {
  "Stk_AllCountry": "#3b82f6", "Stk_SP500": "#2563eb", "Stk_Nasdaq": "#60a5fa", "Stk_FangPlus": "#06b6d4",
  "Stk_NYDow": "#1d4ed8", "Stk_US_HighDiv": "#93c5fd", "Stk_Kokusai": "#bfdbfe",
  "Stk_JP_Topix": "#ef4444", "Stk_JP_Nikkei": "#dc2626", "Stk_JP_JPX400": "#be123c", "Stk_JP_HighDiv": "#fca5a5",
  "Stk_Emerging": "#d97706", "Stk_India": "#f59e0b",
  "Bnd_JP": "#10b981", "Bnd_US_Short": "#6ee7b7", "Bnd_US_Agg": "#22c55e", "Bnd_US_20y": "#15803d", "Bnd_US_HighYld": "#166534",
  "Reit_JP": "#8b5cf6", "Reit_Global": "#a78bfa",
  "Cmdty_Gold": "#eab308", "Cmdty_Silver": "#cbd5e1", "Cmdty_Oil": "#78350f",
  "Crypto_BTC": "#f97316"
};

const getAssetColor = (ticker) => ASSET_COLORS[ticker] || '#94a3b8';
const getAssetName = (ticker) => TICKER_MAPPING[ticker] || ticker;

// ==========================================
// 2. スタイル定義 (Fluid & Responsive with Max Width Limits)
// ==========================================
const styles = `
  :root { 
    --primary: #4f46e5; 
    --primary-light: #818cf8;
    --primary-dark: #3730a3;
    --bg-app: #f8fafc;
    --bg-card: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --radius-lg: 16px;
    --radius-md: 12px;
  }

  * { box-sizing: border-box; }
  body { 
    margin: 0; 
    background-color: var(--bg-app); 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
  }
  
  .app-container {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 16px; 
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Header Area */
  .header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .brand-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .brand-row {
    display: flex;
    align-items: center;
  }
  .brand-row h1 { 
    font-size: 22px; 
    font-weight: 800; 
    margin: 0; 
    color: var(--text-primary); 
    letter-spacing: -0.02em; 
  }
  .pro-badge { 
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); 
    color: white; 
    font-size: 10px; 
    padding: 3px 6px; 
    border-radius: 6px; 
    font-weight: 700; 
    margin-left: 8px; 
  }
  .period-desc {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .period-wrapper {
    width: 100%;
  }
  .period-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .period-selector { 
    background: white; 
    padding: 4px; 
    border-radius: var(--radius-md); 
    box-shadow: var(--shadow-sm); 
    display: flex; 
    width: 100%; 
  }
  .period-btn { 
    flex: 1; 
    padding: 10px 0;
    border: none; 
    background: transparent; 
    color: var(--text-secondary); 
    font-weight: 600; 
    font-size: 13px; 
    cursor: pointer; 
    border-radius: 8px; 
    transition: all 0.2s ease; 
  }
  .period-btn:hover { background: #f1f5f9; color: var(--primary); }
  .period-btn.active { background: var(--primary); color: white; box-shadow: var(--shadow-sm); }

  /* Desktop Header Layout */
  @media (min-width: 1024px) {
    .app-container { padding: 24px; gap: 24px; }
    .header { 
      flex-direction: row; 
      justify-content: space-between; 
      align-items: flex-end; 
    }
    .period-wrapper {
      width: auto; 
      min-width: 400px; 
    }
  }

  /* Grid Layout */
  .main-grid { 
    display: grid; 
    grid-template-columns: 1fr; 
    gap: 24px;
    width: 100%;
  }
  .main-grid > * { min-width: 0; }

  @media (min-width: 1024px) { 
    .main-grid { 
      grid-template-columns: minmax(0, 1fr) minmax(320px, 28%); 
      align-items: start; 
    } 
  }

  .card { 
    width: 100%; 
    background: var(--bg-card); 
    border-radius: var(--radius-lg); 
    border: 1px solid var(--border-color); 
    box-shadow: var(--shadow-sm); 
    overflow: hidden; 
    margin-bottom: 24px; 
  }
  .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); font-size: 16px; font-weight: 700; }
  .card-body { padding: 16px; } 
  @media (min-width: 768px) {
    .card-header { padding: 20px 24px; }
    .card-body { padding: 24px; }
  }

  .chart-container { height: 350px; width: 100%; position: relative; }
  @media (min-width: 768px) { .chart-container { height: 500px; } }
  
  .asset-group { margin-bottom: 24px; }
  .group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .group-title { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  .btn-xs { font-size: 11px; padding: 6px 12px; border-radius: 99px; border: 1px solid var(--border-color); background: white; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; }
  .btn-xs:hover { border-color: var(--primary); color: var(--primary); }

  /* Asset Grid with Max Width Control */
  .asset-grid { 
    display: grid; 
    /* auto-fillに変更: アセットが少ない時も無理に引き伸ばさず、左詰めで配置する */
    /* 最小幅を170pxに設定し、バランスを維持 */
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); 
    gap: 12px; 
    width: 100%;
  }
  .asset-card { display: flex; align-items: center; padding: 10px; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s ease; user-select: none; }
  .asset-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); border-color: var(--primary-light); }
  .asset-card.active { background: #eef2ff; border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
  .asset-card.inactive { opacity: 0.6; background: #f8fafc; }
  .asset-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 10px; flex-shrink: 0; }
  .asset-meta { overflow: hidden; width: 100%; }
  .asset-name { display: block; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .asset-metrics { font-size: 10px; color: var(--text-secondary); font-family: monospace; margin-top: 2px; }

  .sticky-panel { position: sticky; top: 24px; }
  .control-section { margin-bottom: 32px; }
  
  .control-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .input-wrapper { display: flex; align-items: center; gap: 8px; }
  .number-input { 
    width: 80px; 
    padding: 8px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 18px; 
    font-weight: 700; 
    color: var(--primary); 
    font-family: monospace; 
    text-align: right; 
    outline: none;
    transition: border 0.2s;
    background: #fff;
  }
  .number-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1); }
  .unit-label { font-size: 14px; font-weight: 700; color: var(--text-secondary); }
  
  input[type=range] { width: 100%; accent-color: var(--primary); cursor: pointer; height: 24px; }

  .preset-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .preset-btn { padding: 14px; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .preset-btn:hover { border-color: var(--primary); color: var(--primary); background: #eef2ff; }

  .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .stat-item { background: #f8fafc; padding: 12px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-color); }
  .stat-label { font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
  .stat-value { font-size: 16px; font-weight: 800; color: var(--text-primary); font-family: monospace; margin-top: 4px; }
  @media (min-width: 768px) {
    .stats-row { gap: 16px; }
    .stat-item { padding: 16px; }
    .stat-label { font-size: 11px; }
    .stat-value { font-size: 18px; }
  }

  .gpif-box { background: #ecfdf5; border: 1px solid #10b981; border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px; text-align: center; }
  .gpif-label { font-size: 10px; font-weight: 800; color: #047857; background: #d1fae5; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
  .gpif-values { display: flex; justify-content: center; gap: 16px; font-size: 13px; font-weight: 700; color: #065f46; font-family: monospace; }

  .alloc-list { border-top: 1px solid var(--border-color); padding-top: 16px; }
  .alloc-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .alloc-val { font-weight: 700; font-family: monospace; }

  .footer { text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 11px; opacity: 0.8; line-height: 1.6; }
`;

// ==========================================
// 3. コンポーネント実装
// ==========================================

const App = () => {
  const [marketData, setMarketData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [targetReturn, setTargetReturn] = useState(15.0);
  const [enabledAssets, setEnabledAssets] = useState(new Set());
  const { isReady: wasmReady, solve: solveWasm } = useRustWasm();

  // Load Data
  useEffect(() => {
    fetch(process.env.PUBLIC_URL + '/data.json')
      .then(res => res.json())
      .then(data => {
        if (data.tickers_order && !data.tickersOrder) data.tickersOrder = data.tickers_order;
        if (data.periods) {
            Object.values(data.periods).forEach(p => {
                if (p.covariance_matrix && !p.covarianceMatrix) p.covarianceMatrix = p.covariance_matrix;
            });
        }
        setMarketData(data);
        const periods = Object.keys(data.periods || {});
        if (periods.includes("5y")) setSelectedPeriod("5y");
        else if (periods.length > 0) setSelectedPeriod(periods[0]);
      })
      .catch(err => console.error("Market data load failed:", err));
  }, []);

  // Sync enabled assets
  useEffect(() => {
    if (!marketData || !selectedPeriod) return;
    const current = marketData.periods[selectedPeriod];
    if (!current) return;
    const availableNames = new Set(current.assets.map(a => a.name));

    if (enabledAssets.size === 0) {
      setEnabledAssets(availableNames);
    } else {
      const nextSet = new Set();
      enabledAssets.forEach(name => { if (availableNames.has(name)) nextSet.add(name); });
      if (nextSet.size === 0) availableNames.forEach(n => nextSet.add(n));
      setEnabledAssets(nextSet);
    }
    // eslint-disable-next-line
  }, [selectedPeriod, marketData]);

  const currentData = useMemo(() => marketData?.periods[selectedPeriod] || null, [marketData, selectedPeriod]);

  // Calc Stats
  const calculateStats = (weightsMap) => {
    if (!currentData) return { return: 0, risk: 0 };
    let pRet = 0, pVar = 0;
    const { assets, covarianceMatrix: cov } = currentData;
    
    assets.forEach(a => {
      const w = (weightsMap[a.name] || 0) / 100;
      pRet += w * a.return;
    });

    assets.forEach((aI, i) => {
      const wI = (weightsMap[aI.name] || 0) / 100;
      assets.forEach((aJ, j) => {
        const wJ = (weightsMap[aJ.name] || 0) / 100;
        pVar += wI * wJ * cov[i][j];
      });
    });
    return { return: pRet * 100, risk: Math.sqrt(pVar) * 100 };
  };

  // GPIF Benchmark
  const gpifStats = useMemo(() => {
    if (!currentData) return null;
    const avail = currentData.assets.map(a => a.name);
    const dStk = "Stk_JP_Topix"; const fStk = "Stk_SP500"; const fBnd = "Bnd_US_Agg";
    let dBnd = avail.includes("Bnd_JP") ? "Bnd_JP" : "Bnd_US_Short"; 

    const required = [dStk, fStk, fBnd, dBnd];
    if (!required.every(n => avail.includes(n))) return null;
    
    const weights = { [dStk]: 25, [fStk]: 25, [dBnd]: 25, [fBnd]: 25 };
    return calculateStats(weights);
  }, [currentData]);

  // Solver
  const solve = (targetRetPct) => {
    if (!currentData || !wasmReady) return null;
    const active = currentData.assets.filter(a => enabledAssets.has(a.name));
    if (active.length <= 1 && active.length > 0) return { [active[0].name]: 100.0 };
    if (active.length === 0) return null;

    const means = active.map(a => a.return);
    const origIndices = active.map(a => currentData.assets.indexOf(a));
    const subCov = origIndices.map(i => origIndices.map(j => currentData.covarianceMatrix[i][j]));

    try {
        const res = solveWasm(means, subCov, targetRetPct / 100.0);
        if (!res) return null;
        let wObj = {};
        active.forEach((a, i) => { wObj[a.name] = Math.max(0, res[i] * 100); });
        return wObj;
    } catch (e) { return null; }
  };

  // Max Return Calculation
  const maxAchievableReturn = useMemo(() => {
    if (!currentData || enabledAssets.size === 0) return 100;
    const active = currentData.assets.filter(a => enabledAssets.has(a.name));
    if (active.length === 0) return 0;
    return Math.max(...active.map(a => a.return)) * 100;
  }, [currentData, enabledAssets]);

  // Input Handler
  const handleReturnChange = (value) => {
    let newVal = parseFloat(value);
    if (isNaN(newVal)) return;
    if (newVal < 0) newVal = 0;
    if (newVal > maxAchievableReturn) newVal = maxAchievableReturn;
    setTargetReturn(newVal);
  };

  // Auto Clamp
  useEffect(() => {
    if (targetReturn > maxAchievableReturn) {
      setTargetReturn(Math.floor(maxAchievableReturn * 10) / 10);
    }
    // eslint-disable-next-line
  }, [maxAchievableReturn]);

  // Efficient Frontier
  const { efficientPoints, minEfficientReturn, maxSharpeReturn } = useMemo(() => {
    if (!currentData || !wasmReady) return { efficientPoints: [], minEfficientReturn: 0, maxSharpeReturn: 0 };
    const active = currentData.assets.filter(a => enabledAssets.has(a.name));
    if (active.length <= 1) return { efficientPoints: [], minEfficientReturn: 0, maxSharpeReturn: 0 };
    
    const minR = Math.min(...active.map(a => a.return)) * 100;
    const maxR = Math.max(...active.map(a => a.return)) * 100;
    const step = (maxR - minR) / 60; 
    
    const allPoints = [];
    let maxSharpe = -1; let maxSharpeRet = 0;
    for (let r = minR; r <= maxR; r += step) {
      const w = solve(r);
      if (w) {
        const s = calculateStats(w);
        allPoints.push({ x: s.risk, y: s.return });
        if (s.risk > 0.01) {
            const sharpe = s.return / s.risk;
            if (sharpe > maxSharpe) { maxSharpe = sharpe; maxSharpeRet = s.return; }
        }
      }
    }
    const minRiskPoint = allPoints.length > 0 ? allPoints.reduce((p, c) => (p.x < c.x ? p : c)) : {y:0};
    return { 
      efficientPoints: allPoints.filter(p => p.y >= minRiskPoint.y), 
      minEfficientReturn: minRiskPoint.y, 
      maxSharpeReturn: maxSharpeRet 
    };
  }, [currentData, enabledAssets, wasmReady]);

  // Init
  useEffect(() => {
    if (minEfficientReturn > 0 && targetReturn < minEfficientReturn) {
      setTargetReturn(Math.ceil(minEfficientReturn * 10) / 10);
    }
    // eslint-disable-next-line
  }, [minEfficientReturn]);


  if (!marketData || !currentData) return <div style={{padding:'40px',textAlign:'center',color:'#64748b'}}>Loading Market Data...</div>;

  const optimalWeights = solve(targetReturn);
  const stats = optimalWeights ? calculateStats(optimalWeights) : { risk: 0, return: 0 };

  const scatterData = {
    datasets: [
      { 
        label: 'Efficient Frontier', 
        data: efficientPoints, 
        showLine: true, 
        borderColor: '#4F46E5', 
        borderWidth: 2, 
        pointRadius: 0, 
        tension: 0.2, 
        order: 2 
      },
      { 
        label: 'Assets', 
        data: currentData.assets.filter(a => enabledAssets.has(a.name)).map(a => ({ x: a.risk*100, y: a.return*100, name: a.name })), 
        backgroundColor: currentData.assets.filter(a => enabledAssets.has(a.name)).map(a => getAssetColor(a.name)), 
        pointRadius: 6, 
        pointHoverRadius: 8,
        order: 3 
      },
      { 
        label: 'Optimal Portfolio', 
        data: optimalWeights ? [{x: stats.risk, y: stats.return}] : [], 
        backgroundColor: '#EF4444', 
        pointRadius: 10, 
        pointHoverRadius: 12, 
        pointStyle: 'crossRot', 
        borderColor: '#EF4444', 
        borderWidth: 3, 
        order: 1 
      },
      { 
        label: 'GPIF Benchmark', 
        data: gpifStats ? [{x: gpifStats.risk, y: gpifStats.return}] : [], 
        backgroundColor: '#10b981', 
        pointRadius: 10, 
        pointStyle: 'rectRot', 
        borderColor: '#ffffff', 
        borderWidth: 2, 
        order: 0 
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: 'Risk [%]' }, grid: { borderDash: [4, 4] } },
      y: { title: { display: true, text: 'Return [%]' }, grid: { borderDash: [4, 4] } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            const name = raw.name ? getAssetName(raw.name) : ctx.dataset.label;
            return `${name}: Risk ${raw.x.toFixed(2)}% / Ret ${raw.y.toFixed(2)}%`;
          }
        }
      }
    }
  };

  const pieLabels = optimalWeights ? Object.keys(optimalWeights).filter(k => optimalWeights[k] > 0.1) : [];
  pieLabels.sort((a,b) => optimalWeights[b] - optimalWeights[a]);
  const pieData = {
    labels: pieLabels.map(k => getAssetName(k)),
    datasets: [{ 
      data: pieLabels.map(k => optimalWeights[k]), 
      backgroundColor: pieLabels.map(k => getAssetColor(k)), 
      borderWidth: 1, 
      borderColor: '#ffffff'
    }]
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-container">
        
        <header className="header">
          <div className="brand-section">
            <div className="brand-row">
              <h1>portfolio-opt-v2</h1>
            </div>
            <p className="period-desc">Select a time horizon for historical data analysis.</p>
          </div>
          
          <div className="period-wrapper">
            <span className="period-label">Analysis Period</span>
            <div className="period-selector">
              {Object.keys(marketData.periods).map(key => (
                <button 
                  key={key} 
                  onClick={() => setSelectedPeriod(key)} 
                  className={`period-btn ${selectedPeriod === key ? 'active' : ''}`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="main-grid">
          <div className="left-column">
            <div className="card">
              <div className="card-header">📈 Efficient Frontier</div>
              <div className="card-body">
                <div className="chart-container">
                  <Scatter data={scatterData} options={chartOptions} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">🏛 Investment Universe</div>
              <div className="card-body">
                {ASSET_GROUPS.map(group => {
                   const available = group.members.filter(m => currentData.assets.some(a => a.name === m));
                   if (available.length === 0) return null;
                   const isAllSelected = available.every(m => enabledAssets.has(m));
                   
                   return (
                     <div key={group.id} className="asset-group">
                       <div className="group-header">
                         <span className="group-title">{group.label}</span>
                         <button className="btn-xs" onClick={() => { 
                           const ns = new Set(enabledAssets); 
                           available.forEach(m => isAllSelected ? ns.delete(m) : ns.add(m)); 
                           setEnabledAssets(ns); 
                         }}>
                           {isAllSelected ? 'Unselect All' : 'Select All'}
                         </button>
                       </div>
                       <div className="asset-grid">
                         {available.map(ticker => {
                           const asset = currentData.assets.find(a => a.name === ticker);
                           const isChecked = enabledAssets.has(ticker);
                           return (
                             <div 
                                key={ticker} 
                                className={`asset-card ${isChecked ? 'active' : 'inactive'}`} 
                                onClick={() => {
                                  const ns = new Set(enabledAssets);
                                  isChecked ? ns.delete(ticker) : ns.add(ticker);
                                  setEnabledAssets(ns);
                                }}
                             >
                               <div className="asset-dot" style={{backgroundColor: getAssetColor(ticker)}}></div>
                               <div className="asset-meta">
                                 <span className="asset-name">{getAssetName(ticker)}</span>
                                 <div className="asset-metrics">
                                   R:{(asset.return*100).toFixed(1)}% σ:{(asset.risk*100).toFixed(1)}%
                                 </div>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>

          <aside className="right-column">
            <div className="card sticky-panel">
              <div className="card-header">🎯 Optimizer Config</div>
              <div className="card-body">
                
                <div className="control-section">
                  <div className="preset-btns">
                    <button className="preset-btn" onClick={() => setTargetReturn(minEfficientReturn)}>
                      <span>🛡️</span> Min Risk
                    </button>
                    <button className="preset-btn" onClick={() => setTargetReturn(maxSharpeReturn)}>
                      <span>⚡</span> Max Sharpe
                    </button>
                  </div>

                  <div className="control-header">
                    <span className="stat-label">Target Return</span>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="number-input" 
                        value={targetReturn} 
                        onChange={(e) => handleReturnChange(e.target.value)} 
                        step="0.1"
                        min="0"
                        max={maxAchievableReturn}
                      />
                      <span className="unit-label">%</span>
                    </div>
                  </div>
                  
                  <input 
                    type="range" 
                    min="0" 
                    max={Math.ceil(maxAchievableReturn)} 
                    step="0.1" 
                    value={targetReturn} 
                    onChange={(e) => handleReturnChange(e.target.value)} 
                  />
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#94a3b8', marginTop:'4px'}}>
                    <span>0%</span>
                    <span>Max: {maxAchievableReturn.toFixed(1)}%</span>
                  </div>
                </div>

                {optimalWeights ? (
                  <>
                    <div className="stats-row">
                      <div className="stat-item">
                        <div className="stat-label">Exp. Risk</div>
                        <div className="stat-value" style={{color: '#f59e0b'}}>{stats.risk.toFixed(2)}%</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Sharpe</div>
                        <div className="stat-value" style={{color: '#4f46e5'}}>{stats.risk>0 ? (stats.return/stats.risk).toFixed(2) : "0.00"}</div>
                      </div>
                    </div>

                    {gpifStats && (
                      <div className="gpif-box">
                        <span className="gpif-label">GPIF BENCHMARK</span>
                        <div className="gpif-values">
                          <span>Ret: {gpifStats.return.toFixed(2)}%</span>
                          <span>Risk: {gpifStats.risk.toFixed(2)}%</span>
                        </div>
                      </div>
                    )}

                    <div style={{height:'220px', margin: '20px 0'}}>
                      <Pie data={pieData} options={{
                        responsive:true, 
                        maintainAspectRatio:false, 
                        plugins:{legend:{display:false}}
                      }} />
                    </div>
                    
                    <div className="alloc-list">
                        {pieLabels.map(t => (
                          <div key={t} className="alloc-item">
                            <span style={{display:'flex', alignItems:'center'}}>
                              <div className="asset-dot" style={{backgroundColor: getAssetColor(t)}}></div>
                              {getAssetName(t)}
                            </span>
                            <span className="alloc-val">{optimalWeights[t].toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <div style={{padding:'24px', textAlign:'center', color:'#ef4444', background:'#fef2f2', borderRadius:'12px', fontSize:'13px', fontWeight:'700'}}>
                    Unachievable Return
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <footer className="footer">
          <p>
            ※ 本シミュレーションは過去データに基づく推計であり、将来の運用成果を保証しません。<br/>
            Data Source: Yahoo Finance & Google Finance (Adjusted Close). Updated: {marketData.last_updated}
          </p>
        </footer>
      </div>
    </>
  );
};

export default App;