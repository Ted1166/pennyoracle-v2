export interface ParsedError {
  silent: boolean
  message: string
}

export function parseOnchainError(error: unknown): ParsedError {
  const raw = error instanceof Error ? error.message : String(error)
  const text = raw.toLowerCase()
  if (text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')) {
    return { silent: true, message: '' }
  }
  if (text.includes('insufficient funds') || text.includes('exceeds balance') || text.includes('transfer amount exceeds')) {
    return { silent: false, message: 'Not enough USDC to cover the price and network fee.' }
  }
  if (text.includes('refundtooearly')) {
    return { silent: false, message: 'The refund window has not opened yet.' }
  }
  if (text.includes('notpending')) {
    return { silent: false, message: 'This question has already been settled.' }
  }
  if (text.includes('notasker')) {
    return { silent: false, message: 'Only the wallet that asked can claim this refund.' }
  }
  if (text.includes('questiontoolong')) {
    return { silent: false, message: 'That question is longer than 400 bytes.' }
  }
  if (text.includes('emptyquestion')) {
    return { silent: false, message: 'Write a question first.' }
  }
  if (text.includes('network') || text.includes('timeout') || text.includes('fetch failed')) {
    return { silent: false, message: 'Network issue. Check your connection and try again.' }
  }
  if (text.includes('reverted')) {
    return { silent: false, message: 'The transaction was reverted by the contract.' }
  }
  return { silent: false, message: 'Something went wrong. Please try again.' }
}
