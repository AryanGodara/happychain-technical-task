forge build

forge test

forge script script/DrandOracle.s.sol:DrandOracleScript --fork-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

cast call --rpc-url http://localhost:8545 0x5FbDB2315678afecb367f032d93F642f64180aa3 "getNumber()(uint256)"

cast send --rpc-url http://localhost:8545 0x5fbdb2315678afecb367f032d93f642f64180aa3 "increment()" --private-key $PRIVATE_KEY