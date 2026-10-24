import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  type Abi,
  type Address,
  type Hex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export const ANVIL_PORT = 8599
export const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`
export const CHAIN_ID = 31337
export const REFUND_TIMEOUT = 60

export const chain = defineChain({
  id: CHAIN_ID,
  name: 'anvil',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_URL] } },
})

interface Artifact {
  abi: Abi
  bytecode: Hex
}

function loadArtifact(relative: string): Artifact | undefined {
  const path = fileURLToPath(new URL(`../../contracts/out/${relative}`, import.meta.url))
  if (!existsSync(path)) return undefined
  const json = JSON.parse(readFileSync(path, 'utf8')) as { abi: Abi; bytecode: { object: Hex } }
  return { abi: json.abi, bytecode: json.bytecode.object }
}

export const oracleArtifact = loadArtifact('PennyOracle.sol/PennyOracle.json')
export const usdcArtifact = loadArtifact('PennyOracleMocks.sol/MockUSDC.json')

export const publicClient = createPublicClient({ chain, transport: http(ANVIL_URL) })
export const testClient = createTestClient({ chain, mode: 'anvil', transport: http(ANVIL_URL) })

export function newAccount() {
  return privateKeyToAccount(generatePrivateKey())
}

export type TestAccount = ReturnType<typeof newAccount>

export function walletFor(account: TestAccount) {
  return createWalletClient({ account, chain, transport: http(ANVIL_URL) })
}

export async function funded(): Promise<TestAccount> {
  const account = newAccount()
  await testClient.setBalance({ address: account.address, value: 10n ** 21n })
  return account
}

export async function startAnvil(): Promise<ChildProcess> {
  const child = spawn('anvil', ['--port', String(ANVIL_PORT), '--chain-id', String(CHAIN_ID), '--silent'], {
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await publicClient.getChainId()
      return child
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  child.kill()
  throw new Error('anvil did not start')
}

export async function send(
  account: TestAccount,
  address: Address,
  abi: Abi,
  functionName: string,
  args: unknown[] = [],
): Promise<Hex> {
  const hash = await walletFor(account).writeContract({ address, abi, functionName, args })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted`)
  return hash
}

export async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('condition not met in time')
}

export interface Deployment {
  usdc: Address
  oracle: Address
  deployer: TestAccount
  oracleAccount: TestAccount
  oracleKey: Hex
}

export async function deploy(): Promise<Deployment> {
  if (!oracleArtifact || !usdcArtifact) throw new Error('contract artifacts missing')
  const deployer = await funded()
  const oracleKey = generatePrivateKey()
  const oracleAccount = privateKeyToAccount(oracleKey)
  await testClient.setBalance({ address: oracleAccount.address, value: 10n ** 21n })
  const wallet = walletFor(deployer)

  const usdcHash = await wallet.deployContract({ abi: usdcArtifact.abi, bytecode: usdcArtifact.bytecode })
  const usdc = (await publicClient.waitForTransactionReceipt({ hash: usdcHash })).contractAddress
  if (!usdc) throw new Error('usdc deploy failed')

  const oracleHash = await wallet.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode,
    args: [usdc, oracleAccount.address, BigInt(REFUND_TIMEOUT)],
  })
  const oracle = (await publicClient.waitForTransactionReceipt({ hash: oracleHash })).contractAddress
  if (!oracle) throw new Error('oracle deploy failed')

  return { usdc, oracle, deployer, oracleAccount, oracleKey }
}

export async function askQuestion(deployment: Deployment, asker: TestAccount, text: string): Promise<number> {
  if (!oracleArtifact || !usdcArtifact) throw new Error('contract artifacts missing')
  await send(deployment.deployer, deployment.usdc, usdcArtifact.abi, 'mint', [asker.address, 1_000_000n])
  await send(asker, deployment.usdc, usdcArtifact.abi, 'approve', [deployment.oracle, 10_000n])
  const id = (await publicClient.readContract({
    address: deployment.oracle,
    abi: oracleArtifact.abi,
    functionName: 'nextId',
  })) as bigint
  await send(asker, deployment.oracle, oracleArtifact.abi, 'ask', [text])
  return Number(id)
}

export async function pastTimeout(): Promise<void> {
  await testClient.increaseTime({ seconds: REFUND_TIMEOUT + 1 })
  await testClient.mine({ blocks: 1 })
}
