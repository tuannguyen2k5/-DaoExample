// SPDX-License-Identifier: BSD-3-Clause

pragma solidity ^0.8.6;

import "./DAOExampleInterfaces.sol";
import "hardhat/console.sol";

contract DAOExampleLogicV1 is DAOExampleStorageV1, DAOExampleEvents {
    address public vetoer;
    uint256 public votingDelay;
    uint256 public votingPeriod;
    uint256 public proposalThresholdBPS;
    uint256 public quorumVotesBPS;
    uint256 public constant MIN_VOTING_PERIOD = 5_760; // About 24 hours
    uint256 public constant MAX_VOTING_PERIOD = 80_640; // About 2 weeks
    uint256 public constant MIN_VOTING_DELAY = 1;
    uint256 public constant MAX_VOTING_DELAY = 40_320;
    uint256 public constant MIN_PROPOSAL_THRESHOLD_BPS = 1; // 1 basis point or 0.01%
    uint256 public constant MAX_PROPOSAL_THRESHOLD_BPS = 1_000; // 1,
    uint256 public constant MIN_QUORUM_VOTES_BPS = 200; // 200 basis points or 2%
    uint256 public constant MAX_QUORUM_VOTES_BPS = 2_000; // 2,000 basis points or 20%
    uint256 public constant proposalMaxOperations = 10; // 10 actions

    DAOTokenLike public nouns;

    function initialize(
        address timelock_,
        address nouns_,
        address vetoer_,
        uint256 votingPeriod_,
        uint256 votingDelay_,
        uint256 proposalThresholdBPS_,
        uint256 quorumVotesBPS_
    ) public virtual {
        require(
            address(timelock) == address(0),
            "DAOExample::initialize: can only initialize once"
        );
        // require(msg.sender == admin, 'DAOExample::initialize: admin only');
        require(
            timelock_ != address(0),
            "DAOExample::initialize: invalid timelock address"
        );
        require(
            nouns_ != address(0),
            "DAOExample::initialize: invalid nouns address"
        );
        require(
            votingPeriod_ >= MIN_VOTING_PERIOD &&
                votingPeriod_ <= MAX_VOTING_PERIOD,
            "DAOExample::initialize: invalid voting period"
        );
        require(
            votingDelay_ >= MIN_VOTING_DELAY &&
                votingDelay_ <= MAX_VOTING_DELAY,
            "DAOExample::initialize: invalid voting delay"
        );
        require(
            proposalThresholdBPS_ >= MIN_PROPOSAL_THRESHOLD_BPS &&
                proposalThresholdBPS_ <= MAX_PROPOSAL_THRESHOLD_BPS,
            "DAOExample::initialize: invalid proposal threshold"
        );
        require(
            quorumVotesBPS_ >= MIN_QUORUM_VOTES_BPS &&
                quorumVotesBPS_ <= MAX_QUORUM_VOTES_BPS,
            "DAOExample::initialize: invalid proposal threshold"
        );

        emit VotingPeriodSet(votingPeriod, votingPeriod_);
        emit VotingDelaySet(votingDelay, votingDelay_);
        emit ProposalThresholdBPSSet(proposalThresholdBPS, proposalThresholdBPS_);
        emit QuorumVotesBPSSet(quorumVotesBPS, quorumVotesBPS_);

        timelock = IDAOExampleExecutor(timelock_);
        nouns = DAOTokenLike(nouns_);
        vetoer = vetoer_;
        votingPeriod = votingPeriod_;
        votingDelay = votingDelay_;
        proposalThresholdBPS = proposalThresholdBPS_;
        quorumVotesBPS = quorumVotesBPS_;
    }

    struct ProposalTemp {
        uint256 totalSupply;
        uint256 proposalThreshold;
        uint256 latestProposalId;
        uint256 startBlock;
        uint256 endBlock;
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        ProposalTemp memory temp;

        temp.proposalThreshold = proposalThresholdBPS;

        require(
            nouns.getPriorVotes(msg.sender, block.number - 1) > temp.proposalThreshold,
            'DAO Token::propose: proposer votes below proposal threshold'
        );
        require(
            targets.length == values.length &&
                targets.length == signatures.length &&
                targets.length == calldatas.length,
            "DAO Token::propose: proposal function information arity mismatch"
        );
        require(targets.length != 0, "DAO Token::propose: must provide actions");
        require(
            targets.length <= proposalMaxOperations,
            "DAO Token::propose: too many actions"
        );

        temp.latestProposalId = latestProposalIds[msg.sender];
        if (temp.latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(
                temp.latestProposalId
            );
            require(
                proposersLatestProposalState != ProposalState.Active,
                "DAO Token::propose: one live proposal per proposer, found an already active proposal"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "DAO Token::propose: one live proposal per proposer, found an already pending proposal"
            );
        }

        temp.startBlock = block.number + votingDelay;
        temp.endBlock = temp.startBlock + votingPeriod;

        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];

        newProposal.id = proposalCount;
        newProposal.proposer = msg.sender;
        newProposal.proposalThreshold = temp.proposalThreshold;
        newProposal.quorumVotes = quorumVotesBPS;
        newProposal.eta = 0;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.signatures = signatures;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = temp.startBlock;
        newProposal.endBlock = temp.endBlock;
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        newProposal.abstainVotes = 0;
        newProposal.canceled = false;
        newProposal.executed = false;
        newProposal.vetoed = false;

        latestProposalIds[newProposal.proposer] = newProposal.id;
        emit ProposalCreated(
            newProposal.id,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            newProposal.startBlock,
            newProposal.endBlock,
            description
        );
        return newProposal.id;
    }

     function queue(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Succeeded,
            'DAO Token::queue: proposal can only be queued if it is succeeded'
        );
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp + timelock.delay();
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            queueOrRevertInternal(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        proposal.eta = eta;
        emit ProposalQueued(proposalId, eta);
    }

    function queueOrRevertInternal(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !timelock.queuedTransactions(keccak256(abi.encode(target, value, signature, data, eta))),
            'DAO Token::queueOrRevertInternal: identical proposal action already queued at eta'
        );
        timelock.queueTransaction(target, value, signature, data, eta);
    }

    /**
     * @notice Executes a queued proposal if eta has passed
     * @param proposalId The id of the proposal to execute
     */
    function execute(uint256 proposalId) external {
        require(
            state(proposalId) == ProposalState.Queued,
            'DAO Token::execute: proposal can only be executed if it is queued'
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancels a proposal only if sender is the proposer, or proposer delegates dropped below proposal threshold
     * @param proposalId The id of the proposal to cancel
     */
    function cancel(uint256 proposalId) external {
        require(state(proposalId) != ProposalState.Executed, 'DAO Token::cancel: cannot cancel executed proposal');

        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer ||
                nouns.getPriorVotes(proposal.proposer, block.number - 1) < proposal.proposalThreshold,
            'DAO Token::cancel: proposer above threshold'
        );

        proposal.canceled = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.cancelTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalCanceled(proposalId);
    }

    /**
     * @notice Vetoes a proposal only if sender is the vetoer and the proposal has not been executed.
     * @param proposalId The id of the proposal to veto
     */
    function veto(uint256 proposalId) external {
        require(vetoer != address(0), 'NounsDAO::veto: veto power burned');
        require(msg.sender == vetoer, 'NounsDAO::veto: only vetoer');
        require(state(proposalId) != ProposalState.Executed, 'NounsDAO::veto: cannot veto executed proposal');

        Proposal storage proposal = proposals[proposalId];

        proposal.vetoed = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.cancelTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalVetoed(proposalId);
    }

    /**
     * @notice Cast a vote for a proposal
     * @param proposalId The id of the proposal to vote on
     * @param support The support value for the vote. 0=against, 1=for, 2=abstain
     */
    function castVote(uint256 proposalId, uint8 support) external {
        emit VoteCast(msg.sender, proposalId, support, castVoteInternal(msg.sender, proposalId, support), '');
    }

    function castVoteInternal(
        address voter,
        uint256 proposalId,
        uint8 support
    ) internal returns (uint96) {
        
        require(state(proposalId) == ProposalState.Active, 'DAO Token::castVoteInternal: voting is closed');
        require(support <= 2, 'DAO Token::castVoteInternal: invalid vote type');
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        require(receipt.hasVoted == false, 'DAO Token::castVoteInternal: voter already voted');

        /// @notice: Unlike GovernerBravo, votes are considered from the block the proposal was created in order to normalize quorumVotes and proposalThreshold metrics
        uint96 votes = nouns.getPriorVotes(voter, proposal.startBlock - votingDelay);

        if (support == 0) {
            proposal.againstVotes = proposal.againstVotes + votes;
        } else if (support == 1) {
            proposal.forVotes = proposal.forVotes + votes;
        } else if (support == 2) {
            proposal.abstainVotes = proposal.abstainVotes + votes;
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        return votes;
    }
    
   function getActions(uint256 proposalId)
    external
    view
    returns (
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas
    )
{
    Proposal storage p = proposals[proposalId];
    return (p.targets, p.values, p.signatures, p.calldatas);
}
     /**
     * @notice Gets the receipt for a voter on a given proposal
     * @param proposalId the id of proposal
     * @param voter The address of the voter
     * @return The voting receipt
     */
    function getReceipt(uint256 proposalId, address voter) external view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

    /**
     * @notice Gets the state of a proposal
     * @param proposalId The id of the proposal
     * @return Proposal state
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(
            proposalCount >= proposalId,
            "DAO Token::state: invalid proposal id"
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.vetoed) {
            return ProposalState.Vetoed;
        } else if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (
            proposal.forVotes <= proposal.againstVotes ||
            proposal.forVotes < proposal.quorumVotes
        ) {
            return ProposalState.Defeated;
        } else if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= proposal.eta + timelock.GRACE_PERIOD()) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
    }

    function bps2Uint(
        uint256 bps,
        uint256 number
    ) internal pure returns (uint256) {
        return (number * bps) / 10000;
    }
}
