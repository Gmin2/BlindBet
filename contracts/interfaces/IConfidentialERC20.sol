// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IConfidentialERC20
 * @notice Interface for confidential ERC20 tokens using FHE
 * @dev Balances and allowances are encrypted using euint64
 */
interface IConfidentialERC20 {

    /**
     * @notice Emitted when tokens are transferred
     * @dev Amount is not included as it's encrypted
     */
    event Transfer(address indexed from, address indexed to);

    /**
     * @notice Emitted when allowance is set
     * @dev Amount is not included as it's encrypted
     */
    event Approval(address indexed owner, address indexed spender);

    /**
     * @notice Emitted when tokens are minted (for testing)
     */
    event Mint(address indexed to, uint64 amount);

    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidAddress();
    error InvalidAmount();

    /**
     * @notice Returns the name of the token
     */
    function name() external view returns (string memory);

    /**
     * @notice Returns the symbol of the token
     */
    function symbol() external view returns (string memory);

    /**
     * @notice Returns the decimals of the token
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Returns the total supply (encrypted)
     */
    function totalSupply() external view returns (euint64);

    /**
     * @notice Returns the encrypted balance of an account
     * @param account The account to query
     * @return Encrypted balance
     */
    function balanceOf(address account) external view returns (euint64);

    /**
     * @notice Returns the encrypted allowance
     * @param owner The token owner
     * @param spender The approved spender
     * @return Encrypted allowance amount
     */
    function allowance(address owner, address spender)
        external
        view
        returns (euint64);

    /**
     * @notice Transfer encrypted amount to recipient
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount to transfer (externalEuint64)
     * @param inputProof The zero-knowledge proof for input verification
     * @return success Whether transfer was successful
     */
    function transfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    /**
     * @notice Transfer encrypted amount from one address to another
     * @param from Sender address
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount to transfer (externalEuint64)
     * @param inputProof The zero-knowledge proof for input verification
     * @return success Whether transfer was successful
     */
    function transferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    /**
     * @notice Approve encrypted amount for spender
     * @param spender The address to approve
     * @param encryptedAmount The encrypted amount to approve (externalEuint64)
     * @param inputProof The zero-knowledge proof for input verification
     */
    function approve(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external;

    /**
     * @notice Transfer existing encrypted amount (for contract-to-contract use)
     * @param to Recipient address
     * @param amount Existing encrypted amount
     * @return success Whether transfer was successful
     */
    function transferEncrypted(address to, euint64 amount) external returns (bool);

    /**
     * @notice Transfer existing encrypted amount from another address (for contract-to-contract use)
     * @param from Sender address
     * @param to Recipient address
     * @param amount Existing encrypted amount
     * @return success Whether transfer was successful
     */
    function transferFromEncrypted(address from, address to, euint64 amount) external returns (bool);

    /**
     * @notice Mock mint function for testing
     * @dev Should only be available in test environment
     * @param to Recipient address
     * @param amount Amount to mint (plaintext for testing)
     */
    function mockMint(address to, uint64 amount) external;
}
