// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    struct Candidate {
        string name;
        uint256 votes;
        bool isActive;
    }

    struct Voter {
        address voterAddress;
        string candidateVotedFor;
        uint256 timestamp;
        bytes32 verificationHash; // Hash of verification data (Aadhar + VoterID + Face Verification)
    }

    struct VoterVerification {
        string aadharNumber;
        string voterId;
        string mobileNumber;
        bool isVerified;
        uint256 lastVerificationTime;
    }

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    mapping(address => VoterVerification) public voterVerifications;
    address[] public voters;
    mapping(address => string) public voterChoices;
    Voter[] public voterList;

    address public admin;
    bool public votingEnabled;
    uint256 public verificationValidityPeriod; // Time period for which verification is valid

    event Voted(address indexed voter, string candidate, bytes32 verificationHash);
    event VoterVerified(address indexed voter, string aadharNumber, string voterId);
    event VotingStatusChanged(bool enabled);
    event CandidateStatusChanged(uint256 indexed candidateId, bool isActive);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier votingIsEnabled() {
        require(votingEnabled, "Voting is currently disabled");
        _;
    }

    constructor() {
        admin = msg.sender;
        votingEnabled = true;
        verificationValidityPeriod = 24 hours;

        // Initialize candidates
        candidates[0] = Candidate("A", 0, true);
        candidates[1] = Candidate("B", 0, true);
        candidates[2] = Candidate("C", 0, true);
    }

    function verifyVoter(
        string memory aadharNumber,
        string memory voterId,
        string memory mobileNumber
    ) external onlyAdmin {
        voterVerifications[msg.sender] = VoterVerification({
            aadharNumber: aadharNumber,
            voterId: voterId,
            mobileNumber: mobileNumber,
            isVerified: true,
            lastVerificationTime: block.timestamp
        });

        emit VoterVerified(msg.sender, aadharNumber, voterId);
    }

    function vote(
        uint256 candidateIndex,
        bytes32 verificationHash
    ) external votingIsEnabled {
        require(candidateIndex < 3, "Invalid candidate");
        require(!hasVoted[msg.sender], "Already voted");
        require(candidates[candidateIndex].isActive, "Candidate is not active");
        
        VoterVerification memory verification = voterVerifications[msg.sender];
        require(verification.isVerified, "Voter not verified");
        require(
            block.timestamp <= verification.lastVerificationTime + verificationValidityPeriod,
            "Verification expired"
        );

        candidates[candidateIndex].votes += 1;
        hasVoted[msg.sender] = true;
        voters.push(msg.sender);
        voterChoices[msg.sender] = candidates[candidateIndex].name;
        voterList.push(Voter({
            voterAddress: msg.sender,
            candidateVotedFor: candidates[candidateIndex].name,
            timestamp: block.timestamp,
            verificationHash: verificationHash
        }));

        emit Voted(msg.sender, candidates[candidateIndex].name, verificationHash);
    }

    function getVotes() external view returns (Candidate[] memory, address[] memory) {
        Candidate[] memory candidateList = new Candidate[](3);
        for (uint256 i = 0; i < 3; i++) {
            candidateList[i] = candidates[i];
        }
        return (candidateList, voters);
    }

    function setVotingStatus(bool _enabled) external onlyAdmin {
        votingEnabled = _enabled;
        emit VotingStatusChanged(_enabled);
    }

    function setCandidateStatus(uint256 candidateId, bool isActive) external onlyAdmin {
        require(candidateId < 3, "Invalid candidate");
        candidates[candidateId].isActive = isActive;
        emit CandidateStatusChanged(candidateId, isActive);
    }

    function setVerificationValidityPeriod(uint256 _period) external onlyAdmin {
        verificationValidityPeriod = _period;
    }

    function getVoterVerification(address voter) external view returns (VoterVerification memory) {
        return voterVerifications[voter];
    }
}

