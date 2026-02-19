import { Contract, Wallet, JsonRpcProvider, hexlify } from 'ethers';

const INPUTBOX_ABI = [
  "function addInput(address _dapp, bytes calldata _input) external returns (bytes32)"
];

async function submitToCartesi(contract: Contract, dappAddress: string, payload: unknown) {
  const inputBytes = new TextEncoder().encode(JSON.stringify(payload));
  const inputHex = hexlify(inputBytes);
  const tx = await contract.addInput(dappAddress, inputHex);
  const receipt = await tx.wait();
  return { tx, receipt };
}

async function main() {
  const rpcUrl = "http://localhost:8545";
  // Use POOL_ADMIN_PRIVATE_KEY which derives to whitelisted address 0x94802E7a5e8bf7871Db02888846D948C4d8CC093
  const privateKey = "0x95d3e240e8e9ebd5bbb6d00a360bd2d161e34613b3672478c671237e15c1ae27";
  const dappAddress = "0xab7528bb862fb57e8a2bcd567a2e929a0be56a5e";
  const inputBoxAddress = "0x59b22D57D4f067708AB0c00552767405926dc768";

  const loanId = "test-loan-" + Date.now();
  const borrowerAddress = "0x5eb7CF27B5c2E8686E94c76dEF60Cfe77A612Bb3";

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const contract = new Contract(inputBoxAddress, INPUTBOX_ABI, signer);

  console.log("Signer address:", signer.address);
  let balance = await provider.getBalance(signer.address);
  console.log("Signer balance:", balance.toString(), "wei\n");

  // Fund the signer wallet if needed (from Anvil's first default account)
  if (balance === 0n) {
    console.log("Funding signer wallet from Anvil default account...");
    const fundingKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const fundingWallet = new Wallet(fundingKey, provider);
    const fundTx = await fundingWallet.sendTransaction({
      to: signer.address,
      value: BigInt("1000000000000000000") // 1 ETH
    });
    await fundTx.wait();
    balance = await provider.getBalance(signer.address);
    console.log("New signer balance:", balance.toString(), "wei\n");
  }

  // Step 1: Register borrower (uses snake_case)
  console.log("Step 1: Registering borrower...");
  const registerBorrower = {
    action: "register_borrower",
    wallet_address: borrowerAddress,  // snake_case!
    plaid_item_hash: "test-plaid-item-hash"  // snake_case!
  };
  await submitToCartesi(contract, dappAddress, registerBorrower);
  console.log("Borrower registered!\n");

  // Wait for processing
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Create loan (uses snake_case)
  console.log("Step 2: Creating loan...");
  const createLoan = {
    action: "create_loan",
    loan_id: loanId,  // snake_case!
    borrower_address: borrowerAddress,  // snake_case!
    amount: 100000000, // $100,000 in cents
    term_months: 24  // snake_case!
  };
  await submitToCartesi(contract, dappAddress, createLoan);
  console.log("Loan created!\n");

  // Wait for processing
  await new Promise(r => setTimeout(r, 2000));

  // Step 3: Submit zkFetch DSCR verification
  console.log("Step 3: Submitting zkFetch DSCR verification...");
  const testInput = {
    action: "verify_dscr_zkfetch",
    loanId: loanId,
    borrowerAddress: borrowerAddress,
    data: {
      transactionCount: 45,
      monthlyNoi: 850000,  // $8,500 * 100
      monthlyDebtService: 500000, // $5,000 * 100
      dscrValue: 1700,  // 1.7 * 1000 (scaled by 1000 for 3 decimal precision)
      zkFetchProofHash: "abc123def456789012345678901234567890abcdef",
      calculatedAt: Date.now()
    },
    zkProof: {
      identifier: "test-proof-id-12345",
      claimData: {
        provider: "plaid",
        parameters: "transactions/sync",
        context: "test"
      },
      signatures: ["sig1", "sig2"]
    }
  };
  console.log("zkFetch Input:", JSON.stringify(testInput, null, 2));

  const { tx, receipt } = await submitToCartesi(contract, dappAddress, testInput);
  console.log("Transaction submitted:", tx.hash);
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed?.toString());

  // Wait a moment for Cartesi to process
  console.log("\nWaiting 5 seconds for Cartesi to process...");
  await new Promise(r => setTimeout(r, 5000));

  // Query the inspect endpoint
  const inspectUrl = `http://localhost:8080/inspect/zkfetch/loan_id/${loanId}`;
  console.log("\nQuerying:", inspectUrl);

  const response = await fetch(inspectUrl);
  const result = await response.json();

  if (result.reports && result.reports[0]) {
    const payload = result.reports[0].payload;
    const decoded = Buffer.from(payload.slice(2), 'hex').toString('utf8');
    console.log("\nCartesi response:", JSON.parse(decoded));
  }
}

main().catch(console.error);
