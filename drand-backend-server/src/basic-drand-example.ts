// src/drand-fetch.ts

import {
  fetchBeacon,
  fetchBeaconByTime,
  watch,
  HttpChainClient,
  HttpCachingChain,
  FastestNodeClient,
  MultiBeaconNode,
} from 'drand-client';

let abortController = globalThis.AbortController;

const chainHash = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce'; // Example chain hash
const publicKey = '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31'; // Example public key

async function main() {
  const options = {
    disableBeaconVerification: false, // `true` disables checking of signatures on beacons - faster but insecure!!!
    noCache: false, // `true` disables caching when retrieving beacons for some providers
    chainVerificationParams: { chainHash, publicKey }, // these are optional, but recommended! They are compared for parity against the `/info` output of a given node
  };

  // Connecting to a single chain to grab the latest beacon
  const chain = new HttpCachingChain('https://api.drand.sh', options);
  const client = new HttpChainClient(chain, options);
  const theLatestBeacon = await fetchBeacon(client);
  console.log('Latest Beacon:', theLatestBeacon);

  // Alternatively, get the beacon for a given time
  const theBeaconRightNow = await fetchBeaconByTime(client, Date.now());
  console.log('Beacon Right Now:', theBeaconRightNow);

  // Fetch randomness from multiple APIs and automatically use the fastest
  const urls = [
    'https://api.drand.sh',
    'https://drand.cloudflare.com',
  ];
  const fastestNodeClient = new FastestNodeClient(urls, options);
  fastestNodeClient.start();

  const theLatestBeaconFromTheFastestClient = await fetchBeacon(fastestNodeClient);
  console.log('Latest Beacon from Fastest Client:', theLatestBeaconFromTheFastestClient);

  fastestNodeClient.stop();

  // Use the `watch` async generator to watch the latest randomness automatically
  const controller = new abortController();
  (async () => {
    for await (const beacon of watch(client, controller)) {
      console.log('Watched Beacon:', beacon);
      if (beacon.round === 10) {
        controller.abort('round 10 reached - listening stopped');
      }
    }
  })();

  // Interact with multibeacon nodes
  const multiBeaconNode = new MultiBeaconNode('https://api.drand.sh', options);

  // Monitor health of the multibeacon node
  const health = await multiBeaconNode.health();
  if (health.status === 200) {
    console.log(`Multibeacon node is healthy and has processed ${health.current} of ${health.expected} rounds`);
  }

  // Get the chains it follows
  const chains = await multiBeaconNode.chains();
  for (const c of chains) {
    const info = await c.info();
    console.log(`Chain with baseUrl ${c.baseUrl} has a genesis time of ${info.genesis_time}`);
  }

  // Create clients straight from the chains it returns and fetch the latest beacons from all chains
  const latestBeaconsFromAllChains = await Promise.all(
    chains.map((chain) => new HttpChainClient(chain, options)).map((client) => fetchBeacon(client))
  );
  console.log('Latest Beacons from All Chains:', latestBeaconsFromAllChains);
}

main().catch((error) => {
  console.error('Error fetching randomness:', error);
});
