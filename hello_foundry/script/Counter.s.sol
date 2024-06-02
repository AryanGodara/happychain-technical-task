// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract CounterScript is Script {
    Counter public counter;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        counter = new Counter(10);
        
        uint256 ans = counter.getNumber();
        console2.logUint(ans);
        
        counter.increment();
        counter.increment();
        ans = counter.getNumber();
        console2.logUint(ans);
        
        counter.setNumber(1);
        counter.increment();

        ans = counter.getNumber();
        console2.logUint(ans);
        
        vm.stopBroadcast();
    }
}
