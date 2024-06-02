import { fetchBeacon, FastestNodeClient } from 'drand-client';

import express, { Express, Request, Response } from "express";
const bodyParser = require('body-parser');
// const cors = require('cors');
import dotenv from 'dotenv';

import { readContract, waitForTransactionReceipt as waitForTxReceipt } from 'viem/actions';
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

import { keccak256 } from '@ethersproject/keccak256';
import { randomBytes } from '@ethersproject/random';

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
const GENESIS_TIME = 1717251800; // And "even" number for the genesis time for the anvil chain; 20s after anvil chain genesis
let currentTime = GENESIS_TIME + 20;
const PRECOMMIT_DELAY = 10;

// Map to store sequencerRandom and commitments
const commitments: Map<number, { commitment: string, sequencerRandom: string }> = new Map();

// Function to calculate the round number from the current timestamp
function getRoundNumber(timestamp: number): number {
    timestamp -= 9; // DELAY = 9s
    return Math.floor((timestamp - GENESIS_TIME) / 3);
}

// Function to retry sending a transaction
async function sendTransactionWithRetry(timestamp: number, randomness: string, retries = 5) {
    // for ( let i = 0 ; i < 2 ; i++ ) {
    //     try {
    //         const txHash = await walletclient.writeContract({
    //             address: drandOracleAddress,
    //             abi: drandOracleAbi,
    //             functionName: "addDrandValue",
    //             args: [BigInt(timestamp+30), `0x${"abcd"}`]
    //         });
    //         console.log(`Transaction sent, hash: ${txHash} (attempt ${i})`);
    //         return txHash;
    //     } catch (error: any) {
    //         if (error.message.includes('Drand value cannot be backfilled after DRAND_TIMEOUT')) {
    //             console.error('Transaction failed due to DRAND_TIMEOUT condition, not retrying.');
    //             break;
    //         } else {
    //             console.error(`Transaction attempt ${i} failed, retrying...`);
    //             if (i === retries) throw error;
    //         }
    //     }
    // }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const txHash = await walletclient.writeContract({
                address: drandOracleAddress,
                abi: drandOracleAbi,
                functionName: "addDrandValue",
                args: [BigInt(timestamp), `0x${randomness}`]
            });
            console.log(`Transaction sent, hash: ${txHash} (attempt ${attempt})`);
            return txHash;
        } catch (error: any) {
            if (error.message.includes('Drand value cannot be backfilled after DRAND_TIMEOUT')) {
                console.error('Transaction failed due to DRAND_TIMEOUT condition, not retrying.');
                break;
            } else {
                console.error(`Transaction attempt ${attempt} failed, retrying...`);
                if (attempt === retries) throw error;
            }
        }
    }
}

async function fetchAndPushRandomness() {
    try {
        currentTime += 3;
        const timestamp = currentTime;
        const roundNumber = getRoundNumber(timestamp);

        fastestNodeClient.start();
        const theLatestBeaconFromTheFastestClient = await fetchBeacon(fastestNodeClient, roundNumber);
        fastestNodeClient.stop();

        const randomness = theLatestBeaconFromTheFastestClient.randomness;

        console.log('Fetched randomness:', randomness, 'at timestamp:', timestamp);

        const txHash = await sendTransactionWithRetry(timestamp, randomness);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const res = await publicClient.readContract({
            address: drandOracleAddress,
            abi: drandOracleAbi,
            functionName: "unsafeGetDrandValue",
            args: [BigInt(timestamp)]
        });

        console.log('Read Drand value:', res, 'at timestamp:', timestamp);
    } catch (error) {
        console.error('Error fetching randomness or sending transaction:', error);
    }
}

// Function to retry sending a transaction for SequencerRandomOracle
async function sendSequencerTransactionWithRetry(timestamp: number, commitment: string, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const txHash = await walletclient.writeContract({
                address: sequencerRandomOracleAddress,
                abi: sequencerRandomOracleAbi,
                functionName: "postCommitment",
                args: [BigInt(timestamp), `0x${commitment}`]
            });
            console.log(`Transaction sent, hash: ${txHash} (attempt ${attempt})`);
            return txHash;
        } catch (error: any) {
            if (error.message.includes('Commitment must be posted in advance')) {
                console.error('Transaction failed due to commitment timing condition, not retrying.');
                break;
            } else {
                console.error(`Transaction attempt ${attempt} failed, retrying...`);
                if (attempt === retries) throw error;
            }
        }
    }
}

// Function to generate and commit sequencer random values
async function generateAndCommitSequencerRandom() {
    try {
        const timestamp = currentTime + PRECOMMIT_DELAY; // Future timestamp

        const sequencerRandom = randomBytes(32);
        const commitment = keccak256(sequencerRandom);

        console.log('Generated sequencer random:', sequencerRandom, 'with commitment:', commitment, 'for timestamp:', timestamp);

        const txHash = await sendSequencerTransactionWithRetry(timestamp, commitment);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const res = await publicClient.readContract({
            address: sequencerRandomOracleAddress,
            abi: sequencerRandomOracleAbi,
            functionName: "unsafeGetSequencerValue",
            args: [BigInt(timestamp)]
        });

        console.log('Read Sequencer random value:', res, 'at timestamp:', timestamp);
    } catch (error) {
        console.error('Error generating or committing sequencer random value:', error);
    }
}

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);

    // Schedule the task to run every 3 seconds for Drand randomness
    setInterval(fetchAndPushRandomness, 3000);

    // Schedule the task to run every 2 seconds for Sequencer random values
    setInterval(generateAndCommitSequencerRandom, 2000);
});
