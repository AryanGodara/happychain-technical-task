// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract SequencerRandomOracle {
    uint256 public constant SEQUENCER_TIMEOUT = 10; // Timeout constant for backfilling
    uint256 public constant PRECOMMIT_DELAY = 10; // Precommit delay for testing

    struct Commitment {
        bytes32 commitmentHash;
        bool revealed;
        bytes32 revealedValue;
    }

    mapping(uint256 => Commitment) private commitments; // Mapping of commitments by timestamp

    event CommitmentPosted(uint256 indexed timestamp, bytes32 commitmentHash);
    event ValueRevealed(uint256 indexed timestamp, bytes32 revealedValue);

    // Method to post a commitment for a future timestamp
    function postCommitment(uint256 timestamp, bytes32 commitmentHash) external {
        require(block.timestamp <= timestamp - PRECOMMIT_DELAY, "Commitment must be posted in advance");
        commitments[timestamp] = Commitment(commitmentHash, false, 0);
        emit CommitmentPosted(timestamp, commitmentHash);
    }

    // Method to reveal the random value for the timestamp
    function revealValue(uint256 timestamp, bytes32 revealedValue) external {
        Commitment storage commitment = commitments[timestamp];
        
        require(block.timestamp <= timestamp + SEQUENCER_TIMEOUT, "Revealed value cannot be backfilled after SEQUENCER_TIMEOUT");
        require(commitment.commitmentHash == keccak256(abi.encodePacked(revealedValue)), "Revealed value does not match commitment");
        require(!commitment.revealed, "Value already revealed");

        commitment.revealed = true;
        commitment.revealedValue = revealedValue;
        emit ValueRevealed(timestamp, revealedValue);
    }

    // Unsafe method to get sequencer value (returns 0 if not available)
    function unsafeGetSequencerValue(uint256 timestamp) external view returns (bytes32) {
        Commitment storage commitment = commitments[timestamp];
        
        if (!commitment.revealed) {
            return 0;
        }
        
        return commitment.revealedValue;
    }

    // Method to get sequencer value (reverts if not available)
    function getSequencerValue(uint256 timestamp) external view returns (bytes32) {
        Commitment storage commitment = commitments[timestamp];
        
        require(commitment.revealed, "Sequencer value is not yet revealed or was not committed");
        
        return commitment.revealedValue;
    }

    // Method to check if a sequencer value will ever be available
    function willSequencerValueBeAvailable(uint256 timestamp) external view returns (bool) {
        Commitment storage commitment = commitments[timestamp];

        // Check if the commitment was posted in time
        if (commitment.commitmentHash == 0 && block.timestamp > timestamp - PRECOMMIT_DELAY) {
            return false; // Commitment was never posted and now it's too late
        }

        // If commitment was posted, check if the value has been revealed
        if (commitment.commitmentHash != 0) {
            if (commitment.revealed) {
                return true; // Commitment was posted and value has been revealed
            } else if (block.timestamp <= timestamp + SEQUENCER_TIMEOUT) {
                return true; // Commitment was posted and there's still time to reveal
            } else {
                return false; // Commitment was posted but reveal timeout has expired
            }
        }

        return true; // There's still time to post the commitment
    }
}
