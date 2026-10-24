// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PennyOracle} from "../PennyOracle.sol";
import {MockUSDC} from "./mocks/PennyOracleMocks.sol";

abstract contract PennyOracleBase is Test {
    uint256 internal constant PRICE = 10_000;
    uint256 internal constant TIMEOUT = 1 days;

    MockUSDC internal usdc;
    PennyOracle internal po;

    address internal owner = makeAddr("owner");
    address internal oracleAddr = makeAddr("oracle");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    function setUp() public virtual {
        usdc = new MockUSDC();
        vm.prank(owner);
        po = new PennyOracle(address(usdc), oracleAddr, TIMEOUT);
        _fund(alice, 1_000e6);
        _fund(bob, 1_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(po), type(uint256).max);
    }

    function _ask(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = po.ask("what is 1+1?");
    }

    function _fulfill(uint256 id) internal {
        vm.prank(oracleAddr);
        po.fulfill(id, keccak256("answer"));
    }

    function _refund(uint256 id, address who) internal {
        vm.prank(who);
        po.refund(id);
    }

    function _str(uint256 len) internal pure returns (string memory) {
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = "a";
        }
        return string(b);
    }
}
