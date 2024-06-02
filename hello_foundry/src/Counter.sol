// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    constructor (uint256 _number) {
        number = _number;
    }

    function getNumber() external view returns (uint256) {
        return number;
    }

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}
