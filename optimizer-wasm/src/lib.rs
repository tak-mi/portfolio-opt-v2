use wasm_bindgen::prelude::*;
use clarabel::solver::*;
use clarabel::algebra::*;

#[wasm_bindgen]
pub fn solve_qp(
    mean_returns: &[f64],
    cov_matrix_flat: &[f64],
    target_return: f64,
) -> Vec<f64> {
    let n = mean_returns.len();

    // --- 1. P行列 (共分散行列) ---
    // Clarabel用のCSC形式作成
    let mut p_col_ptrs = Vec::with_capacity(n + 1);
    let mut p_row_indices = Vec::new();
    let mut p_values = Vec::new();
    
    p_col_ptrs.push(0);
    
    for col in 0..n {
        for row in 0..=col { // 上三角のみを使用
            let val = cov_matrix_flat[row * n + col];
            if val.abs() > 1e-12 || row == col {
                p_row_indices.push(row);
                p_values.push(val);
            }
        }
        p_col_ptrs.push(p_values.len());
    }

    let p_matrix = CscMatrix::new(
        n,             
        n,             
        p_col_ptrs,    
        p_row_indices, 
        p_values,      
    );

    // --- 2. qベクトル ---
    let q = vec![0.0; n];

    // --- 3. 制約条件 A, b ---
    let num_constraints = 2 + n;
    
    let mut a_col_ptrs = Vec::with_capacity(n + 1);
    let mut a_row_indices = Vec::new();
    let mut a_values = Vec::new();

    a_col_ptrs.push(0);

    for col in 0..n {
        // 制約1: sum(w) = 1.0
        a_row_indices.push(0);
        a_values.push(1.0);

        // 制約2: sum(w*r) = target
        a_row_indices.push(1);
        a_values.push(mean_returns[col]);

        // 制約3: w >= 0 ( -w <= 0 に変換 )
        a_row_indices.push(2 + col);
        a_values.push(-1.0);

        a_col_ptrs.push(a_values.len());
    }

    let a_matrix = CscMatrix::new(
        num_constraints, 
        n,               
        a_col_ptrs,
        a_row_indices,
        a_values,
    );

    let mut b = vec![0.0; num_constraints];
    b[0] = 1.0;            
    b[1] = target_return;  

    // --- 4. コーン定義 ---
    let cones = [
        SupportedConeT::ZeroConeT(2),        // 等式制約
        SupportedConeT::NonnegativeConeT(n), // 非負制約
    ];

    // --- 5. 設定と解決 (★ここを修正しました) ---
    let settings = DefaultSettings::default();
    
    // .expect("...") を追加して、Resultの中身(ソルバー本体)を取り出します
    let mut solver = DefaultSolver::new(
        &p_matrix,
        &q,
        &a_matrix,
        &b,
        &cones,
        settings
    ).expect("Solver initialization failed");

    solver.solve();

    match &solver.solution.x {
        x if !x.is_empty() => x.clone(),
        _ => vec![0.0; n],
    }
}