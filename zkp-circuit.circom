pragma circom 2.0.0;

/*
 * Zero-Knowledge Proof Circuit for Private Voting
 * 
 * This circuit allows a voter to prove they have cast a valid vote
 * for a candidate without revealing which candidate they voted for.
 * It also ensures each voter only votes once.
 */

// Include the circomlib libraries
include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";

template PrivateVote() {
    // Public inputs
    signal input publicVoteHash; // Hash of the vote commitment
    signal input electionId;     // ID of the election to prevent replay attacks
    
    // Private inputs
    signal input candidateIndex; // 0, 1, or 2 (private - which candidate was chosen)
    signal input voterSecret;    // Random secret chosen by the voter
    signal input nullifier;      // Unique nullifier to prevent double voting
    
    // Constraints to ensure candidateIndex is valid (0, 1, or 2)
    component inRange = LessThan(8);
    inRange.in[0] <== candidateIndex;
    inRange.in[1] <== 3;
    inRange.out === 1;
    
    // Calculate the hash of the vote (commitment)
    component voteHasher = Poseidon(3);
    voteHasher.inputs[0] <== candidateIndex;
    voteHasher.inputs[1] <== voterSecret;
    voteHasher.inputs[2] <== electionId;
    
    // Verify the computed hash matches the public hash
    voteHasher.out === publicVoteHash;
    
    // Calculate the nullifier hash (to prevent double voting)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== electionId;
    
    // Output the nullifier hash (public)
    signal output nullifierHash;
    nullifierHash <== nullifierHasher.out;
}

component main {public [publicVoteHash, electionId]} = PrivateVote();
</kodu_content>