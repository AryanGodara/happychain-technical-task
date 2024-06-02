# Makefile located in the root directory

# Variables
ANVIL_FLAGS = -b 2 --timestamp 1717251800
FORGE_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
FORK_URL = http://localhost:8545
ANVIL_LOG = anvil.log

# Targets
.PHONY: anvil start_anvil build_deploy_contracts build_run_server run clean

anvil:
	@echo "Starting Anvil chain..."
	@anvil $(ANVIL_FLAGS) > $(ANVIL_LOG) 2>&1 & disown
	@sleep 5 # Give anvil some time to start

build_deploy_contracts:
	@echo "Building and deploying contracts..."
	cd hello_foundry && forge build && forge script script/DrandOracle.s.sol:DrandOracleScript --fork-url $(FORK_URL) --private-key $(FORGE_PRIVATE_KEY) --broadcast

build_run_server:
	@echo "Building and running the backend server..."
	cd drand-backend-server && npm run build && node dist/index.js

run: anvil build_deploy_contracts build_run_server
	@echo "All tasks completed successfully."

clean:
	@echo "Cleaning up..."
	@pkill -F anvil.pid || true
