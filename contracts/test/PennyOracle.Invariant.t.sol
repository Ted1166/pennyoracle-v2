// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PennyOracle} from "../PennyOracle.sol";
import {MockUSDC} from "./mocks/PennyOracleMocks.sol";

contract PennyOracleHandler is Test {
    uint256 internal constant PRICE = 10_000;

    PennyOracle public po;
    MockUSDC public usdc;
    address public owner;
    address public oracleAddr;
    address public sink = address(0xBEEF);
    address[] public actors;

    uint8[] public status;
    address[] public askers;
    uint256 public pendingCount;
    uint256 public fulfilledCount;
    uint256 public withdrawn;
    uint256 public totalPaidIn;
    uint256 public totalRefunded;

    constructor(PennyOracle po_, MockUSDC usdc_, address owner_, address oracle_) {
        po = po_;
        usdc = usdc_;
        owner = owner_;
        oracleAddr = oracle_;
        for (uint256 i = 0; i < 3; i++) {
            address a = address(uint160(0xA11CE + i));
            actors.push(a);
            usdc.mint(a, type(uint96).max);
            vm.prank(a);
            usdc.approve(address(po), type(uint256).max);
        }
    }

    function statusLength() external view returns (uint256) {
        return status.length;
    }

    function ask(uint256 actorSeed, uint256 len) external {
        address a = actors[actorSeed % actors.length];
        len = bound(len, 1, 400);
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = "q";
        }
        vm.prank(a);
        uint256 id = po.ask(string(b));
        require(id == status.length, "id mismatch");
        status.push(0);
        askers.push(a);
        pendingCount++;
        totalPaidIn += PRICE;
    }

    function fulfill(uint256 idSeed) external {
        (bool found, uint256 id) = _pick(idSeed);
        if (!found) return;
        vm.prank(oracleAddr);
        po.fulfill(id, keccak256(abi.encode(id)));
        status[id] = 1;
        pendingCount--;
        fulfilledCount++;
    }

    function refund(uint256 idSeed) external {
        (bool found, uint256 id) = _pick(idSeed);
        if (!found) return;
        uint256 due = po.getQuestion(id).askedAt + po.refundTimeout();
        if (block.timestamp < due) vm.warp(due);
        vm.prank(askers[id]);
        po.refund(id);
        status[id] = 2;
        pendingCount--;
        totalRefunded += PRICE;
    }

    function withdraw(uint256 amountSeed) external {
        uint256 amount = bound(amountSeed, 0, po.earned());
        vm.prank(owner);
        po.withdraw(sink, amount);
        withdrawn += amount;
    }

    function overWithdraw(uint256 extra) external {
        extra = bound(extra, 1, 1e12);
        vm.prank(owner);
        try po.withdraw(sink, po.earned() + extra) {
            revert("over-withdraw succeeded");
        } catch {}
    }

    function earlyRefund(uint256 idSeed) external {
        (bool found, uint256 id) = _pick(idSeed);
        if (!found) return;
        uint256 due = po.getQuestion(id).askedAt + po.refundTimeout();
        if (block.timestamp >= due) return;
        vm.prank(askers[id]);
        try po.refund(id) {
            revert("early refund succeeded");
        } catch {}
    }

    function warpForward(uint256 dt) external {
        dt = bound(dt, 0, 3 days);
        vm.warp(block.timestamp + dt);
    }

    function _pick(uint256 seed) internal view returns (bool, uint256) {
        uint256 len = status.length;
        if (len == 0) return (false, 0);
        uint256 start = seed % len;
        for (uint256 k = 0; k < len; k++) {
            uint256 j = (start + k) % len;
            if (status[j] == 0) return (true, j);
        }
        return (false, 0);
    }
}

contract PennyOracleInvariantTest is Test {
    uint256 internal constant PRICE = 10_000;

    MockUSDC internal usdc;
    PennyOracle internal po;
    PennyOracleHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal oracleAddr = makeAddr("oracle");

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        po = new PennyOracle(address(usdc), oracleAddr, 1 days);
        handler = new PennyOracleHandler(po, usdc, owner, oracleAddr);

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = PennyOracleHandler.ask.selector;
        selectors[1] = PennyOracleHandler.fulfill.selector;
        selectors[2] = PennyOracleHandler.refund.selector;
        selectors[3] = PennyOracleHandler.withdraw.selector;
        selectors[4] = PennyOracleHandler.overWithdraw.selector;
        selectors[5] = PennyOracleHandler.earlyRefund.selector;
        selectors[6] = PennyOracleHandler.warpForward.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_BalanceCoversEscrowedPlusEarned() public view {
        assertGe(usdc.balanceOf(address(po)), po.escrowed() + po.earned());
    }

    function invariant_BalanceEqualsEscrowedPlusEarned() public view {
        assertEq(usdc.balanceOf(address(po)), po.escrowed() + po.earned());
    }

    function invariant_EscrowedMatchesPendingQuestions() public view {
        assertEq(po.escrowed(), handler.pendingCount() * PRICE);
    }

    function invariant_EarnedMatchesFulfilledMinusWithdrawn() public view {
        assertEq(po.earned(), handler.fulfilledCount() * PRICE - handler.withdrawn());
    }

    function invariant_ConservationOfPaidInFunds() public view {
        assertEq(handler.totalPaidIn(), usdc.balanceOf(address(po)) + handler.withdrawn() + handler.totalRefunded());
    }

    function invariant_NextIdMatchesQuestionsAsked() public view {
        assertEq(po.nextId(), handler.statusLength());
    }
}
