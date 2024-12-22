include "./mimc.circom";

/*
 * IfThenElse sets `out` to `true_value` if `condition` is 1 and `out` to
 * `false_value` if `condition` is 0.
 *
 * It enforces that `condition` is 0 or 1.
 *
 */
template IfThenElse() {
    signal input condition;
    signal input true_value;
    signal input false_value;
    signal output out;

    // Helper signal to store the difference between true_value and false_value
    signal diff;

    // Ensure that condition is binary (0 or 1)
    condition * (1 - condition) === 0;

    // Calculate the difference between true_value and false_value
    diff <== true_value - false_value;

    // Calculate the output based on the condition
    out <== (condition * diff) + false_value;
}

/*
 * SelectiveSwitch takes two data inputs (`in0`, `in1`) and produces two ouputs.
 * If the "select" (`s`) input is 1, then it inverts the order of the inputs
 * in the ouput. If `s` is 0, then it preserves the order.
 *
 * It enforces that `s` is 0 or 1.
 */
template SelectiveSwitch() {
    signal input in0;
    signal input in1;
    signal input s;
    signal output out0;
    signal output out1;

    s * (1 - s) === 0
    
    // 创建第一个组件，用于计算 out0
    component firstSelector = IfThenElse();
    firstSelector.condition <== s;
    firstSelector.true_value <== in1;
    firstSelector.false_value <== in0;

    // 创建第二个组件，用于计算 out1
    component secondSelector = IfThenElse();
    secondSelector.condition <== s;
    secondSelector.true_value <== in0;
    secondSelector.false_value <== in1;

    // 根据条件将结果赋值给输出
    out0 <== firstSelector.out;
    out1 <== secondSelector.out;
}


/*
 * Verifies the presence of H(`nullifier`, `nonce`) in the tree of depth
 * `depth`, summarized by `digest`.
 * This presence is witnessed by a Merle proof provided as
 * the additional inputs `sibling` and `direction`, 
 * which have the following meaning:
 *   sibling[i]: the sibling of the node on the path to this coin
 *               at the i'th level from the bottom.
 *   direction[i]: "0" or "1" indicating whether that sibling is on the left.
 *       The "sibling" hashes correspond directly to the siblings in the
 *       SparseMerkleTree path.
 *       The "direction" keys the boolean directions from the SparseMerkleTree
 *       path, casted to string-represented integers ("0" or "1").
 */
template Spend(depth) {
    signal input digest;
    signal input nullifier;
    signal private input nonce;
    signal private input sibling[depth];
    signal private input direction[depth];

    // 哈希计算组件数组，包括 depth + 1 个级别
    component hash_calculations[depth + 1];

    // 第0级计算 H(nullifier, digest)
    hash_calculations[0] = Mimc2();
    hash_calculations[0].in0 <== nullifier;
    hash_calculations[0].in1 <== nonce;

    // 存储路径上的选择开关组件
    component path_switches[depth];

    // 设置路径约束和选择操作
    for (var i = 0; i < depth; ++i) {
        path_switches[i] = SelectiveSwitch();
        
        // 计算根据方向决定的哈希值
        path_switches[i].in0 <== hash_calculations[i].out;
        path_switches[i].in1 <== sibling[i];
        path_switches[i].s <== direction[i];

        // 计算当前级别的哈希结果
        hash_calculations[i + 1] = Mimc2();
        hash_calculations[i + 1].in0 <== path_switches[i].out0;
        hash_calculations[i + 1].in1 <== path_switches[i].out1;
    }

    // 最终验证计算结果与目标 digest 是否一致
    hash_calculations[depth].out === digest;
}

component main = Spend(10);