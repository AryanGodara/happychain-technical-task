// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IDrandOracle {
    function unsafeGetDrandValue(uint256 timestamp) external view returns (bytes32);
    function willDrandValueBeAvailable(uint256 timestamp) external view returns (bool);
}

interface ISequencerRandomOracle {
    function unsafeGetSequencerValue(uint256 timestamp) external view returns (bytes32);
    function willSequencerValueBeAvailable(uint256 timestamp) external view returns (bool);
}

contract RandomnessOracle {
    IDrandOracle public drandOracle;
    ISequencerRandomOracle public sequencerRandomOracle;
    
    uint256 public constant DELAY = 9; // Configurable delay for testing

    event RandomnessComputed(uint256 indexed timestamp, bytes32 randomness);

    constructor(address _drandOracle, address _sequencerRandomOracle) {
        drandOracle = IDrandOracle(_drandOracle);
        sequencerRandomOracle = ISequencerRandomOracle(_sequencerRandomOracle);
    }

    // Method to compute randomness for a given timestamp
    function computeRandomness(uint256 timestamp) public view returns (bytes32) {
        bytes32 drandValue = drandOracle.unsafeGetDrandValue(timestamp - DELAY);
        if (drandValue == 0) {
            drandValue = drandOracle.unsafeGetDrandValue(timestamp - DELAY - 1);
        }
        if (drandValue == 0) {
            drandValue = drandOracle.unsafeGetDrandValue(timestamp - DELAY - 2);
        }

        bytes32 sequencerValue = sequencerRandomOracle.unsafeGetSequencerValue(timestamp);

        if (drandValue == 0 || sequencerValue == 0) {
            return 0;
        }

        return keccak256(abi.encodePacked(drandValue, sequencerValue));
    }

    // Unsafe method to get randomness value (returns 0 if not available)
    function unsafeGetRandomness(uint256 timestamp) external view returns (bytes32) {
        return computeRandomness(timestamp);
    }

    // Method to get randomness value (reverts if not available)
    function getRandomness(uint256 timestamp) external view returns (bytes32) {
        bytes32 randomness = computeRandomness(timestamp);

        require(randomness != 0, "Randomness is not yet available");
        return randomness;
    }

    // Method to check if a randomness value will ever be available
    function willRandomnessBeAvailable(uint256 timestamp) external view returns (bool) {
        bool drandAvailable = drandOracle.willDrandValueBeAvailable(timestamp - DELAY);
        bool sequencerAvailable = sequencerRandomOracle.willSequencerValueBeAvailable(timestamp);

        return drandAvailable && sequencerAvailable;
    }
}
