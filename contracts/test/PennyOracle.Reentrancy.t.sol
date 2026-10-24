// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PennyOracle} from "../PennyOracle.sol";
import {HookUSDC, ReentrantActor} from "./mocks/PennyOracleMocks.sol";

contract PennyOracleReentrancyTest is Test {
    uint256 internal constant PRICE = 10_000;
    uint256 internal constant TIMEOUT = 1 days;
    bytes4 internal constant GUARD = 0x3ee5aeb5;

    HookUSDC internal token;
    PennyOracle internal po;
    ReentrantActor internal actor;

    address internal owner = makeAddr("owner");
    address internal oracleAddr = makeAddr("oracle");
    address internal alice = makeAddr("alice");

    function setUp() public {
        token = new HookUSDC();
        vm.prank(owner);
        po = new PennyOracle(address(token), oracleAddr, TIMEOUT);
        actor = new ReentrantActor(po, token);
        token.mint(address(actor), 1_000e6);
        token.mint(alice, 1_000e6);
        vm.prank(alice);
        token.approve(address(po), type(uint256).max);
    }

    function _aliceAskFulfilled() internal returns (uint256 id) {
        vm.prank(alice);
        id = po.ask("alice question");
        vm.prank(oracleAddr);
        po.fulfill(id, keccak256("a"));
    }

    function _makeActorOwner() internal {
        vm.prank(owner);
        po.setOwner(address(actor));
    }

    function _assertBlocked() internal view {
        assertTrue(actor.fired());
        assertFalse(actor.reentryOk());
        assertEq(actor.reentrySelector(), GUARD);
    }

    function test_AskReenteringAskIsBlocked() public {
        actor.arm(abi.encodeCall(po.ask, ("again")));
        actor.approveAndAsk("first");
        _assertBlocked();
        assertEq(po.nextId(), 1);
        assertEq(po.escrowed(), PRICE);
        assertEq(token.balanceOf(address(po)), PRICE);
    }

    function test_AskReenteringRefundIsBlocked() public {
        actor.arm(abi.encodeCall(po.refund, (0)));
        actor.approveAndAsk("first");
        _assertBlocked();
        assertEq(po.escrowed(), PRICE);
        assertFalse(po.getQuestion(0).refunded);
    }

    function test_RefundReenteringRefundIsBlocked() public {
        actor.approveAndAsk("first");
        skip(TIMEOUT);
        uint256 before = token.balanceOf(address(actor));
        actor.arm(abi.encodeCall(po.refund, (0)));
        actor.doRefund(0);
        _assertBlocked();
        assertEq(token.balanceOf(address(actor)), before + PRICE);
        assertEq(po.escrowed(), 0);
        assertEq(token.balanceOf(address(po)), 0);
    }

    function test_RefundReenteringAskIsBlocked() public {
        actor.approveAndAsk("first");
        skip(TIMEOUT);
        actor.arm(abi.encodeCall(po.ask, ("again")));
        actor.doRefund(0);
        _assertBlocked();
        assertEq(po.nextId(), 1);
    }

    function test_RefundReenteringWithdrawIsBlocked() public {
        actor.approveAndAsk("first");
        _aliceAskFulfilled();
        _makeActorOwner();
        skip(TIMEOUT);
        actor.arm(abi.encodeCall(po.withdraw, (address(actor), PRICE)));
        actor.doRefund(0);
        _assertBlocked();
        assertEq(po.earned(), PRICE);
        assertEq(token.balanceOf(address(po)), PRICE);
    }

    function test_WithdrawReenteringWithdrawIsBlocked() public {
        _aliceAskFulfilled();
        _aliceAskFulfilled();
        _makeActorOwner();
        uint256 before = token.balanceOf(address(actor));
        actor.arm(abi.encodeCall(po.withdraw, (address(actor), PRICE)));
        actor.doWithdraw(address(actor), PRICE);
        _assertBlocked();
        assertEq(token.balanceOf(address(actor)), before + PRICE);
        assertEq(po.earned(), PRICE);
        assertEq(token.balanceOf(address(po)), PRICE);
    }

    function test_WithdrawReenteringRefundIsBlocked() public {
        actor.approveAndAsk("first");
        _aliceAskFulfilled();
        _makeActorOwner();
        skip(TIMEOUT);
        actor.arm(abi.encodeCall(po.refund, (0)));
        actor.doWithdraw(address(actor), PRICE);
        _assertBlocked();
        assertEq(po.escrowed(), PRICE);
        assertFalse(po.getQuestion(0).refunded);
    }

    function test_WithdrawReenteringAskIsBlocked() public {
        _aliceAskFulfilled();
        _makeActorOwner();
        actor.arm(abi.encodeCall(po.ask, ("again")));
        actor.doWithdraw(address(actor), PRICE);
        _assertBlocked();
        assertEq(po.nextId(), 1);
    }

    function test_MaliciousTokenReenteringAskIsBlocked() public {
        token.armReentry(address(po), abi.encodeCall(po.ask, ("evil")));
        vm.prank(alice);
        po.ask("honest");
        assertTrue(token.reenterFired());
        assertFalse(token.reenterOk());
        assertEq(token.reenterSelector(), GUARD);
        assertEq(po.nextId(), 1);
        assertEq(po.escrowed(), PRICE);
    }

    function test_MaliciousTokenReenteringRefundIsBlocked() public {
        vm.prank(alice);
        po.ask("honest");
        skip(TIMEOUT);
        token.armReentry(address(po), abi.encodeCall(po.refund, (0)));
        vm.prank(alice);
        po.refund(0);
        assertTrue(token.reenterFired());
        assertFalse(token.reenterOk());
        assertEq(token.reenterSelector(), GUARD);
        assertEq(po.escrowed(), 0);
        assertEq(token.balanceOf(address(po)), 0);
    }
}
