const { docopt } = require("docopt");
const { mimc2 } = require("./mimc.js");
const { SparseMerkleTree } = require("./sparse_merkle_tree.js");
const fs = require("fs");
const doc = `Usage:
  compute_spend_inputs.js [options] <depth> <transcript> <nullifier>
  compute_spend_inputs.js -h | --help

Options:
  -o <file>     name of the created witness file [default: input.json]
  -h --help     Print this message

Arguments:
   <depth>       The number of non-root layers in the merkle tree.
   <transcript>  The file containing transcript of all coins.
                 A file with a line for each coin.
                 Each coin is either a single number (the coin
                 itself) or it can be two space-separated number, which are, in
                 order, the nullifier and the nonce for the coin.

                 Example:

                     1839475893
                     1984375234 2983475298
                     3489725451 9834572345
                     3452345234

   <nullifier>   The nullifier to print a witness of validity for.
                 Must be present in the transcript.
`

/*
 * Computes inputs to the Spend circuit.
 *
 * Inputs:
 *   depth: the depth of the merkle tree being used.
 *   transcript: A list of all coins added to the tree.
 *               Each item is an array.
 *               If the array hash one element, then that element is the coin.
 *               Otherwise the array will have two elements, which are, in order:
 *                 the nullifier and
 *                 the nonce
 *               This list will contain **no** duplicate nullifiers or coins.
 *   nullifier: The nullifier to print inputs to validity verifier for.
 *              This nullifier will be one of the nullifiers in the transcript.
 *
 * Return:
 *   an object of the form:
 * {
 *   "digest"            : ...,
 *   "nullifier"         : ...,
 *   "nonce"             : ...,
 *   "sibling[0]"        : ...,
 *   "sibling[1]"        : ...,
 *      ...
 *   "sibling[depth-1]"  : ...,
 *   "direction[0]"      : ...,
 *   "direction[1]"      : ...,
 *      ...
 *   "direction[depth-1]": ...,
 * }
 * where each ... is a string-represented field element (number)
 * notes about each:
 *   "digest": the digest for the whole tree after the transcript is
 *                  applied.
 *   "nullifier": the nullifier for the coin being spent.
 *   "nonce": the nonce for that coin
 *   "sibling[i]": the sibling of the node on the path to this coin
 *                 at the i'th level from the bottom.
 *   "direction[i]": "0" or "1" indicating whether that sibling is on the left.
 *       The "sibling" hashes correspond directly to the siblings in the
 *       SparseMerkleTree path.
 *       The "direction" keys the boolean directions from the SparseMerkleTree
 *       path, casted to string-represented integers ("0" or "1").
 */
function computeInput(depth, transcript, nullifier) {
    // 创建一个稀疏 Merkle 树实例
    const merkleTree = new SparseMerkleTree(depth);

    // 初始化用于存储目标 nullifier 对应的 commitment 和 nonce
    let commitmentToVerify = null, associatedNonce = [null, null];

    // 逐条处理 transcript 中的数据并插入 Merkle 树
    for (let idx = 0; idx < transcript.length; idx++) {
        const record = transcript[idx];
        let currentCommitment = null;

        // 如果 record 只有一个元素
        if (record.length === 1) {
            currentCommitment = record[0];
        } 
        // 如果 record 包含两个元素
        else if (record.length === 2) {
            const [currentNullifier, currentNonce] = record;
            currentCommitment = mimc2(currentNullifier, currentNonce);

            // 如果当前 nullifier 匹配给定 nullifier，记录该 commitment 和 nonce
            if (nullifier === currentNullifier) {
                if (commitmentToVerify !== null) {
                    throw "发现重复项!";
                }
                commitmentToVerify = currentCommitment;
                associatedNonce = currentNonce;
            }
        } else {
            throw "Transcript 数据无效: " + JSON.stringify(transcript);
        }

        // 确保 commitment 不为空
        if (currentCommitment === null) {
            throw "commitment 为空!";
        }

        // 将 commitment 插入 Merkle 树
        merkleTree.insert(currentCommitment);
    }

    // 如果没有找到目标 nullifier 的 commitment，抛出错误
    if (commitmentToVerify === null) {
        throw "在 transcript 中未找到对应的 nullifier";
    }

    // 获取该 commitment 的 Merkle 路径
    const merklePath = merkleTree.path(commitmentToVerify);
    const output = {
        digest: merkleTree.digest,
        nullifier: nullifier,
        nonce: associatedNonce,
    };

    // 将 Merkle 路径中的每一项添加到输出
    for (let i = 0; i < depth; i++) {
        const [siblingHash, directionFlag] = merklePath[i];
        output[`sibling[${i}]`] = siblingHash.toString();
        output[`direction[${i}]`] = directionFlag ? "1" : "0";
    }

    return output;
}

module.exports = { computeInput };

// If we're not being imported
if (!module.parent) {
    const args = docopt(doc);
    const transcript =
        fs.readFileSync(args['<transcript>'], { encoding: 'utf8' } )
        .split(/\r?\n/)
        .filter(l => l.length > 0)
        .map(l => l.split(/\s+/));
    const depth = parseInt(args['<depth>']);
    const nullifier = args['<nullifier>'];
    const input = computeInput(depth, transcript, nullifier);
    fs.writeFileSync(args['-o'], JSON.stringify(input) + "\n");
} 