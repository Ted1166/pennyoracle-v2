import { parseAbi, parseAbiItem } from 'viem'

export const pennyOracleAbi = parseAbi([
  'struct Question { address asker; string question; bytes32 answerHash; bool fulfilled; bool refunded; uint64 askedAt; uint64 settledAt; }',
  'function oracle() view returns (address)',
  'function nextId() view returns (uint256)',
  'function getQuestion(uint256 id) view returns (Question)',
  'function fulfill(uint256 id, bytes32 answerHash)',
])

export const askedEvent = parseAbiItem(
  'event Asked(uint256 indexed id, address indexed asker, string question, uint64 askedAt)',
)

export const refundedEvent = parseAbiItem(
  'event Refunded(uint256 indexed id, address indexed asker, uint256 amount)',
)
