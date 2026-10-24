// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {PennyOracle} from "../PennyOracle.sol";
import {PennyOracleBase} from "./PennyOracle.Base.t.sol";

contract PennyOracleTest is PennyOracleBase {
    function test_ConstructorSetsState() public view {
        assertEq(po.owner(), owner);
        assertEq(po.oracle(), oracleAddr);
        assertEq(address(po.usdc()), address(usdc));
        assertEq(po.refundTimeout(), TIMEOUT);
        assertEq(po.PRICE(), PRICE);
        assertEq(po.nextId(), 0);
        assertEq(po.escrowed(), 0);
        assertEq(po.earned(), 0);
    }

    function test_ConstructorOwnerIsDeployer() public {
        PennyOracle p = new PennyOracle(address(usdc), oracleAddr, 60);
        assertEq(p.owner(), address(this));
    }

    function test_ConstructorRevertsOnZeroUsdc() public {
        vm.expectRevert(PennyOracle.ZeroAddress.selector);
        new PennyOracle(address(0), oracleAddr, TIMEOUT);
    }

    function test_ConstructorRevertsOnZeroOracle() public {
        vm.expectRevert(PennyOracle.ZeroAddress.selector);
        new PennyOracle(address(usdc), address(0), TIMEOUT);
    }

    function test_ConstructorRevertsOnTimeoutBelowMin() public {
        vm.expectRevert(PennyOracle.InvalidRefundTimeout.selector);
        new PennyOracle(address(usdc), oracleAddr, 59);
    }

    function test_ConstructorRevertsOnTimeoutAboveMax() public {
        vm.expectRevert(PennyOracle.InvalidRefundTimeout.selector);
        new PennyOracle(address(usdc), oracleAddr, 7 days + 1);
    }

    function test_ConstructorRevertsOnZeroTimeout() public {
        vm.expectRevert(PennyOracle.InvalidRefundTimeout.selector);
        new PennyOracle(address(usdc), oracleAddr, 0);
    }

    function test_ConstructorAcceptsMinTimeout() public {
        PennyOracle p = new PennyOracle(address(usdc), oracleAddr, 60);
        assertEq(p.refundTimeout(), 60);
    }

    function test_ConstructorAcceptsMaxTimeout() public {
        PennyOracle p = new PennyOracle(address(usdc), oracleAddr, 7 days);
        assertEq(p.refundTimeout(), 7 days);
    }

    function test_AskDebitsAskerAndCreditsContract() public {
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 poBefore = usdc.balanceOf(address(po));
        _ask(alice);
        assertEq(usdc.balanceOf(alice), aliceBefore - PRICE);
        assertEq(usdc.balanceOf(address(po)), poBefore + PRICE);
        assertEq(po.escrowed(), PRICE);
        assertEq(po.earned(), 0);
    }

    function test_AskIncrementsNextIdAndReturnsSequentialIds() public {
        assertEq(_ask(alice), 0);
        assertEq(po.nextId(), 1);
        assertEq(_ask(bob), 1);
        assertEq(_ask(alice), 2);
        assertEq(po.nextId(), 3);
        assertEq(po.escrowed(), 3 * PRICE);
    }

    function test_AskEmitsAskedWithExactFields() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true, address(po));
        emit PennyOracle.Asked(0, alice, "what is 1+1?", uint64(1_700_000_000));
        _ask(alice);
    }

    function test_AskEmitsAskedWithSecondId() public {
        _ask(alice);
        vm.expectEmit(true, true, false, true, address(po));
        emit PennyOracle.Asked(1, bob, "second", uint64(block.timestamp));
        vm.prank(bob);
        po.ask("second");
    }

    function test_GetQuestionReturnsFullStruct() public {
        vm.warp(1_700_000_000);
        uint256 id = _ask(alice);
        PennyOracle.Question memory q = po.getQuestion(id);
        assertEq(q.asker, alice);
        assertEq(q.question, "what is 1+1?");
        assertEq(q.answerHash, bytes32(0));
        assertFalse(q.fulfilled);
        assertFalse(q.refunded);
        assertEq(q.askedAt, 1_700_000_000);
        assertEq(q.settledAt, 0);
    }

    function test_GetQuestionRevertsForNonexistentId() public {
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.getQuestion(0);
        _ask(alice);
        vm.expectRevert(PennyOracle.QuestionNotFound.selector);
        po.getQuestion(1);
    }

    function test_AskRevertsOnEmptyQuestion() public {
        vm.prank(alice);
        vm.expectRevert(PennyOracle.EmptyQuestion.selector);
        po.ask("");
    }

    function test_AskAccepts400ByteQuestion() public {
        vm.prank(alice);
        uint256 id = po.ask(_str(400));
        assertEq(bytes(po.getQuestion(id).question).length, 400);
    }

    function test_AskRejects401ByteQuestion() public {
        string memory q = _str(401);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.QuestionTooLong.selector);
        po.ask(q);
    }

    function test_AskCountsBytesNotCharacters() public {
        bytes memory b = new bytes(401);
        for (uint256 i = 0; i < 401; i++) {
            b[i] = 0xc3;
        }
        string memory q = string(b);
        vm.prank(alice);
        vm.expectRevert(PennyOracle.QuestionTooLong.selector);
        po.ask(q);
    }

    function test_AskRevertsWithoutApproval() public {
        usdc.mint(stranger, 1e6);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(po), 0, PRICE)
        );
        po.ask("q");
        assertEq(po.nextId(), 0);
        assertEq(po.escrowed(), 0);
    }

    function test_AskRevertsWithInsufficientAllowance() public {
        usdc.mint(stranger, 1e6);
        vm.startPrank(stranger);
        usdc.approve(address(po), PRICE - 1);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(po), PRICE - 1, PRICE)
        );
        po.ask("q");
        vm.stopPrank();
    }

    function test_AskRevertsWithInsufficientBalance() public {
        usdc.mint(stranger, PRICE - 1);
        vm.startPrank(stranger);
        usdc.approve(address(po), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, stranger, PRICE - 1, PRICE)
        );
        po.ask("q");
        vm.stopPrank();
        assertEq(po.nextId(), 0);
        assertEq(po.escrowed(), 0);
    }

    function test_AskSucceedsWithExactBalanceAndAllowance() public {
        usdc.mint(stranger, PRICE);
        vm.startPrank(stranger);
        usdc.approve(address(po), PRICE);
        po.ask("q");
        vm.stopPrank();
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(usdc.allowance(stranger, address(po)), 0);
    }

    function test_AskIsNotPayable() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(po).call{value: 1}(abi.encodeCall(po.ask, ("q")));
        assertFalse(ok);
        assertEq(address(po).balance, 0);
        assertEq(po.nextId(), 0);
    }

    function test_ContractRejectsPlainEther() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(po).call{value: 1}("");
        assertFalse(ok);
    }
}
