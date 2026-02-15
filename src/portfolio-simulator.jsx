import React, { useState, useEffect, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { multiply, transpose, dot } from 'mathjs'; // 行列計算用: npm install mathjs

const PortfolioSimulator = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pythonから出力されたデータ
  const [marketData, setMarketData] = useState({
    assets: [],
    covarianceMatrix: [],
    tickersOrder: []
  });

  // ユーザーの編集用State
  const [userWeights, setUserWeights] = useState({}); // { "Stock_JP": 20, ... }
  const [targetReturn, setTargetReturn] = useState(5);
  const [showOptimal, setShowOptimal] = useState(false);

  // --- 1. データ取得 (data.json) ---
  useEffect(() => {
    fetch('/data.json')
      .then(res => {
        if (!res.ok) throw new Error("データの読み込みに失敗しました");
        return res.json();
      })
      .then(data => {
        setMarketData({
          assets: data.assets,
          covarianceMatrix: data.covariance_matrix,
          tickersOrder: data.tickers_order
        });
        
        // 初期配分：均等配分
        const initialWeights = {};
        const count = data.assets.length;
        data.assets.forEach(a => {
          initialWeights[a.name] = 100 / count;
        });
        setUserWeights(initialWeights);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // --- 2. ポートフォリオ計算ロジック (行列計算) ---
  const currentPortfolio = useMemo(() => {
    if (loading || !marketData.assets.length) return { return: 0, risk: 0 };

    // 配分ベクトル (w)
    const weightsVector = marketData.tickersOrder.map(name => (userWeights[name] || 0) / 100);
    
    // 期待リターンベクトル (μ)
    const returnsVector = marketData.tickersOrder.map(name => {
      const asset = marketData.assets.find(a => a.name === name);
      return asset ? asset.return : 0;
    });

    // 1. ポートフォリオ・リターン: R = w • μ
    const pReturn = dot(weightsVector, returnsVector);

    // 2. ポートフォリオ・リスク(分散): σ^2 = w^T * Σ * w
    // mathjs を使って行列計算
    try {
      const wT_Sigma = multiply(weightsVector, marketData.covarianceMatrix);
      const variance = dot(wT_Sigma, weightsVector);
      return { 
        return: pReturn * 100, // %表記へ
        risk: Math.sqrt(variance) * 100 
      };
    } catch (e) {
      console.error("Calculation Error", e);
      return { return: 0, risk: 0 };
    }
  }, [userWeights, marketData]);

  // --- 3. UI操作系ハンドラ ---
  const updateWeight = (name, value) => {
    const newVal = parseFloat(value);
    setUserWeights(prev => ({ ...prev, [name]: newVal }));
  };

  const normalizeWeights = () => {
    const total = Object.values(userWeights).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    
    const newWeights = {};
    Object.keys(userWeights).forEach(key => {
      newWeights[key] = (userWeights[key] / total) * 100;
    });
    setUserWeights(newWeights);
  };

  // --- 4. 効率的フロンティア生成 (モンテカルロ法) ---
  const efficientFrontier = useMemo(() => {
    if (loading) return [];
    const points = [];
    const numPoints = 200; // 点の数
    const n = marketData.tickersOrder.length;

    for (let i = 0; i < numPoints; i++) {
      // ランダムな配分を作成
      let w = Array.from({ length: n }, () => Math.random());
      const total = w.reduce((a, b) => a + b, 0);
      w = w.map(val => val / total); // 正規化

      // リターン計算
      const returnsVector = marketData.tickersOrder.map(name => 
        marketData.assets.find(a => a.name === name).return
      );
      const ret = dot(w, returnsVector);

      // リスク計算
      const wT_Sigma = multiply(w, marketData.covarianceMatrix);
      const variance = dot(wT_Sigma, w);
      
      points.push({ risk: Math.sqrt(variance) * 100, return: ret * 100 });
    }
    return points;
  }, [marketData]);


  if (loading) return <div style={{color: 'white', padding: '2rem'}}>Loading Market Data...</div>;
  if (error) return <div style={{color: 'red', padding: '2rem'}}>Error: {error}</div>;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      padding: '3rem 2rem',
      fontFamily: 'sans-serif',
      color: '#f1f5f9'
    }}>
      <h1 style={{ textAlign: 'center', fontFamily: 'serif', fontSize: '2.5rem' }}>MPT Simulator</h1>
      
      {/* 統計情報カード */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="期待リターン" value={currentPortfolio.return} color="#60a5fa" />
        <StatCard label="リスク (標準偏差)" value={currentPortfolio.risk} color="#f59e0b" />
        <StatCard label="シャープレシオ" value={currentPortfolio.return / currentPortfolio.risk} color="#34d399" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* 左カラム: 配分設定 */}
        <div className="card" style={{ background: 'rgba(30,41,59,0.6)', padding: '1.5rem', borderRadius: '1rem' }}>
          <h3>資産配分設定</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {marketData.assets.map(asset => (
              <div key={asset.name} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>{asset.name} ({getAssetLabel(asset.type)})</span>
                  <span>{userWeights[asset.name]?.toFixed(1)}%</span>
                </div>
                <input
                  type="range" min="0" max="100" step="1"
                  value={userWeights[asset.name] || 0}
                  onChange={(e) => updateWeight(asset.name, e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
          <button onClick={normalizeWeights} style={{ width: '100%', marginTop: '1rem', padding: '0.5rem' }}>
            合計100%に正規化
          </button>
        </div>

        {/* 右カラム: チャート */}
        <div className="card" style={{ background: 'rgba(30,41,59,0.6)', padding: '1.5rem', borderRadius: '1rem' }}>
           <h3>効率的フロンティア & 現在位置</h3>
           <ResponsiveContainer width="100%" height={400}>
             <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
               <XAxis type="number" dataKey="risk" name="Risk" stroke="#94a3b8" label={{ value: 'Risk (%)', position: 'bottom', fill: '#94a3b8' }} />
               <YAxis type="number" dataKey="return" name="Return" stroke="#94a3b8" label={{ value: 'Return (%)', angle: -90, position: 'left', fill: '#94a3b8' }} />
               <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1e293b' }} />
               <Legend />
               <Scatter name="Random Portfolios" data={efficientFrontier} fill="#8884d8" fillOpacity={0.5} />
               <Scatter name="Current Portfolio" data={[currentPortfolio]} fill="#fbbf24" shape="star" r={10} />
             </ScatterChart>
           </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ヘルパーコンポーネント
const StatCard = ({ label, value, color }) => (
  <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${color}` }}>
    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: color }}>
      {isNaN(value) ? '-' : value.toFixed(2)}%
    </div>
  </div>
);

const getAssetLabel = (type) => {
  const map = { stock: '株', bond: '債券', commodity: 'コモディティ', crypto: '仮想通貨' };
  return map[type] || type;
};

export default PortfolioSimulator;