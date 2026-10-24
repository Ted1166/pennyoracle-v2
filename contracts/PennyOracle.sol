// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PennyOracle is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Question {
        address asker;
        string question;
        bytes32 answerHash;
        bool fulfilled;
        bool refunded;
        uint64 askedAt;
        uint64 settledAt;
    }

    error EmptyQuestion();
    error QuestionTooLong();
    error QuestionNotFound();
    error NotOracle();
    error NotOwner();
    error NotAsker();
    error AlreadyFulfilled();
    error AlreadyRefunded();
    error NotPending();
    error RefundTooEarly();
    error InsufficientEarned();
    error ZeroAddress();
    error InvalidRefundTimeout();

    event Asked(uint256 indexed id, address indexed asker, string question, uint64 askedAt);
    event Fulfilled(uint256 indexed id, bytes32 answerHash, uint64 fulfilledAt);
    event Refunded(uint256 indexed id, address indexed asker, uint256 amount);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    uint256 public constant PRICE = 10_000;
    IERC20 public immutable usdc;
    address public oracle;
    address public owner;
    uint256 public immutable refundTimeout;
    uint256 public nextId;
    uint256 public escrowed;
    uint256 public earned;

    mapping(uint256 => Question) private questions;

    constructor(address usdc_, address oracle_, uint256 refundTimeout_) {
        if (usdc_ == address(0) || oracle_ == address(0)) revert ZeroAddress();
        if (refundTimeout_ < 60 seconds || refundTimeout_ > 7 days) revert InvalidRefundTimeout();
        usdc = IERC20(usdc_);
        oracle = oracle_;
        owner = msg.sender;
        refundTimeout = refundTimeout_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    function getQuestion(uint256 id) external view returns (Question memory) {
        if (id >= nextId) revert QuestionNotFound();
        return questions[id];
    }

    function ask(string calldata question) external nonReentrant returns (uint256 id) {
        uint256 length = bytes(question).length;
        if (length == 0) revert EmptyQuestion();
        if (length > 400) revert QuestionTooLong();

        id = nextId;
        nextId = id + 1;
        escrowed += PRICE;
        uint64 askedAt = uint64(block.timestamp);
        questions[id] = Question({
            asker: msg.sender,
            question: question,
            answerHash: bytes32(0),
            fulfilled: false,
            refunded: false,
            askedAt: askedAt,
            settledAt: 0
        });
        emit Asked(id, msg.sender, question, askedAt);
        usdc.safeTransferFrom(msg.sender, address(this), PRICE);
    }

    function fulfill(uint256 id, bytes32 answerHash) external onlyOracle {
        if (id >= nextId) revert QuestionNotFound();
        Question storage question = questions[id];
        if (question.fulfilled) revert AlreadyFulfilled();
        if (question.refunded) revert AlreadyRefunded();

        escrowed -= PRICE;
        earned += PRICE;
        question.answerHash = answerHash;
        question.fulfilled = true;
        question.settledAt = uint64(block.timestamp);
        emit Fulfilled(id, answerHash, question.settledAt);
    }

    function refund(uint256 id) external nonReentrant {
        if (id >= nextId) revert QuestionNotFound();
        Question storage question = questions[id];
        if (msg.sender != question.asker) revert NotAsker();
        if (question.fulfilled || question.refunded) revert NotPending();
        if (block.timestamp < uint256(question.askedAt) + refundTimeout) revert RefundTooEarly();

        question.refunded = true;
        question.settledAt = uint64(block.timestamp);
        escrowed -= PRICE;
        usdc.safeTransfer(question.asker, PRICE);
        emit Refunded(id, question.asker, PRICE);
    }

    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > earned) revert InsufficientEarned();
        earned -= amount;
        usdc.safeTransfer(to, amount);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        address previousOracle = oracle;
        oracle = newOracle;
        emit OracleUpdated(previousOracle, newOracle);
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnerUpdated(previousOwner, newOwner);
    }
}
