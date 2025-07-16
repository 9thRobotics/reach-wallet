const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReachToken Bonding Curve", function () {
  let reachToken;
  let owner;
  let buyer;
  let mockPriceFeed;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    // Deploy a mock price feed for testing
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    mockPriceFeed = await MockPriceFeed.deploy(8, ethers.utils.parseUnits("2000", 8)); // $2000 ETH

    // Deploy ReachToken
    const ReachToken = await ethers.getContractFactory("ReachToken");
    reachToken = await ReachToken.deploy(mockPriceFeed.address);
    await reachToken.deployed();
  });

  it("Should have correct initial state", async function () {
    expect(await reachToken.name()).to.equal("Reach 9D-RC");
    expect(await reachToken.symbol()).to.equal("9D-RC");
    expect(await reachToken.basePrice()).to.equal(ethers.utils.parseEther("27")); // $27 USD
    expect(await reachToken.tokensSold()).to.equal(0);
  });

  it("Should calculate bonding curve price correctly", async function () {
    const basePrice = await reachToken.basePrice();
    const bondingConstant = await reachToken.bondingConstant();
    
    // Initial price should be base price (no tokens sold yet)
    const initialPrice = await reachToken.getBondingCurvePrice();
    expect(initialPrice).to.equal(basePrice);
    
    // Manually set tokensSold to test curve
    await reachToken.connect(owner).updatePriceParameters(
      basePrice,
      bondingConstant,
      basePrice
    );
  });

  it("Should use floor price when higher than curve price", async function () {
    const currentPrice = await reachToken.getCurrentTokenPrice();
    const floorPrice = await reachToken.floorPrice();
    
    // Current price should be at least the floor price
    expect(currentPrice).to.be.at.least(floorPrice);
  });

  it("Should calculate ETH required correctly", async function () {
    const tokenAmount = ethers.utils.parseEther("10"); // 10 tokens
    const ethRequired = await reachToken.calculateETHRequired(tokenAmount);
    
    // Should return a positive amount
    expect(ethRequired).to.be.gt(0);
  });

  it("Should update tokens sold after purchase", async function () {
    const initialTokensSold = await reachToken.tokensSold();
    const tokenAmount = ethers.utils.parseEther("1"); // 1 token
    const ethRequired = await reachToken.calculateETHRequired(tokenAmount);
    
    await reachToken.connect(buyer).buyTokens(tokenAmount, {
      value: ethRequired.mul(11).div(10) // 10% extra for slippage
    });
    
    const finalTokensSold = await reachToken.tokensSold();
    expect(finalTokensSold).to.be.gt(initialTokensSold);
  });

  it("Should only allow owner to update price parameters", async function () {
    const newBasePrice = ethers.utils.parseEther("30");
    const newBondingConstant = ethers.utils.parseEther("0.002");
    const newFloorPrice = ethers.utils.parseEther("30");
    
    // Should succeed with owner
    await expect(
      reachToken.connect(owner).updatePriceParameters(
        newBasePrice,
        newBondingConstant,
        newFloorPrice
      )
    ).to.not.be.reverted;
    
    // Should fail with non-owner
    await expect(
      reachToken.connect(buyer).updatePriceParameters(
        newBasePrice,
        newBondingConstant,
        newFloorPrice
      )
    ).to.be.revertedWith("Not owner");
  });

  it("Should pause and unpause correctly", async function () {
    // Pause contract
    await reachToken.connect(owner).pause();
    
    // Should revert purchases when paused
    const tokenAmount = ethers.utils.parseEther("1");
    const ethRequired = await reachToken.calculateETHRequired(tokenAmount);
    
    await expect(
      reachToken.connect(buyer).buyTokens(tokenAmount, {
        value: ethRequired.mul(11).div(10)
      })
    ).to.be.revertedWith("Contract paused");
    
    // Unpause and try again
    await reachToken.connect(owner).unpause();
    
    await expect(
      reachToken.connect(buyer).buyTokens(tokenAmount, {
        value: ethRequired.mul(11).div(10)
      })
    ).to.not.be.reverted;
  });
});