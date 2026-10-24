// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PennyOracle} from "../PennyOracle.sol";
import {PennyOracleBase} from "./PennyOracle.Base.t.sol";

contract PennyOracleSettleTest is PennyOracleBase {
    bytes32 internal constant ANSWER = keccak256("answer");

    function test_FulfillMovesEscrowedToEarned() public {
        uint256 id = _ask(alice);
        uint256 balBefore = usdc.balanceOf(address(po));
        _fulfill(id);
        assertEq(po.escrowed(), 0);
        assertEq(po.earned(), PRICE);
        assertEq(usdc.balanceOf(address(po)), balBefore);
    }

    function test_FulfillStoresAnswerAndSettlement() public {
        vm.warp(1_000_000);
        uint256 id = _ask(alice);
        skip(120);
        _fulfill(id);
        PennyOracle.Question memory q = po.getQuestion(id);
        assertEq(q.answerHash, ANSWER);
        assertTrue(q.fulfilled);
        assertFalse(q.refunded);
        assertEq(q.settledAt, 1_000_120);
        assertEq(q.askedAt, 1_000_000);
        assertEq(q.asker, alice);
    }

    function test_FulfillEmitsFulfilled() public {
        uint256 id = _ask(alice);
        skip(10);
        vm.expectEmit(true, false, false, true, address(po));
        emit PennyOracle.Fulfilled(id, ANSWER, uint64(block.timestamp));
        _fulfill(id);
    }

    function test_FulfillRevertsForNonOracle() public {
        uint256 id = _ask(alice);
        vm.prank(stranger);
        vm.expectRevert(PennyOracle.NotOracle.selector);
        po.fulfill(id, ANSWER);
    }

    function test_FulfillRevertsForOwner() public {
        uint256 id = _ask(alice);
        vm.prank(owner);
        vm.expectRevert(PennyOracle.NotOracle.selector);
        po.fulfill(id, ANSWER);
    }

    function test_FulfillRevertsForAsker() public {
        uint256 id = _ask(alice);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.NotOracle.selector);
        po.fulfill(id, ANSWER);
    }

    function test_FulfillRevertsForNonexistentId() public {
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.fulfill(0, ANSWER);
        uint256 id = _ask(alice);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.fulfill(id + 1, ANSWER);
    }

    function test_FulfillRevertsWhenAlreadyFulfilled() public {
        uint256 id = _ask(alice);
        _fulfill(id);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.AlreadyFulfilled.selector);
        po.fulfill(id, keccak256("other"));
        assertEq(po.earned(), PRICE);
        assertEq(po.getQuestion(id).answerHash, ANSWER);
    }

    function test_FulfillRevertsAfterRefund() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT);
        _refund(id, alice);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.AlreadyRefunded.selector);
        po.fulfill(id, ANSWER);
        assertEq(po.earned(), 0);
    }

    function test_LateFulfillAfterTimeoutAllowedWhenNotRefunded() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT + 1 days);
        _fulfill(id);
        assertTrue(po.getQuestion(id).fulfilled);
        assertEq(po.earned(), PRICE);
        assertEq(po.escrowed(), 0);
    }

    function test_FulfillOnlyAffectsTargetQuestion() public {
        uint256 a = _ask(alice);
        uint256 b = _ask(bob);
        _fulfill(a);
        assertFalse(po.getQuestion(b).fulfilled);
        assertEq(po.escrowed(), PRICE);
        assertEq(po.earned(), PRICE);
    }

    function test_RefundRevertsBeforeTimeout() public {
        uint256 id = _ask(alice);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.RefundTooEarly.selector);
        po.refund(id);
    }

    function test_RefundRevertsAtTimeoutMinusOne() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT - 1);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.RefundTooEarly.selector);
        po.refund(id);
    }

    function test_RefundSucceedsExactlyAtTimeout() public {
        uint256 id = _ask(alice);
        uint256 askedAt = block.timestamp;
        vm.warp(askedAt + TIMEOUT);
        uint256 before = usdc.balanceOf(alice);
        _refund(id, alice);
        assertEq(usdc.balanceOf(alice), before + PRICE);
        assertEq(usdc.balanceOf(address(po)), 0);
    }

    function test_RefundUpdatesStateAndEscrow() public {
        uint256 id = _ask(alice);
        _ask(bob);
        skip(TIMEOUT + 5);
        _refund(id, alice);
        PennyOracle.Question memory q = po.getQuestion(id);
        assertTrue(q.refunded);
        assertFalse(q.fulfilled);
        assertEq(q.settledAt, block.timestamp);
        assertEq(po.escrowed(), PRICE);
        assertEq(po.earned(), 0);
    }

    function test_RefundEmitsRefunded() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT);
        vm.expectEmit(true, true, false, true, address(po));
        emit PennyOracle.Refunded(id, alice, PRICE);
        _refund(id, alice);
    }

    function test_RefundRevertsForNonAskerEvenAfterTimeout() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT + 1);
        vm.prank(bob);
        vm.expectRevert(PennyOracle.NotAsker.selector);
        po.refund(id);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.NotAsker.selector);
        po.refund(id);
        vm.prank(owner);
        vm.expectRevert(PennyOracle.NotAsker.selector);
        po.refund(id);
    }

    function test_RefundRevertsForNonAskerBeforeTimeout() public {
        uint256 id = _ask(alice);
        vm.prank(bob);
        vm.expectRevert(PennyOracle.NotAsker.selector);
        po.refund(id);
    }

    function test_RefundRevertsForNonexistentId() public {
        vm.prank(alice);
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.refund(0);
        uint256 id = _ask(alice);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.refund(id + 1);
    }

    function test_RefundRevertsOnDoubleRefund() public {
        uint256 id = _ask(alice);
        skip(TIMEOUT);
        _refund(id, alice);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.NotPending.selector);
        po.refund(id);
        assertEq(po.escrowed(), 0);
    }

    function test_RefundRevertsAfterFulfill() public {
        uint256 id = _ask(alice);
        _fulfill(id);
        skip(TIMEOUT);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.NotPending.selector);
        po.refund(id);
        assertEq(po.earned(), PRICE);
    }

    function test_RefundDoesNotTouchOtherEscrow() public {
        uint256 a = _ask(alice);
        uint256 b = _ask(bob);
        skip(TIMEOUT);
        _refund(a, alice);
        assertEq(usdc.balanceOf(address(po)), PRICE);
        _refund(b, bob);
        assertEq(usdc.balanceOf(address(po)), 0);
        assertEq(po.escrowed(), 0);
    }

    function test_WithdrawPaysRecipientAndReducesEarned() public {
        uint256 id = _ask(alice);
        _fulfill(id);
        vm.prank(owner);
        po.withdraw(stranger, PRICE);
        assertEq(usdc.balanceOf(stranger), PRICE);
        assertEq(po.earned(), 0);
        assertEq(usdc.balanceOf(address(po)), 0);
    }

    function test_WithdrawPartial() public {
        _fulfill(_ask(alice));
        _fulfill(_ask(bob));
        vm.prank(owner);
        po.withdraw(stranger, 7_000);
        assertEq(po.earned(), 2 * PRICE - 7_000);
        assertEq(usdc.balanceOf(stranger), 7_000);
    }

    function test_WithdrawRevertsAboveEarnedEvenWhenEscrowHeld() public {
        _fulfill(_ask(alice));
        _ask(bob);
        assertEq(usdc.balanceOf(address(po)), 2 * PRICE);
        vm.prank(owner);
        vm.expectRevert(PennyOracle.InsufficientEarned.selector);
        po.withdraw(stranger, PRICE + 1);
        assertEq(po.earned(), PRICE);
    }

    function test_WithdrawRevertsWhenNothingEarned() public {
        _ask(alice);
        vm.prank(owner);
        vm.expectRevert(PennyOracle.InsufficientEarned.selector);
        po.withdraw(stranger, 1);
    }

    function test_WithdrawExactEarnedSucceedsAndLeavesEscrow() public {
        _fulfill(_ask(alice));
        uint256 pending = _ask(bob);
        vm.prank(owner);
        po.withdraw(stranger, PRICE);
        assertEq(po.earned(), 0);
        assertEq(po.escrowed(), PRICE);
        assertEq(usdc.balanceOf(address(po)), PRICE);
        skip(TIMEOUT);
        _refund(pending, bob);
        assertEq(usdc.balanceOf(address(po)), 0);
    }

    function test_WithdrawCannotDrainEscrowViaRepeatedCalls() public {
        _fulfill(_ask(alice));
        _ask(bob);
        _ask(bob);
        vm.startPrank(owner);
        po.withdraw(stranger, PRICE);
        vm.expectRevert(PennyOracle.InsufficientEarned.selector);
        po.withdraw(stranger, 1);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(po)), 2 * PRICE);
    }

    function test_WithdrawRevertsOnZeroAddress() public {
        _fulfill(_ask(alice));
        vm.prank(owner);
        vm.expectRevert(PennyOracle.ZeroAddress.selector);
        po.withdraw(address(0), PRICE);
    }

    function test_WithdrawRevertsForNonOwner() public {
        _fulfill(_ask(alice));
        vm.prank(stranger);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.withdraw(stranger, PRICE);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.withdraw(oracleAddr, PRICE);
    }
}
