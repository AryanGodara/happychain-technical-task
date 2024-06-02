import { fetchBeacon, FastestNodeClient } from 'drand-client';

import express, { Express, Request, Response } from "express";
import dotenv from 'dotenv';

import chalk from 'chalk';
const red = chalk.red;
const yellow = chalk.yellow;
const green = chalk.green;

// import { readContract, waitForTransactionReceipt as waitForTxReceipt } from 'viem/actions';
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

import { keccak256 } from '@ethersproject/keccak256';
// import { randomBytes } from '@ethersproject/random';
import { randomBytes } from 'crypto';

//** Contracts Configuration */
import {drandOracleAbi, drandOracleAddress} from "./contracts/DrandOracle";
import {sequencerRandomOracleAbi, sequencerRandomOracleAddress} from "./contracts/SequencerRandomOracle";
import {randomnessOracleAbi, randomnessOracleAddress} from "./contracts/RandomnessOracle";
//************************ */


//** Express Configuration */
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
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
//************************ */


// Genesis block time (UNIX timestamp in seconds)
const GENESIS_TIME = 1717251800; // And "even" number for the genesis time for the anvil chain; 20s after anvil chain genesis
// let currentTime = GENESIS_TIME + 20;
let currentTimeDrand = GENESIS_TIME;
let currentTimeSequencerCommit = GENESIS_TIME;
const PRECOMMIT_DELAY = 10;
//************************ */


// Map to store sequencerRandom and commitments
const commitments: Map<bigint, { commitment: string, sequencerRandomStr: string }> = new Map();
//************************ */


// Function to calculate the round number from the current timestamp
function getRoundNumber(timestamp: number): number {
    timestamp -= 9; // DELAY = 9s
    return Math.floor((timestamp - GENESIS_TIME) / 3);
}

// Function to retry sending a transaction
async function sendDrandOracleTransactionWithRetry(timestamp: number, randomness: string, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const txHash = await walletclient.writeContract({
                address: drandOracleAddress,
                abi: drandOracleAbi,
                functionName: "addDrandValue",
                args: [BigInt(timestamp), `0x${randomness}`]
            });
            console.log(red('\nDrand-API ::: Timestamp:'), timestamp, red(' DrandOracle ::: Transaction sent (attempt '), attempt, ")\n");
            return txHash;
        } catch (error: any) {
            if (error.message.includes('Drand value cannot be backfilled after DRAND_TIMEOUT')) {
                console.error(red('\nDrand-API ::: Timestamp:'), timestamp, red(' DrandOracle ::: Error :: Transaction failed : DRAND_TIMEOUT , not retrying.\n'));
                break;
            } else {
                console.log(red('\nDrand-API::: Timestamp:'), timestamp, red(' DrandOracle ::: Transaction failed (attempt '), attempt, "), retrying...\n");
                if (attempt === retries) return null
                    // throw error;
            }
        }
    }
}

async function fetchAndPushRandomness() {
    try {
        currentTimeDrand+= 3;
        const timestamp = currentTimeDrand;
        const roundNumber = getRoundNumber(timestamp);

        fastestNodeClient.start();
        const theLatestBeaconFromTheFastestClient = await fetchBeacon(fastestNodeClient, roundNumber);
        fastestNodeClient.stop();

        const randomness = theLatestBeaconFromTheFastestClient.randomness;
        console.log(red('\nDrand-API::: Timestamp:'), timestamp, red('Randomness: ', randomness, "\n"));

        const txHash = await sendDrandOracleTransactionWithRetry(timestamp, randomness);
        if (txHash) {
            console.log(red.bold.underline('\nTimestamp: '), timestamp, red.bold.underline("drand SUCCESS\n"));
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking if it got merged
        
        const res = await publicClient.readContract({
            address: drandOracleAddress,
            abi: drandOracleAbi,
            functionName: "unsafeGetDrandValue",
            args: [BigInt(timestamp)]
        });

        console.log(red('\nTimestamp'), timestamp, red.bold(' Drand-Oracle-unsafeGet:::'), res, "\n");
    } catch (error) {
        console.error(red.bgRedBright("\nFetch-Drand-error: "), error, "\n");
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
            console.log(yellow('\nSequencer-Commitment ::: Timestamp:'), timestamp, yellow(' SequencerRandom ::: Transaction sent (attempt '), attempt, ")\n");
            return txHash;
        } catch (error: any) {
            if (error.message.includes('Commitment must be posted in advance')) {
                console.error(red('\nSequencer-Commitment ::: Timestamp:'), timestamp, red(' SequencerRandom ::: Error :: Transaction failed PRECOMMIT_DELAY, not retrying.\n'));
                break;
            } else {
                console.log(red('\nSequencer-Commitment::: Timestamp:'), timestamp, red(' SequencerRandom ::: Transaction failed (attempt '), attempt, "), retrying...\n");
                if (attempt === retries) return null
                    // throw error;
            }
        }
    }
}

