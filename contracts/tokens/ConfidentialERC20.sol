// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialERC20} from "../interfaces/IConfidentialERC20.sol";

/**
 * @title ConfidentialERC20
 * @notice Base implementation of confidential ERC20 token using FHE
 * @dev All balances and allowances are encrypted using euint64
 */
contract ConfidentialERC20 is SepoliaConfig, IConfidentialERC20 {

    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 6;

    /// @notice Encrypted balances
    mapping(address => euint64) internal balances;

    /// @notice Encrypted allowances: owner => spender => amount
    mapping(address => mapping(address => euint64)) internal allowances;

    /// @notice Encrypted total supply
    euint64 public totalSupply;

    /**
     * @notice Initialize the token
     * @param name_ Token name
     * @param symbol_ Token symbol
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;

        // Initialize total supply to 0
        totalSupply = FHE.asEuint64(0);
        FHE.allowThis(totalSupply);
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function name() external view override returns (string memory) {
        return _name;
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function decimals() external pure override returns (uint8) {
        return _decimals;
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function balanceOf(address account)
        external
        view
        override
        returns (euint64)
    {
        return balances[account];
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function allowance(address owner, address spender)
        external
        view
        override
        returns (euint64)
    {
        return allowances[owner][spender];
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function transfer(address to, euint64 amount)
        external
        override
        returns (bool)
    {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function transferFrom(address from, address to, euint64 amount)
        external
        override
        returns (bool)
    {
        // Check and update allowance
        _spendAllowance(from, msg.sender, amount);

        // Execute transfer
        _transfer(from, to, amount);

        return true;
    }

    /**
     * @inheritdoc IConfidentialERC20
     */
    function approve(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override {
        if (spender == address(0)) revert InvalidAddress();

        // Convert external encrypted input to internal encrypted value
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Set allowance
        allowances[msg.sender][spender] = amount;

        // Set ACL permissions
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allow(amount, spender);

        emit Approval(msg.sender, spender);
    }

    /**
     * @notice Internal transfer function
     * @param from Sender address
     * @param to Recipient address
     * @param amount Encrypted amount to transfer
     */
    function _transfer(address from, address to, euint64 amount) internal {
        if (from == address(0)) revert InvalidAddress();
        if (to == address(0)) revert InvalidAddress();

        // Grant contract permission to use the amount
        FHE.allowThis(amount);

        // Check if sender has sufficient balance
        ebool canTransfer = FHE.le(amount, balances[from]);

        // Calculate actual transfer amount (0 if insufficient balance)
        euint64 transferAmount = FHE.select(
            canTransfer,
            amount,
            FHE.asEuint64(0)
        );

        // Update balances
        // Sender: subtract transfer amount
        balances[from] = FHE.sub(balances[from], transferAmount);
        FHE.allowThis(balances[from]);
        FHE.allow(balances[from], from);

        // Recipient: add transfer amount
        balances[to] = FHE.add(balances[to], transferAmount);
        FHE.allowThis(balances[to]);
        FHE.allow(balances[to], to);

        emit Transfer(from, to);
    }

    /**
     * @notice Spend allowance
     * @param owner Token owner
     * @param spender Spender address
     * @param amount Amount to spend
     */
    function _spendAllowance(
        address owner,
        address spender,
        euint64 amount
    ) internal {
        euint64 currentAllowance = allowances[owner][spender];

        // Check if allowance is sufficient
        ebool isAllowed = FHE.le(amount, currentAllowance);

        // Calculate new allowance (unchanged if insufficient)
        euint64 newAllowance = FHE.select(
            isAllowed,
            FHE.sub(currentAllowance, amount),
            currentAllowance
        );

        // Update allowance
        allowances[owner][spender] = newAllowance;
        FHE.allowThis(newAllowance);
        FHE.allow(newAllowance, owner);
        FHE.allow(newAllowance, spender);
    }

    /**
     * @notice Mint tokens (internal)
     * @param to Recipient address
     * @param amount Amount to mint (encrypted)
     */
    function _mint(address to, euint64 amount) internal {
        if (to == address(0)) revert InvalidAddress();

        // Update balance
        balances[to] = FHE.add(balances[to], amount);
        FHE.allowThis(balances[to]);
        FHE.allow(balances[to], to);

        // Update total supply
        totalSupply = FHE.add(totalSupply, amount);
        FHE.allowThis(totalSupply);

        emit Transfer(address(0), to);
    }

    /**
     * @notice Burn tokens (internal)
     * @param from Address to burn from
     * @param amount Amount to burn (encrypted)
     */
    function _burn(address from, euint64 amount) internal {
        if (from == address(0)) revert InvalidAddress();

        // Check if balance is sufficient
        ebool canBurn = FHE.le(amount, balances[from]);

        // Calculate actual burn amount
        euint64 burnAmount = FHE.select(
            canBurn,
            amount,
            FHE.asEuint64(0)
        );

        // Update balance
        balances[from] = FHE.sub(balances[from], burnAmount);
        FHE.allowThis(balances[from]);
        FHE.allow(balances[from], from);

        // Update total supply
        totalSupply = FHE.sub(totalSupply, burnAmount);
        FHE.allowThis(totalSupply);

        emit Transfer(from, address(0));
    }

    /**
     * @inheritdoc IConfidentialERC20
     * @dev This function should only be available in test/development environments
     */
    function mockMint(address to, uint64 amount) external override {
        if (to == address(0)) revert InvalidAddress();

        // Convert plaintext amount to encrypted
        euint64 encryptedAmount = FHE.asEuint64(amount);

        // Mint tokens
        _mint(to, encryptedAmount);

        emit Mint(to, amount);
    }
}
