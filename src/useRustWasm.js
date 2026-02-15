// src/useRustWasm.js
import { useState, useEffect } from 'react';
// さっきコピーしたJSファイルをインポート
// init はWASMを初期化する関数、solve_qp はRustで書いた計算関数です
import init, { solve_qp } from './wasm/optimizer_wasm.js';

export const useRustWasm = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadWasm = async () => {
      try {
        // publicフォルダに置いた .wasm ファイルを指定して初期化
        // process.env.PUBLIC_URL は、本番環境でもパスがズレないようにするためのおまじない
        await init(process.env.PUBLIC_URL + '/wasm/optimizer_wasm_bg.wasm');
        
        setIsReady(true);
        console.log("🦀 Rust WASM Ready!");
      } catch (err) {
        console.error("WASM Load Error:", err);
      }
    };
    loadWasm();
  }, []);

  const solve = (means, covMatrix, targetReturn) => {
    if (!isReady) return null;

    try {
      // 2次元配列の共分散行列を、1次元配列(フラット)に変換
      const flatCov = covMatrix.flat();
      
      // Rustの関数を実行！ (超高速)
      const result = solve_qp(
        new Float64Array(means),
        new Float64Array(flatCov),
        targetReturn
      );
      
      // 結果をJSの普通の配列に変換して返す
      return Array.from(result);
    } catch (e) {
      console.error("Optimization Error:", e);
      return null;
    }
  };

  return { isReady, solve };
};