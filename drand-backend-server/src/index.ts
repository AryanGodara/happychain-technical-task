import { fetchBeacon, FastestNodeClient } from 'drand-client';

import express, { Express, Request, Response } from "express";
const bodyParser = require('body-parser');
// const cors = require('cors');
import dotenv from 'dotenv';

import { readContract, waitForTransactionReceipt as waitForTxReceipt } from 'viem/actions';
import { createPublicClient, createWalletClient, http, getContract, erc20Abi_bytes32 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

//** Contracts Configuration */
import {drandOracleAbi, drandOracleAddress} from "./contracts/DrandOracle";
import {sequencerRandomOracleAbi, sequencerRandomOracleAddress} from "./contracts/SequencerRandomOracle";
import {randomnessOracleAbi, randomnessOracleAddress} from "./contracts/RandomnessOracle";

//** Express Configuration */
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
// Enable CORS for all routes and origins
// app.use(cors());

//** */ Viem Configuration */
const publicClient = createPublicClient({
    // batch: {
    //     multicall: true, 
    // },
    chain: anvil,
    transport: http(),
});


const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const walletclient = createWalletClient({
    account,
    chain: anvil,
    transport: http()
})  

//** Drand configuration */
const chainHash = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';
const publicKey = '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31';
const options = {
  disableBeaconVerification: false,
  noCache: false,
  chainVerificationParams: { chainHash, publicKey },
};
const urls = [
  'https://api.drand.sh',
  'https://drand.cloudflare.com',
];
const fastestNodeClient = new FastestNodeClient(urls, options);


// Genesis block time (UNIX timestamp in seconds)
const GENESIS_TIME = 1717251820; // And "even" number for the genesis time for the anvil chain; 20s after anvil chain genesis
// let currentTime = Math.floor( Date.now()/1000 );
let currentTime = GENESIS_TIME + 10;

// Function to calculate the round number from the current timestamp
function getRoundNumber(timestamp: number): number {
    timestamp -= 9; // DELAY = 9s
    return Math.floor((timestamp - GENESIS_TIME) / 3);
}

async function fetchAndPushRandomness() {
  try {
    currentTime += 3
    const timestamp = currentTime;
    const roundNumber = getRoundNumber(timestamp);

    fastestNodeClient.start();
    const theLatestBeaconFromTheFastestClient = await fetchBeacon(fastestNodeClient, roundNumber);
    fastestNodeClient.stop();

    const randomness = theLatestBeaconFromTheFastestClient.randomness;

    console.log('Fetched randomness:', randomness, 'at timestamp:', timestamp);

    const txHash = await walletclient.writeContract({
        address: drandOracleAddress,
        abi: drandOracleAbi,
        functionName: "addDrandValue",
        args: [BigInt(timestamp), `0x${randomness}`]
    })
    console.log('Transaction sent, hash:', txHash);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const res = await publicClient.readContract({
        address: drandOracleAddress,
        abi: drandOracleAbi,
        functionName: "unsafeGetDrandValue",
        args: [BigInt(timestamp)]
    })

    console.log('Read Drand value:', res, 'at timestamp:', timestamp);

    } catch (error) {
        console.error('Error fetching randomness or sending transaction:', error);
    }
}

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);

    // Schedule the task to run every 3 seconds
    setInterval(fetchAndPushRandomness, 3000);
});
