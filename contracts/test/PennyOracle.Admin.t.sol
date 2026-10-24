// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PennyOracle} from "../PennyOracle.sol";
import {PennyOracleBase} from "./PennyOracle.Base.t.sol";

contract PennyOracleAdminTest is PennyOracleBase {
    address internal newOracle = makeAddr("newOracle");
    address internal newOwner = makeAddr("newOwner");

    function test_SetOracleUpdatesAndEmits() public {
        vm.expectEmit(true, true, false, false, address(po));
        emit PennyOracle.OracleUpdated(oracleAddr, newOracle);
        vm.prank(owner);
        po.setOracle(newOracle);
        assertEq(po.oracle(), newOracle);
    }

    function test_SetOracleRevertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.setOracle(newOracle);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.setOracle(newOracle);
    }

    function test_SetOracleRevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PennyOracle.ZeroAddress.selector);
        po.setOracle(address(0));
        assertEq(po.oracle(), oracleAddr);
    }

    function test_NewOracleGainsAndOldOracleLosesFulfill() public {
        uint256 id = _ask(alice);
        vm.prank(owner);
        po.setOracle(newOracle);
        vm.prank(oracleAddr);
        vm.expectRevert(PennyOracle.NotOracle.selector);
        po.fulfill(id, keccak256("x"));
        vm.prank(newOracle);
        po.fulfill(id, keccak256("x"));
        assertTrue(po.getQuestion(id).fulfilled);
    }

    function test_SetOwnerUpdatesAndEmits() public {
        vm.expectEmit(true, true, false, false, address(po));
        emit PennyOracle.OwnerUpdated(owner, newOwner);
        vm.prank(owner);
        po.setOwner(newOwner);
        assertEq(po.owner(), newOwner);
    }

    function test_SetOwnerRevertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.setOwner(stranger);
    }

    function test_SetOwnerRevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PennyOracle.ZeroAddress.selector);
        po.setOwner(address(0));
        assertEq(po.owner(), owner);
    }

    function test_NewOwnerGainsAndOldOwnerLosesPrivileges() public {
        _fulfill(_ask(alice));
        vm.prank(owner);
        po.setOwner(newOwner);

        vm.startPrank(owner);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.withdraw(owner, PRICE);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.setOracle(newOracle);
        vm.expectRevert(PennyOracle.NotOwner.selector);
        po.setOwner(owner);
        vm.stopPrank();

        vm.startPrank(newOwner);
        po.setOracle(newOracle);
        po.withdraw(newOwner, PRICE);
        vm.stopPrank();
        assertEq(usdc.balanceOf(newOwner), PRICE);
        assertEq(po.oracle(), newOracle);
    }

    function test_OwnerCanSetSelfAsOracle() public {
        vm.prank(owner);
        po.setOracle(owner);
        uint256 id = _ask(alice);
        vm.prank(owner);
        po.fulfill(id, keccak256("x"));
        assertEq(po.earned(), PRICE);
    }
}
