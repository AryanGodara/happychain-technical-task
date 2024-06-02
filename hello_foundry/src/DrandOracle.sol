// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract DrandOracle {
    uint256 public constant DRAND_TIMEOUT = 10; // Timeout constant for backfilling
    uint256 public constant DELAY = 9; // Configurable delay for testing

    mapping(uint256 => bytes32) private drandValues;
    mapping(uint256 => uint256) private drandTimestamps;

    event DrandValueAdded(uint256 indexed timestamp, bytes32 drandValue);

    // Method to add Drand value for a given timestamp
    function addDrandValue(uint256 timestamp, bytes32 drandValue) external {
        require(block.timestamp <= timestamp + DRAND_TIMEOUT, "Drand value cannot be backfilled after DRAND_TIMEOUT");
        
        // uint256 effectiveTimestamp = timestamp - DELAY;

        drandValues[timestamp] = drandValue;
        drandTimestamps[timestamp] = block.timestamp;
        
        emit DrandValueAdded(timestamp, drandValue);
    }
    
    // Unsafe method to get Drand value (returns 0 if not available)
    function unsafeGetDrandValue(uint256 timestamp) external view returns (bytes32) {
        return drandValues[timestamp];
    }

    // Method to get Drand value (reverts if not available)
    function getDrandValue(uint256 timestamp) external view returns (bytes32) {
        bytes32 drandValue = drandValues[timestamp];
        require(drandValue != 0, "Drand value is not yet available");

        return drandValue;
    }

    // Method to check if a Drand value will ever be available
    function willDrandValueBeAvailable(uint256 timestamp) external view returns (bool) {
        // if (block.timestamp > timestamp + DRAND_TIMEOUT) {
        //     return false;
        // }
        return ( drandValues[timestamp] != 0 ) || ( block.timestamp <= timestamp + DRAND_TIMEOUT );
    }
}