// Function to generate and commit sequencer random values
async function generateAndCommitSequencerRandom() {
    try {
        currentTimeSequencerCommit += 2;
        const timestamp = currentTimeSequencerCommit + PRECOMMIT_DELAY; // Only aim for the future timestamps, else it keeps failing

        // Generate a random hex string of length 32 bytes
        const sequencerRandomBuffer = randomBytes(32);
        const sequencerRandomStr = '0x' + sequencerRandomBuffer.toString('hex');
        
        // Create a Keccak hash of the random value
        const commitment = keccak256(sequencerRandomBuffer);
        console.log(yellow('\nTimestamp:'), timestamp, yellow(' Sequencer-random: '), sequencerRandomStr, yellow(' Hash: '), commitment, "\n");

        commitments.set(BigInt(timestamp), { commitment, sequencerRandomStr });

        const txHash = await sendSequencerTransactionWithRetry(timestamp, commitment.substring(2));
        if (txHash) {
            console.log(yellow.bold.underline('\nTimestamp: '), timestamp, yellow.bold.underline("commitment SUCCESS\n"));
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        const res = await publicClient.readContract({
            address: sequencerRandomOracleAddress,
            abi: sequencerRandomOracleAbi,
            functionName: "unsafeGetSequencerValue",
            args: [BigInt(timestamp)]
        });

        console.log(yellow('\nTimestamp'), timestamp, yellow.bold(' Sequencer-Oracle-unsafeGet-Commitment:::'), res, "\n");
    } catch (error) {
        console.error(yellow.bgYellowBright("\nSequencer-Commitment-error: "), error, "\n");
    }
}

// Function to retry revealing a sequencer random value
async function revealSequencerTransactionWithRetry(timestamp: bigint, sequencerRandom: string, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const txHash = await walletclient.writeContract({
                address: sequencerRandomOracleAddress,
                abi: sequencerRandomOracleAbi,
                functionName: "revealValue",
                args: [timestamp, `0x${sequencerRandom.substring(2)}`]
            });
            console.log(green.bold.bgBlack('\nReveal-Value ::: Timestamp:'), timestamp, green.bold.bgBlack(' Transaction sent (attempt '), attempt, ")\n");
            return txHash;
        } catch (error: any) {
            switch (true) {
                case error.message.includes('Revealed value cannot be backfilled after SEQUENCER_TIMEOUT'):
                    console.log(green.bold.bgBlack('\nReveal-Value ::: Timestamp:'), timestamp, green.bold.bgBlack('Reveal-Sequencer:::Error\nTransaction failed SEQUENCER_TIMEOUT condition, not retrying.'))
                    break;
                case error.message.includes('Revealed value does not match commitment'):
                    console.log(green.bold.bgBlack('\nReveal-Value ::: Timestamp:'), timestamp, green.bold.bgBlack('Reveal-Sequencer:::Error\nTransaction failed invalid reveal conditions, not retrying.'))
                    break;
                case error.message.includes('Value already revealed'):
                    console.log(green.bold.bgBlack('\nReveal-Value ::: Timestamp:'), timestamp, green.bold.bgBlack('Reveal-Sequencer:::Error\nTransaction failed ALREADY_REVEALED, not retrying.'))
                    break;
                default:
                    console.log(green.bold.bgBlack('\nReveal-Value::: Timestamp:'), timestamp, red(' Transaction failed (attempt '), attempt, "), retrying...\n");
                    break;
            }
                if (attempt === retries) return null;
                    //  throw error;
        }
    }
}

// Function to reveal sequencer random values
async function revealSequencerRandom() {
    let temp;
    try {
        const block = await publicClient.getBlock({ blockTag: 'latest' });
        const currentBlockTimestamp = block.timestamp + BigInt(2);
        temp = currentBlockTimestamp;

        if (commitments.has(currentBlockTimestamp)) {
            const { sequencerRandomStr } = commitments.get(currentBlockTimestamp)!;
            console.log(green.bold.bgBlack('\nTimestamp:'), currentBlockTimestamp, green.bold.bgBlack(" Revealing value: "), sequencerRandomStr, "\n");

            const txHash = await revealSequencerTransactionWithRetry(currentBlockTimestamp, sequencerRandomStr);
            if (txHash) {
                console.log(green.bold.bgBlack('\nTimestamp: '), currentBlockTimestamp, green.bold.bgBlack("reveal SUCCESS\n"));
            }
        }
    } catch (error) {
        console.error(green.bold.bgBlack('\nTimestamp:' ), temp, green.bold.bgBlack('Reveal-Sequencer ::: Error revealing sequencer random value:'), error, "\n");
    }
}




//** MAIN FUNCTION */
async function main() {
    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const currentBlockTimestamp = block.timestamp;

    console.log(chalk.blueBright.bold.underline('Starting server when Block Timestamp ='), Number(currentBlockTimestamp));

    // Check if timestamp is odd, if it is append it by 5, else by 4 (So we're always on even blocks): And gives us the buffer time to set everything up
    if (currentBlockTimestamp % 2n === 0n) {
        currentTimeDrand = Number(currentBlockTimestamp) + 4;
        currentTimeSequencerCommit = Number(currentBlockTimestamp) + 4;
    } else {
        currentTimeDrand = Number(currentBlockTimestamp) + 5;
        currentTimeSequencerCommit = Number(currentBlockTimestamp) + 5;
    }

    // Reveal Commitment doesn't need time as input, it just checks current block timestamp, and tries to reveal the value of the next block

    app.listen(port, () => {
        console.log(`[server]: Server is running at http://localhost:${port}`);
    
        // Schedule the task to run every 3 seconds for Drand randomness
        setInterval(fetchAndPushRandomness, 3000);
    
        // Schedule the task to run every 2 seconds for Sequencer random values
        setInterval(generateAndCommitSequencerRandom, 2000);
    
        // Schedule the task to run every 1 second to reveal Sequencer random values
        setInterval(revealSequencerRandom, 1000);
    });    
}

main().catch((error) => {
    console.error(red.bold.bgRedBright('Server Broke Down'), error);
  });
  