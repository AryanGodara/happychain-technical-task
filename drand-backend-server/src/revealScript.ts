import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

import {sequencerRandomOracleAbi, sequencerRandomOracleAddress} from "./contracts/SequencerRandomOracle";

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
    let currentBlockTimestamp = block.timestamp;
    // currentBlockTimestamp = currentBlockTimestamp - BigInt(10);

    const res = await publicClient.readContract({
        address: sequencerRandomOracleAddress,
        abi: sequencerRandomOracleAbi,
        functionName: "unsafeGetSequencerValue",
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