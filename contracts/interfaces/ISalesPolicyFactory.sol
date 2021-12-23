// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.0;

interface ISalesPolicyFactory {
    function getProtocolData(uint16 _protocolIdx)
        external
        view
        returns (
            string memory protocolName,
            string memory productType,
            address protocolAddress
        );

    // function newSalesPolicy(
    //     uint16 _protocolIdx,
    //     address _exchangeAgent,
    //     address _premiumPool,
    //     address _capitalAgent,
    //     string memory _protocolURI
    // ) external returns (address);
}
