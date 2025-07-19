const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReachToken Governance - 1 Vote Per Wallet", function () {
  let reachToken;
  let owner;
  let voter1;
  let voter2;
  let voter3;
  let mockPriceFeed;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy a mock price feed for testing
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    mockPriceFeed = await MockPriceFeed.deploy(8, ethers.utils.parseUnits("2000", 8)); // $2000 ETH

    // Deploy ReachToken
    const ReachToken = await ethers.getContractFactory("ReachToken");
    reachToken = await ReachToken.deploy(mockPriceFeed.address);
    await reachToken.deployed();

    // Give some tokens to voters so they can vote
    const tokenAmount = ethers.utils.parseEther("100");
    await reachToken._transfer(reachToken.address, voter1.address, tokenAmount);
    await reachToken._transfer(reachToken.address, voter2.address, tokenAmount);
    await reachToken._transfer(reachToken.address, voter3.address, tokenAmount);
  });

  it("Should have correct initial governance state", async function () {
    expect(await reachToken.proposalCount()).to.equal(0);
    expect(await reachToken.VOTING_PERIOD()).to.equal(7 * 24 * 60 * 60); // 7 days
  });

  it("Should allow owner to create proposals", async function () {
    await expect(
      reachToken.connect(owner).createProposal("Test Proposal 1")
    ).to.emit(reachToken, "ProposalCreated")
      .withArgs(1, "Test Proposal 1", ethers.utils.anyValue);

    expect(await reachToken.proposalCount()).to.equal(1);

    const proposal = await reachToken.getProposal(1);
    expect(proposal.id).to.equal(1);
    expect(proposal.description).to.equal("Test Proposal 1");
    expect(proposal.voteCount).to.equal(0);
    expect(proposal.executed).to.equal(false);
  });

  it("Should not allow non-owner to create proposals", async function () {
    await expect(
      reachToken.connect(voter1).createProposal("Unauthorized Proposal")
    ).to.be.revertedWith("Not owner");
  });

  it("Should implement 1 vote per wallet regardless of token balance", async function () {
    // Create a proposal
    await reachToken.connect(owner).createProposal("Test Equal Voting");

    // Give voter1 much more tokens than voter2
    const largeAmount = ethers.utils.parseEther("10000");
    await reachToken._transfer(reachToken.address, voter1.address, largeAmount);

    // Both voters should get exactly 1 vote regardless of balance
    await expect(
      reachToken.connect(voter1).vote(1)
    ).to.emit(reachToken, "VoteCast")
      .withArgs(voter1.address, 1, 1); // Should emit 1 vote

    await expect(
      reachToken.connect(voter2).vote(1)
    ).to.emit(reachToken, "VoteCast")
      .withArgs(voter2.address, 1, 1); // Should emit 1 vote

    // Check proposal vote count - should be 2 (one from each wallet)
    const proposal = await reachToken.getProposal(1);
    expect(proposal.voteCount).to.equal(2);

    // Verify both wallets have voted
    expect(await reachToken.hasVoted(1, voter1.address)).to.equal(true);
    expect(await reachToken.hasVoted(1, voter2.address)).to.equal(true);
    expect(await reachToken.hasVoted(1, voter3.address)).to.equal(false);
  });

  it("Should prevent double voting from same wallet", async function () {
    await reachToken.connect(owner).createProposal("Test Double Vote Prevention");

    // First vote should succeed
    await reachToken.connect(voter1).vote(1);

    // Second vote from same wallet should fail
    await expect(
      reachToken.connect(voter1).vote(1)
    ).to.be.revertedWith("Already voted");

    // Vote count should still be 1
    const proposal = await reachToken.getProposal(1);
    expect(proposal.voteCount).to.equal(1);
  });

  it("Should require token ownership to vote", async function () {
    await reachToken.connect(owner).createProposal("Test Token Requirement");

    // Create a new account with no tokens
    const [, , , , noTokenAccount] = await ethers.getSigners();

    await expect(
      reachToken.connect(noTokenAccount).vote(1)
    ).to.be.revertedWith("Must hold tokens to vote");
  });

  it("Should not allow voting on expired proposals", async function () {
    await reachToken.connect(owner).createProposal("Test Expiry");

    // Fast forward past voting period
    const votingPeriod = await reachToken.VOTING_PERIOD();
    await ethers.provider.send("evm_increaseTime", [votingPeriod.toNumber() + 1]);
    await ethers.provider.send("evm_mine");

    await expect(
      reachToken.connect(voter1).vote(1)
    ).to.be.revertedWith("Voting period ended");
  });

  it("Should handle multiple proposals correctly", async function () {
    // Create multiple proposals
    await reachToken.connect(owner).createProposal("Proposal 1");
    await reachToken.connect(owner).createProposal("Proposal 2");

    expect(await reachToken.proposalCount()).to.equal(2);

    // Vote on different proposals
    await reachToken.connect(voter1).vote(1);
    await reachToken.connect(voter1).vote(2); // Same voter can vote on different proposals
    await reachToken.connect(voter2).vote(1);

    // Check vote counts
    const proposal1 = await reachToken.getProposal(1);
    const proposal2 = await reachToken.getProposal(2);

    expect(proposal1.voteCount).to.equal(2); // voter1 and voter2
    expect(proposal2.voteCount).to.equal(1); // only voter1
  });

  it("Should not allow voting on non-existent proposals", async function () {
    await expect(
      reachToken.connect(voter1).vote(999)
    ).to.be.revertedWith("Invalid proposal ID");
  });

  it("Should correctly track voting status", async function () {
    await reachToken.connect(owner).createProposal("Test Voting Status");

    // Initially no one has voted
    expect(await reachToken.hasVoted(1, voter1.address)).to.equal(false);
    expect(await reachToken.hasVoted(1, voter2.address)).to.equal(false);

    // After voter1 votes
    await reachToken.connect(voter1).vote(1);
    expect(await reachToken.hasVoted(1, voter1.address)).to.equal(true);
    expect(await reachToken.hasVoted(1, voter2.address)).to.equal(false);

    // After voter2 votes
    await reachToken.connect(voter2).vote(1);
    expect(await reachToken.hasVoted(1, voter1.address)).to.equal(true);
    expect(await reachToken.hasVoted(1, voter2.address)).to.equal(true);
  });

  it("Should respect pause state for voting", async function () {
    await reachToken.connect(owner).createProposal("Test Pause Respect");

    // Pause the contract
    await reachToken.connect(owner).pause();

    // Voting should be blocked when paused
    await expect(
      reachToken.connect(voter1).vote(1)
    ).to.be.revertedWith("Contract paused");

    // Unpause and try again
    await reachToken.connect(owner).unpause();

    // Should work after unpause
    await expect(
      reachToken.connect(voter1).vote(1)
    ).to.emit(reachToken, "VoteCast")
      .withArgs(voter1.address, 1, 1);
  });
});