import { parseAbi } from 'viem'

export const pennyOracleAbi = parseAbi([
  'struct Question { address asker; string question; bytes32 answerHash; bool fulfilled; bool refunded; uint64 askedAt; uint64 settledAt; }',
  'function PRICE() view returns (uint256)',
  'function refundTimeout() view returns (uint256)',
  'function nextId() view returns (uint256)',
  'function getQuestion(uint256 id) view returns (Question)',
  'function ask(string question) returns (uint256 id)',
  'function refund(uint256 id)',
  'event Asked(uint256 indexed id, address indexed asker, string question, uint64 askedAt)',
  'event Fulfilled(uint256 indexed id, bytes32 answerHash, uint64 fulfilledAt)',
  'event Refunded(uint256 indexed id, address indexed asker, uint256 amount)',
  'error EmptyQuestion()',
  'error QuestionTooLong()',
  'error QuestionNotFound()',
  'error NotAsker()',
  'error NotPending()',
  'error RefundTooEarly()',
  'error ReentrancyGuardReentrantCall()',
])

export const MAX_QUESTION_BYTES = 400
