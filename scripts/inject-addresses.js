#!/usr/bin/env node
/**
 * inject-addresses.js
 *
 * Reads deployed contract addresses from loan-pool/deployed-addresses.json
 * and updates .env.local with the addresses.
 *
 * Usage: node scripts/inject-addresses.js
 */

const fs = require('fs');
const path = require('path');

const ADDRESSES_FILE = path.join(__dirname, '../../loan-pool/deployed-addresses.json');
const ENV_FILE = path.join(__dirname, '../.env.local');
const ENV_EXAMPLE = path.join(__dirname, '../.env.local.example');

function main() {
  console.log('Injecting deployed addresses into .env.local...\n');

  // Check if addresses file exists
  if (!fs.existsSync(ADDRESSES_FILE)) {
    console.error('Error: deployed-addresses.json not found!');
    console.error('Run ./scripts/deploy-local.sh in loan-pool directory first.');
    process.exit(1);
  }

  // Read deployed addresses
  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
  console.log('Found deployed addresses:');
  console.log(JSON.stringify(addresses.contracts, null, 2));
  console.log('');

  // Read existing .env.local or create from example
  let envContent;
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
    console.log('Updating existing .env.local...');
  } else if (fs.existsSync(ENV_EXAMPLE)) {
    envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8');
    console.log('Creating .env.local from .env.local.example...');
  } else {
    console.error('Error: No .env.local or .env.local.example found!');
    process.exit(1);
  }

  // Map of address keys to env variable names
  const addressMap = {
    token: 'NEXT_PUBLIC_TOKEN_ADDRESS',
    loanPool: 'NEXT_PUBLIC_LOAN_POOL_ADDRESS',
    stakingPool: 'NEXT_PUBLIC_STAKING_POOL_ADDRESS',
    borrowerCredential: 'NEXT_PUBLIC_BORROWER_NFT_ADDRESS',
    investorCredential: 'NEXT_PUBLIC_INVESTOR_NFT_ADDRESS',
  };

  // Update each address in env content
  for (const [key, envVar] of Object.entries(addressMap)) {
    const address = addresses.contracts[key];
    if (address) {
      // Match the env var line and replace its value
      const regex = new RegExp(`^${envVar}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${envVar}=${address}`);
      } else {
        // Add the variable if it doesn't exist
        envContent += `\n${envVar}=${address}`;
      }
      console.log(`  ${envVar}=${address}`);
    }
  }

  // Also update chain configuration
  envContent = envContent.replace(
    /^NEXT_PUBLIC_CHAIN_ID=.*$/m,
    `NEXT_PUBLIC_CHAIN_ID=${addresses.chainId}`
  );
  envContent = envContent.replace(
    /^NEXT_PUBLIC_RPC_URL=.*$/m,
    `NEXT_PUBLIC_RPC_URL=${addresses.rpcUrl}`
  );

  // Write updated content
  fs.writeFileSync(ENV_FILE, envContent);

  console.log('\n.env.local updated successfully!');
  console.log('\nNext steps:');
  console.log('  1. npm run dev');
  console.log('  2. Open http://localhost:3000');
  console.log('  3. Import Anvil account in MetaMask:');
  console.log('     Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
}

main();
