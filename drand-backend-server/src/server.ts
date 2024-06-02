// src/server.ts
import express, { Express, Request, Response } from "express";
const bodyParser = require('body-parser');
const cors = require('cors');

import { readContract, waitForTransactionReceipt as waitForTxReceipt } from 'viem/actions';
import { createPublicClient, createWalletClient, http, getContract } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains';

import dotenv from "dotenv";

import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import crypto from 'crypto';

const app: Express = express();

dotenv.config();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
// Enable CORS for all routes and origins
app.use(cors());

//// **********************************************
//** Viem.sh Setup
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

//   const contract = getContract({ address, abi, client: publicClient })
// The below will send a single request to the RPC Provider.
// const [name, totalSupply, symbol, balance] = await Promise.all([
//     contract.read.name(),
//     contract.read.totalSupply(),
//     contract.read.symbol(),
//     contract.read.balanceOf([address]),
//   ])

/* 
generates transactions that:
▪ add Drand random values to the DrandOracle , as soon as available
(details to follow)
▪ add sequencerRandom(T) commitments to the
SequencerRandomOracle (details to follow, these commitments have
to be sent enough in advance to be valid)
▪ reveal the value of sequencerRandom(T) values (on the block with
timestamp T at the earliest, and ideally exactly on that block)
💡 Think about when these values need to be sent, and how they can
be bundled.

! Bundle the transactions to be sent to DrandOracle and SequencerRandomOracle : every 2 seconds, one bundle.
*/

//// **********************************************

const PRECOMMIT_DELAY = 10; // Example value
const DRAND_API_URL = 'https://api.drand.sh'; // Example API URL

// Function to fetch the latest Drand randomness value
async function fetchDrandValue(): Promise<string> {
  const response = await fetch(`${DRAND_API_URL}/public/latest`);
  const data = await response.json();
  return "abcd";
//   return data.randomness;
}

// Function to generate a random value for the sequencer
function generateSequencerRandom() {
  return crypto.randomBytes(32).toString('hex');
}

// Function to hash the random value using Keccak
function keccak(value: string) {
  return crypto.createHash('sha3-256').update(value).digest('hex');
}

// Function to simulate pushing a transaction to the blockchain
async function pushTransaction(transactionData: any) {
  // Simulate a transaction being pushed
  console.log("Pushing transaction:", transactionData);
  // Placeholder for retry logic if the transaction fails
  // This should be replaced with actual transaction submission and retry logic
}

// Function to handle the periodic tasks
async function handleTasks() {
  let lastDrandValue = '';
  setInterval(async () => {
    // Fetch Drand value every 3 seconds
    const drandValue = await fetchDrandValue();
    if (drandValue !== lastDrandValue) {
      lastDrandValue = drandValue;
      const drandTransaction = {
        type: 'drand',
        value: drandValue,
        timestamp: Date.now(),
      };
      await pushTransaction(drandTransaction);
    }
  }, 3000);

  setInterval(async () => {
    // Generate sequencer random value every 2 seconds
    const sequencerValue = generateSequencerRandom();
    const commitment = keccak(sequencerValue);
    const sequencerTransaction = {
      type: 'sequencerCommit',
      commitment,
      timestamp: Date.now() + PRECOMMIT_DELAY * 1000,
    };
    await pushTransaction(sequencerTransaction);

    // Simulate revealing the sequencer random value at the correct time
    setTimeout(async () => {
      const revealTransaction = {
        type: 'sequencerReveal',
        value: sequencerValue,
        timestamp: sequencerTransaction.timestamp,
      };
      await pushTransaction(revealTransaction);
    }, PRECOMMIT_DELAY * 1000);
  }, 2000);
}

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  handleTasks(); // Start the periodic tasks
});
