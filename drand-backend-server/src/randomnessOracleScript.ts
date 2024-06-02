import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

import {randomnessOracleAbi, randomnessOracleAddress} from "./contracts/RandomnessOracle";

//************************ */


//** */ Viem Configuration */
const publicClient = createPublicClient({
    chain: anvil,
    transport: http(),
});

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const walletclient = createWalletClient({
    account,
    chain: anvil,
    transport: http()
})  
//************************ */

async function checkRandomness() {
    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const currentBlockTimestamp = block.timestamp;

    const res = await publicClient.readContract({
        address: randomnessOracleAddress,
        abi: randomnessOracleAbi,
        functionName: "computeRandomness",
        args: [currentBlockTimestamp]
    })

    console.log("\nTimestamp: ", currentBlockTimestamp, " : Randomness: ", res, "\n");
}

async function main() {
    setInterval(checkRandomness, 2000)
}

main().catch((error) => {
    console.error("Scripting script broke down: ", error);
  });