// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {DrandOracle} from "../src/DrandOracle.sol";
import {RandomnessOracle} from "../src/RandomnessOracle.sol";
import {SequencerRandomOracle} from "../src/SequencerRandomOracle.sol";

contract DrandOracleScript is Script {
    DrandOracle public drandOracle;
    SequencerRandomOracle public sequencerRandomOracle;
    RandomnessOracle public randomnessOracle;

    function setUp() public {
        // TODO
        address accountAddr = vm.parseAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        vm.startBroadcast(accountAddr);

        // vm.startPrank(accountAddr);

        drandOracle = new DrandOracle();
        address addDrand = address(drandOracle);
        // console2.log(msg.sender);

        // drandOracle.addDrandValue(block.timestamp - 10, 0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712);
        // bytes32 val = drandOracle.getDrandValue(block.timestamp - 10);
        // console2.log("drand value = ");
        // console2.log(string(abi.encodePacked(val)));

        sequencerRandomOracle = new SequencerRandomOracle();
        address addSeq = address(sequencerRandomOracle);
        // console2.log(msg.sender);

        randomnessOracle = new RandomnessOracle(addDrand, addSeq);
        address addRan = address(randomnessOracle);
        // console2.log(msg.sender);

        console2.log(addDrand);
        console2.log(addSeq);
        console2.log(addRan);

        // vm.stopPrank();
        vm.stopBroadcast();
    }

    function run() public {
        // TODO
    }
}