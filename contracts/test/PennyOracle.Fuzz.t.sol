// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PennyOracle} from "../PennyOracle.sol";
import {PennyOracleBase} from "./PennyOracle.Base.t.sol";

contract PennyOracleFuzzTest is PennyOracleBase {
    uint8[] internal status;
    address[] internal askers;
    uint256 internal pendingCount;
    uint256 internal fulfilledCount;
    uint256 internal withdrawn;

    function testFuzz_QuestionLengthWithinLimitAccepted(uint256 len) public {
        len = bound(len, 1, 400);
        string memory q = _str(len);
        vm.prank(alice);
        uint256 id = po.ask(q);
        assertEq(bytes(po.getQuestion(id).question).length, len);
        assertEq(po.escrowed(), PRICE);
    }

    function testFuzz_QuestionLengthOverLimitRejected(uint256 len) public {
        len = bound(len, 401, 3000);
        string memory q = _str(len);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.QuestionTooLong.selector);
        po.ask(q);
        assertEq(po.nextId(), 0);
    }

    function testFuzz_RefundTiming(uint256 offset) public {
        offset = bound(offset, 0, 14 days);
        uint256 id = _ask(alice);
        skip(offset);
        vm.prank(alice);
        if (offset < TIMEOUT) {
            vm.expectRevert(PennyOracle.RefundTooEarly.selector);
            po.refund(id);
            assertEq(po.escrowed(), PRICE);
        } else {
            po.refund(id);
            assertEq(po.escrowed(), 0);
        }
    }

    function testFuzz_ConstructorTimeoutBounds(uint256 t) public {
        t = bound(t, 0, 30 days);
        if (t < 60 || t > 7 days) {
            vm.expectRevert(PennyOracle.InvalidRefundTimeout.selector);
            new PennyOracle(address(usdc), oracleAddr, t);
        } else {
            PennyOracle p = new PennyOracle(address(usdc), oracleAddr, t);
            assertEq(p.refundTimeout(), t);
        }
    }

    function testFuzz_WithdrawLimitedToEarned(uint8 fulfilled, uint8 pending, uint256 amount) public {
        fulfilled = uint8(bound(fulfilled, 0, 8));
        pending = uint8(bound(pending, 0, 8));
        for (uint256 i = 0; i < fulfilled; i++) {
            _fulfill(_ask(alice));
        }
        for (uint256 i = 0; i < pending; i++) {
            _ask(bob);
        }
        uint256 earnedAmt = uint256(fulfilled) * PRICE;
        amount = bound(amount, 0, (uint256(fulfilled) + pending + 2) * PRICE);
        vm.prank(owner);
        if (amount > earnedAmt) {
            vm.expectRevert(PennyOracle.InsufficientEarned.selector);
            po.withdraw(stranger, amount);
        } else {
            po.withdraw(stranger, amount);
            assertEq(usdc.balanceOf(stranger), amount);
            assertEq(po.earned(), earnedAmt - amount);
        }
        assertEq(po.escrowed(), uint256(pending) * PRICE);
        assertGe(usdc.balanceOf(address(po)), uint256(pending) * PRICE);
    }

    function testFuzz_RandomSequenceKeepsBalanceCoveringLiabilities(uint256 seed, uint8 steps) public {
        uint256 n = bound(steps, 1, 60);
        for (uint256 i = 0; i < n; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            uint256 op = r % 5;
            if (op == 0) {
                _doAsk(r);
            } else if (op == 1) {
                _doFulfill(r);
            } else if (op == 2) {
                _doRefund(r);
            } else if (op == 3) {
                _doWithdraw(r);
            } else {
                skip((r >> 8) % (2 days));
            }
            _checkAccounting();
        }
    }

    function _doAsk(uint256 r) internal {
        address who = (r >> 8) % 2 == 0 ? alice : bob;
        uint256 id = _ask(who);
        assertEq(id, status.length);
        status.push(0);
        askers.push(who);
        pendingCount++;
    }

    function _pickPending(uint256 r) internal view returns (bool found, uint256 id) {
        uint256 len = status.length;
        if (len == 0) return (false, 0);
        uint256 start = (r >> 8) % len;
        for (uint256 k = 0; k < len; k++) {
            uint256 j = (start + k) % len;
            if (status[j] == 0) return (true, j);
        }
        return (false, 0);
    }

    function _doFulfill(uint256 r) internal {
        (bool found, uint256 id) = _pickPending(r);
        if (!found) return;
        _fulfill(id);
        status[id] = 1;
        pendingCount--;
        fulfilledCount++;
    }

    function _doRefund(uint256 r) internal {
        (bool found, uint256 id) = _pickPending(r);
        if (!found) return;
        uint256 due = po.getQuestion(id).askedAt + TIMEOUT;
        if (block.timestamp < due) vm.warp(due);
        _refund(id, askers[id]);
        status[id] = 2;
        pendingCount--;
    }

    function _doWithdraw(uint256 r) internal {
        uint256 amount = (r >> 8) % (po.earned() + 1);
        vm.prank(owner);
        po.withdraw(stranger, amount);
        withdrawn += amount;
    }

    function _checkAccounting() internal view {
        uint256 bal = usdc.balanceOf(address(po));
        assertGe(bal, po.escrowed() + po.earned());
        assertEq(bal, po.escrowed() + po.earned());
        assertEq(po.escrowed(), pendingCount * PRICE);
        assertEq(po.earned(), fulfilledCount * PRICE - withdrawn);
        assertEq(po.nextId(), status.length);
    }
}
