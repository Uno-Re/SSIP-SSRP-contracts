// SPDX-License-Identifier: agpl-3.0
pragma solidity =0.8.23;

interface IGovernance {
    enum ProposalState {
        Pending,
        Canceled,
        Active,
        Failed,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    /**
     * @dev Get the current state of a proposal
     * @param proposalId id of the proposal
     * @return The current state if the proposal
     **/
    function getProposalState(uint256 proposalId) external view returns (ProposalState);
}
