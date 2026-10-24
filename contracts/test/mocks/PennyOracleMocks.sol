// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PennyOracle} from "../../PennyOracle.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract HookUSDC is MockUSDC {
    address public reenterTarget;
    bytes public reenterData;
    bool public reenterArmed;
    bool public reenterFired;
    bool public reenterOk;
    bytes public reenterRet;

    function armReentry(address target, bytes calldata data) external {
        reenterTarget = target;
        reenterData = data;
        reenterArmed = true;
    }

    function reenterSelector() external view returns (bytes4) {
        return bytes4(reenterRet);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from == address(0) || to == address(0)) return;
        if (reenterArmed) {
            reenterArmed = false;
            reenterFired = true;
            (reenterOk, reenterRet) = reenterTarget.call(reenterData);
        }
        if (to.code.length > 0) {
            (bool okTo,) = to.call(abi.encodeWithSignature("onTokenReceived()"));
            okTo;
        }
        if (from.code.length > 0) {
            (bool okFrom,) = from.call(abi.encodeWithSignature("onTokenPull()"));
            okFrom;
        }
    }
}

contract ReentrantActor {
    PennyOracle public immutable target;
    HookUSDC public immutable token;
    bytes public payload;
    bool public armed;
    bool public fired;
    bool public reentryOk;
    bytes public reentryRet;

    constructor(PennyOracle target_, HookUSDC token_) {
        target = target_;
        token = token_;
    }

    function arm(bytes calldata data) external {
        payload = data;
        armed = true;
    }

    function reentrySelector() external view returns (bytes4) {
        return bytes4(reentryRet);
    }

    function approveAndAsk(string calldata question) external returns (uint256) {
        token.approve(address(target), type(uint256).max);
        return target.ask(question);
    }

    function doRefund(uint256 id) external {
        target.refund(id);
    }

    function doWithdraw(address to, uint256 amount) external {
        target.withdraw(to, amount);
    }

    function onTokenReceived() external {
        _fire();
    }

    function onTokenPull() external {
        _fire();
    }

    function _fire() internal {
        if (!armed) return;
        armed = false;
        fired = true;
        (reentryOk, reentryRet) = address(target).call(payload);
    }
}
