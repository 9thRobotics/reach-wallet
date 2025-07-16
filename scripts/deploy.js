const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ReachToken contract with bonding curve...");

  // ETH/USD price feed address on mainnet
  const CHAINLINK_ETH_USD_MAINNET = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
  
  // Get the contract factory
  const ReachToken = await ethers.getContractFactory("ReachToken");
  
  // Deploy the contract
  const reachToken = await ReachToken.deploy(CHAINLINK_ETH_USD_MAINNET);
  
  await reachToken.deployed();

  console.log("ReachToken deployed to:", reachToken.address);
  console.log("Price feed:", CHAINLINK_ETH_USD_MAINNET);
  
  // Display initial contract state
  const contractInfo = await reachToken.getContractInfo();
  console.log("Initial state:");
  console.log("- Current price (USD):", ethers.utils.formatEther(contractInfo.currentPrice));
  console.log("- Tokens sold:", ethers.utils.formatEther(contractInfo.totalTokensSold));
  console.log("- Contract token balance:", ethers.utils.formatEther(contractInfo.contractBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });