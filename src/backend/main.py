import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from pypfopt import expected_returns, risk_models

# --- 設定: NISA PRO 究極アセットリスト (全24種) ---
ASSETS_CONFIG = {
    # 【日本資産】
    "Stk_JP_Topix":   {"symbol": "1348.T", "currency": "JPY"}, # TOPIX
    "Stk_JP_Nikkei":  {"symbol": "1321.T", "currency": "JPY"}, # 日経225
    "Stk_JP_HighDiv": {"symbol": "1489.T", "currency": "JPY"}, # 日本高配当
    "Stk_JP_JPX400":  {"symbol": "1591.T", "currency": "JPY"}, # JPX400
    "Bnd_JP":         {"symbol": "2510.T", "currency": "JPY"}, # 日本国債 (20y補完対象)
    "Reit_JP":        {"symbol": "1343.T", "currency": "JPY"}, # J-REIT

    # 【米国・全世界・先進国】
    "Stk_AllCountry": {"symbol": "ACWI", "currency": "USD"},  # オルカン
    "Stk_SP500":      {"symbol": "SPY",  "currency": "USD"},  # S&P500
    "Stk_Nasdaq":     {"symbol": "QQQ",  "currency": "USD"},  # NASDAQ100
    "Stk_NYDow":      {"symbol": "DIA",  "currency": "USD"},  # NYダウ
    "Stk_Kokusai":    {"symbol": "EFA",  "currency": "USD"},  # 先進国株
    "Stk_US_HighDiv": {"symbol": "VIG",  "currency": "USD"},  # 米国増配株
    "Stk_FangPlus":   {"symbol": "FNGS", "currency": "USD"},  # FANG+ (米ETN)

    # 【新興国】
    "Stk_Emerging":   {"symbol": "EEM",  "currency": "USD"},  # 新興国株
    "Stk_India":      {"symbol": "EPI",  "currency": "USD"},  # インド株

    # 【海外債券】
    "Bnd_US_Short":   {"symbol": "SHY",  "currency": "USD"},  # 米短期債
    "Bnd_US_Agg":     {"symbol": "AGG",  "currency": "USD"},  # 米総合債
    "Bnd_US_20y":     {"symbol": "TLT",  "currency": "USD"},  # 米超長期債
    "Bnd_US_HighYld": {"symbol": "HYG",  "currency": "USD"},  # 米ハイイールド

    # 【オルタナティブ・商品・クリプト】
    "Reit_Global":    {"symbol": "RWO",  "currency": "USD"},  # 世界REIT
    "Cmdty_Gold":     {"symbol": "GLD",  "currency": "USD"},  # 金
    "Cmdty_Silver":   {"symbol": "SLV",  "currency": "USD"},  # 銀
    "Cmdty_Oil":      {"symbol": "USO",  "currency": "USD"},  # 原油
    "Crypto_BTC":     {"symbol": "BTC-JPY", "currency": "JPY"} # BTC
}

ANALYSIS_PERIODS = [1, 3, 5, 10, 20]
OUTPUT_FILE = "../public/data.json"

def main():
    print(f"全{len(ASSETS_CONFIG)}銘柄のデータ取得を開始...")
    symbols = [cfg["symbol"] for cfg in ASSETS_CONFIG.values()]
    symbols.append("JPY=X") # 為替
    
    raw = yf.download(symbols, period="max", auto_adjust=True)['Close']
    df = raw.ffill().bfill()
    usdjpy = df["JPY=X"]
    
    # 円建て換算
    prices = pd.DataFrame(index=df.index)
    for aid, cfg in ASSETS_CONFIG.items():
        sym = cfg["symbol"]
        prices[aid] = (df[sym] * usdjpy) if cfg["currency"] == "USD" else df[sym]

    # --- 日本国債(Bnd_JP)の20年補完 (NOMURA-BPI近似) ---
    if "Bnd_JP" in prices.columns:
        first_idx = prices["Bnd_JP"].first_valid_index()
        start_20y = prices.index[-1] - pd.DateOffset(years=20)
        mask = (prices.index < first_idx) & (prices.index >= start_20y)
        ref_val = prices.loc[first_idx, "Bnd_JP"]
        days_back = (first_idx - prices.index[mask]).days
        prices.loc[mask, "Bnd_JP"] = ref_val / (1.012 ** (days_back / 365)) # 年率1.2%逆算

    monthly = prices.resample('M').last().ffill()
    output = {"last_updated": pd.Timestamp.now().isoformat(), "tickersOrder": list(ASSETS_CONFIG.keys()), "periods": {}}

    for years in ANALYSIS_PERIODS:
        period_key = f"{years}y"
        data = monthly.tail(years * 12).ffill().bfill()
        valid = data.dropna(axis=1, how='any')
        if valid.shape[1] < 2: continue
            
        mu = expected_returns.mean_historical_return(valid, frequency=12)
        S = risk_models.sample_cov(valid, frequency=12)
        
        assets_list = [{"name": aid, "return": mu[aid], "risk": np.sqrt(S.loc[aid, aid])} 
                       for aid in ASSETS_CONFIG.keys() if aid in valid.columns]
        
        vids = [a["name"] for a in assets_list]
        cov_list = [[S.loc[id1, id2] for id2 in vids] for id1 in vids]

        output["periods"][period_key] = {"assets": assets_list, "covarianceMatrix": cov_list}
        print(f"[{period_key}] 完了: {len(assets_list)}銘柄")

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

if __name__ == "__main__":
    main()