// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Disburser
/// @notice Minimal owner-gated payout contract for Chainvault loan disbursements.
///         The admin funds this contract with test ETH/BNB and test tokens, then
///         calls `disburse` / `disburseNative` when approving a loan.
///
///         DO NOT deploy to mainnet with real funds. This is a testnet-only demo.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Disburser {
    address public owner;
    address public pendingOwner;

    event Disbursed(address indexed token, address indexed to, uint256 amount, bytes32 indexed loanId);
    event NativeDisbursed(address indexed to, uint256 amount, bytes32 indexed loanId);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);
    event Funded(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    receive() external payable { emit Funded(msg.sender, msg.value); }
    fallback() external payable { emit Funded(msg.sender, msg.value); }

    /// @notice Send an ERC-20 (USDC, USDT, BUSD, ...) to a borrower.
    /// @param token   ERC-20 contract address
    /// @param to      recipient
    /// @param amount  raw token amount (respect the token's decimals)
    /// @param loanId  32-byte loan id from the app (any bytes32, purely for on-chain audit trail)
    function disburse(address token, address to, uint256 amount, bytes32 loanId) external onlyOwner {
        require(to != address(0), "bad recipient");
        require(IERC20(token).transfer(to, amount), "transfer failed");
        emit Disbursed(token, to, amount, loanId);
    }

    /// @notice Send the native asset (ETH / BNB) to a borrower.
    function disburseNative(address payable to, uint256 amount, bytes32 loanId) external onlyOwner {
        require(to != address(0), "bad recipient");
        require(address(this).balance >= amount, "insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send failed");
        emit NativeDisbursed(to, amount, loanId);
    }

    /// @notice Batch native disbursements (optional, cheaper for many payouts).
    function batchDisburse(address token, address[] calldata recipients, uint256[] calldata amounts, bytes32 loanId) external onlyOwner {
        require(recipients.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(IERC20(token).transfer(recipients[i], amounts[i]), "transfer failed");
            emit Disbursed(token, recipients[i], amounts[i], loanId);
        }
    }

    /// @notice Owner can pull remaining funds back out (test-token rescue).
    function sweep(address token, address to) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(to, bal), "transfer failed");
    }

    function sweepNative(address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "send failed");
    }

    // --- two-step ownership transfer ---
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
