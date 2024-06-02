import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {
  fetchBeacon,
  fetchBeaconByTime,
  watch,
  HttpChainClient,
  HttpCachingChain,
  FastestNodeClient,
  MultiBeaconNode,
} from 'drand-client';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

let abortController = globalThis.AbortController;

const chainHash = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce'; // Example chain hash
const publicKey = '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31'; // Example public key

const options = {
  disableBeaconVerification: false, // `true` disables checking of signatures on beacons - faster but insecure!!!
  noCache: false, // `true` disables caching when retrieving beacons for some providers
  chainVerificationParams: { chainHash, publicKey }, // these are optional, but recommended! They are compared for parity against the `/info` output of a given node
};

// Initialize clients
const chain = new HttpCachingChain('https://api.drand.sh', options);
const client = new HttpChainClient(chain, options);

const urls = [
  'https://api.drand.sh',
  'https://drand.cloudflare.com',
];
const fastestNodeClient = new FastestNodeClient(urls, options);

const multiBeaconNode = new MultiBeaconNode('https://api.drand.sh', options);

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.get('/latest-beacon', async (req: Request, res: Response) => {
  try {
    const theLatestBeacon = await fetchBeacon(client);
    res.json({ beacon: theLatestBeacon });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching the latest beacon' });
  }
});

app.get('/beacon-by-time', async (req: Request, res: Response) => {
  try {
    const theBeaconRightNow = await fetchBeaconByTime(client, Date.now());
    res.json({ beacon: theBeaconRightNow });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching the beacon by time' });
  }
});

app.get('/fastest-beacon', async (req: Request, res: Response) => {
  try {
    fastestNodeClient.start();
    const theLatestBeaconFromTheFastestClient = await fetchBeacon(fastestNodeClient);
    fastestNodeClient.stop();
    res.json({ beacon: theLatestBeaconFromTheFastestClient });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching the fastest beacon' });
  }
});

app.get('/watch-beacons', async (req: Request, res: Response) => {
  try {
    const controller = new abortController();
    const beacons: any[] = [];
    (async () => {
      for await (const beacon of watch(client, controller)) {
        beacons.push(beacon);
        if (beacon.round === 10) {
          controller.abort('round 10 reached - listening stopped');
        }
      }
    })();
    res.json({ beacons });
  } catch (error) {
    res.status(500).json({ error: 'Error watching beacons' });
  }
});

app.get('/multi-beacon-info', async (req: Request, res: Response) => {
  try {
    const health = await multiBeaconNode.health();
    const chains = await multiBeaconNode.chains();
    const chainInfoPromises = chains.map(async (chain) => {
      const info = await chain.info();
      return {
        baseUrl: chain.baseUrl,
        genesisTime: info.genesis_time,
      };
    });
    const chainInfos = await Promise.all(chainInfoPromises);
    res.json({ health, chains: chainInfos });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching multi-beacon info' });
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
