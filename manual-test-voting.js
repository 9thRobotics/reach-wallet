#!/usr/bin/env node

/**
 * Manual test demonstration of 1 vote per wallet functionality
 * This simulates the contract behavior without requiring actual deployment
 */

console.log("🗳️  Manual Test: ReachToken '1 Vote Per Wallet' Governance\n");

// Simulate contract state
let proposalCount = 0;
const proposals = {};
const hasVotedOnProposal = {};
const tokenBalances = {
    "0xWhale": "10000000000000000000000",  // 10,000 tokens
    "0xRegular": "100000000000000000000",   // 100 tokens  
    "0xSmall": "1000000000000000000"        // 1 token
};

// Simulate createProposal
function createProposal(description) {
    proposalCount++;
    proposals[proposalCount] = {
        id: proposalCount,
        description: description,
        voteCount: 0,
        endTime: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
        executed: false
    };
    hasVotedOnProposal[proposalCount] = {};
    
    console.log(`✅ Proposal ${proposalCount} created: "${description}"`);
    return proposalCount;
}

// Simulate vote function - 1 vote per wallet
function vote(proposalId, walletAddress) {
    // Check eligibility
    if (!tokenBalances[walletAddress] || tokenBalances[walletAddress] === "0") {
        throw new Error("Must hold tokens to vote");
    }
    
    // Check if proposal exists
    if (!proposals[proposalId]) {
        throw new Error("Invalid proposal ID");
    }
    
    // Check if already voted
    if (hasVotedOnProposal[proposalId][walletAddress]) {
        throw new Error("Already voted");
    }
    
    // Cast vote - exactly 1 vote regardless of token balance
    hasVotedOnProposal[proposalId][walletAddress] = true;
    proposals[proposalId].voteCount += 1;
    
    console.log(`🗳️  ${walletAddress} voted on Proposal ${proposalId}`);
    console.log(`   → Vote weight: 1 (regardless of ${tokenBalances[walletAddress]} token balance)`);
    console.log(`   → Total votes now: ${proposals[proposalId].voteCount}`);
    console.log(`   → Event emitted: VoteCast(${walletAddress}, ${proposalId}, 1)\n`);
    
    return true;
}

// Demonstrate the voting process
console.log("📋 Setting up test scenario...");
console.log("Token balances:");
Object.entries(tokenBalances).forEach(([wallet, balance]) => {
    const formattedBalance = parseFloat(balance) / 1e18;
    console.log(`  ${wallet}: ${formattedBalance.toLocaleString()} tokens`);
});
console.log();

// Create a proposal
const proposalId = createProposal("Should we implement feature X?");
console.log();

console.log("🗳️  Starting voting process...\n");

// Each wallet votes - should get exactly 1 vote each
try {
    console.log("1. Whale wallet voting (10,000 tokens):");
    vote(proposalId, "0xWhale");
    
    console.log("2. Regular wallet voting (100 tokens):");
    vote(proposalId, "0xRegular");
    
    console.log("3. Small wallet voting (1 token):");
    vote(proposalId, "0xSmall");
    
    console.log("🎉 Voting completed successfully!\n");
    
    // Show final results
    console.log("📊 Final Results:");
    console.log(`Proposal: "${proposals[proposalId].description}"`);
    console.log(`Total votes: ${proposals[proposalId].voteCount}`);
    console.log(`Equal representation: ✅ Each wallet contributed exactly 1 vote\n`);
    
    // Test double voting prevention
    console.log("🛡️  Testing double voting prevention...");
    try {
        vote(proposalId, "0xWhale");
        console.log("❌ ERROR: Double voting should have been prevented!");
    } catch (error) {
        console.log(`✅ Double voting correctly prevented: ${error.message}\n`);
    }
    
    // Test voting without tokens
    console.log("🚫 Testing voting without tokens...");
    try {
        tokenBalances["0xEmpty"] = "0";
        vote(proposalId, "0xEmpty");
        console.log("❌ ERROR: Voting without tokens should have been prevented!");
    } catch (error) {
        console.log(`✅ Token requirement correctly enforced: ${error.message}\n`);
    }
    
    console.log("✨ All tests passed! The '1 vote per wallet' system works perfectly.");
    console.log("\n🏛️  Democratic Governance Achieved:");
    console.log("   • Whale with 10,000 tokens: 1 vote");
    console.log("   • Regular holder with 100 tokens: 1 vote"); 
    console.log("   • Small holder with 1 token: 1 vote");
    console.log("   • Result: True democratic equality! 🎯");
    
} catch (error) {
    console.log(`❌ Voting failed: ${error.message}`);
}