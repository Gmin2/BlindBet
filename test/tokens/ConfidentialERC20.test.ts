import { ConfidentialUSDC, ConfidentialUSDC__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const [deployer] = await ethers.getSigners();
  const factory = (await ethers.getContractFactory("ConfidentialUSDC")) as ConfidentialUSDC__factory;
  const token = (await factory.deploy(deployer.address)) as ConfidentialUSDC;
  const tokenAddress = await token.getAddress();

  return { token, tokenAddress };
}

describe("ConfidentialERC20", function () {
  let signers: Signers;
  let token: ConfidentialUSDC;
  let tokenAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      carol: ethSigners[3],
    };
  });

  beforeEach(async () => {
    ({ token, tokenAddress } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should deploy with correct name", async function () {
      const name = await token.name();
      expect(name).to.equal("Confidential USDC");
    });

    it("should deploy with correct symbol", async function () {
      const symbol = await token.symbol();
      expect(symbol).to.equal("cUSDC");
    });

    it("should have 6 decimals", async function () {
      const decimals = await token.decimals();
      expect(decimals).to.equal(6);
    });

    it("should initialize with zero total supply for non-owner", async function () {
      const totalSupply = await token.totalSupply();
      // Total supply is encrypted, we just check it's initialized
      expect(totalSupply).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Minting", function () {
    it("should mint tokens to address", async function () {
      const mintAmount = 1000n * 10n ** 6n; // 1000 cUSDC

      const tx = await token.mockMint(signers.alice.address, mintAmount);
      await tx.wait();

      const encryptedBalance = await token.balanceOf(signers.alice.address);
      expect(encryptedBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should allow user to decrypt their balance after mint", async function () {
      const mintAmount = 1000n * 10n ** 6n;

      await token.mockMint(signers.alice.address, mintAmount);

      const encryptedBalance = await token.balanceOf(signers.alice.address);
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        tokenAddress,
        signers.alice
      );

      expect(decryptedBalance).to.equal(mintAmount);
    });

    it("should emit Transfer event", async function () {
      const mintAmount = 1000n * 10n ** 6n;

      await expect(token.mockMint(signers.alice.address, mintAmount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, signers.alice.address);
    });

    it("should emit Mint event", async function () {
      const mintAmount = 1000n * 10n ** 6n;

      await expect(token.mockMint(signers.alice.address, mintAmount))
        .to.emit(token, "Mint")
        .withArgs(signers.alice.address, mintAmount);
    });
  });

  describe("Transfer", function () {
    const initialAmount = 1000n * 10n ** 6n;

    beforeEach(async function () {
      // Mint tokens to Alice
      await token.mockMint(signers.alice.address, initialAmount);
    });

    it("should transfer tokens between accounts", async function () {
      const transferAmount = 100n * 10n ** 6n;

      // Get Alice's balance
      const aliceBalanceBefore = await token.balanceOf(signers.alice.address);

      // Create encrypted transfer amount
      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // Transfer
      const tx = await token
        .connect(signers.alice)
        .transfer(signers.bob.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await tx.wait();

      // Verify Bob received tokens
      const bobBalance = await token.balanceOf(signers.bob.address);
      const decryptedBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        tokenAddress,
        signers.bob
      );

      expect(decryptedBobBalance).to.equal(transferAmount);
    });

    it("should emit Transfer event", async function () {
      const transferAmount = 100n * 10n ** 6n;

      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await expect(
        token.connect(signers.alice).transfer(signers.bob.address, encryptedAmount.handles[0], encryptedAmount.inputProof)
      )
        .to.emit(token, "Transfer")
        .withArgs(signers.alice.address, signers.bob.address);
    });

    it("should handle insufficient balance silently (no revert)", async function () {
      const transferAmount = initialAmount + 1000n * 10n ** 6n; // More than balance

      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // This should not revert, but transfer 0
      const tx = await token
        .connect(signers.alice)
        .transfer(signers.bob.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
      await tx.wait();

      // Verify Bob received 0 tokens
      const bobBalance = await token.balanceOf(signers.bob.address);
      const decryptedBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        tokenAddress,
        signers.bob
      );

      expect(decryptedBobBalance).to.equal(0);
    });
  });

  describe("Approve", function () {
    const initialAmount = 1000n * 10n ** 6n;

    beforeEach(async function () {
      await token.mockMint(signers.alice.address, initialAmount);
    });

    it("should set allowance", async function () {
      const approveAmount = 500n * 10n ** 6n;

      const encryptedApprove = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(approveAmount)
        .encrypt();

      const tx = await token
        .connect(signers.alice)
        .approve(signers.bob.address, encryptedApprove.handles[0], encryptedApprove.inputProof);
      await tx.wait();

      const allowance = await token.allowance(signers.alice.address, signers.bob.address);
      expect(allowance).to.not.equal(ethers.ZeroHash);
    });

    it("should emit Approval event", async function () {
      const approveAmount = 500n * 10n ** 6n;

      const encryptedApprove = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(approveAmount)
        .encrypt();

      await expect(
        token
          .connect(signers.alice)
          .approve(signers.bob.address, encryptedApprove.handles[0], encryptedApprove.inputProof)
      )
        .to.emit(token, "Approval")
        .withArgs(signers.alice.address, signers.bob.address);
    });

    it("should allow spender to view allowance", async function () {
      const approveAmount = 500n * 10n ** 6n;

      const encryptedApprove = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(approveAmount)
        .encrypt();

      await token
        .connect(signers.alice)
        .approve(signers.bob.address, encryptedApprove.handles[0], encryptedApprove.inputProof);

      const allowance = await token.allowance(signers.alice.address, signers.bob.address);
      const decryptedAllowance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        allowance,
        tokenAddress,
        signers.bob
      );

      expect(decryptedAllowance).to.equal(approveAmount);
    });
  });

  describe("TransferFrom", function () {
    const initialAmount = 1000n * 10n ** 6n;
    const approveAmount = 500n * 10n ** 6n;

    beforeEach(async function () {
      // Mint to Alice
      await token.mockMint(signers.alice.address, initialAmount);

      // Alice approves Bob
      const encryptedApprove = await fhevm
        .createEncryptedInput(tokenAddress, signers.alice.address)
        .add64(approveAmount)
        .encrypt();

      await token
        .connect(signers.alice)
        .approve(signers.bob.address, encryptedApprove.handles[0], encryptedApprove.inputProof);
    });

    it("should transfer with valid allowance", async function () {
      const transferAmount = 100n * 10n ** 6n;

      // Bob transfers from Alice to Carol
      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      const tx = await token
        .connect(signers.bob)
        .transferFrom(
          signers.alice.address,
          signers.carol.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );
      await tx.wait();

      // Verify Carol received tokens
      const carolBalance = await token.balanceOf(signers.carol.address);
      const decryptedCarolBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolBalance,
        tokenAddress,
        signers.carol
      );

      expect(decryptedCarolBalance).to.equal(transferAmount);
    });

    it("should reduce allowance after transfer", async function () {
      const transferAmount = 100n * 10n ** 6n;

      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await token
        .connect(signers.bob)
        .transferFrom(
          signers.alice.address,
          signers.carol.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );

      const allowance = await token.allowance(signers.alice.address, signers.bob.address);
      const decryptedAllowance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        allowance,
        tokenAddress,
        signers.bob
      );

      expect(decryptedAllowance).to.equal(approveAmount - transferAmount);
    });

    it("should handle insufficient allowance silently", async function () {
      const transferAmount = approveAmount + 100n * 10n ** 6n; // More than approved

      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      // Should not revert
      const tx = await token
        .connect(signers.bob)
        .transferFrom(
          signers.alice.address,
          signers.carol.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );
      await tx.wait();

      // Carol should have 0
      const carolBalance = await token.balanceOf(signers.carol.address);
      const decryptedCarolBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolBalance,
        tokenAddress,
        signers.carol
      );

      expect(decryptedCarolBalance).to.equal(0);
    });

    it("should emit Transfer event", async function () {
      const transferAmount = 100n * 10n ** 6n;

      const encryptedAmount = await fhevm
        .createEncryptedInput(tokenAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await expect(
        token
          .connect(signers.bob)
          .transferFrom(
            signers.alice.address,
            signers.carol.address,
            encryptedAmount.handles[0],
            encryptedAmount.inputProof
          )
      )
        .to.emit(token, "Transfer")
        .withArgs(signers.alice.address, signers.carol.address);
    });
  });

  describe("Balance Queries", function () {
    it("should return encrypted balance", async function () {
      const mintAmount = 1000n * 10n ** 6n;
      await token.mockMint(signers.alice.address, mintAmount);

      const balance = await token.balanceOf(signers.alice.address);
      expect(balance).to.not.equal(ethers.ZeroHash);
    });

    it("should allow user to decrypt their balance", async function () {
      const mintAmount = 1000n * 10n ** 6n;
      await token.mockMint(signers.alice.address, mintAmount);

      const balance = await token.balanceOf(signers.alice.address);
      const decrypted = await fhevm.userDecryptEuint(FhevmType.euint64, balance, tokenAddress, signers.alice);

      expect(decrypted).to.equal(mintAmount);
    });
  });

  describe("ConfidentialUSDC Specific", function () {
    it("should have correct initial supply holder", async function () {
      const holder = await token.initialSupplyHolder();
      expect(holder).to.equal(signers.deployer.address); // Deployed with deployer address
    });

    it("should allow anyone to mock mint", async function () {
      const mintAmount = 5000n * 10n ** 6n;

      const tx = await token.connect(signers.bob).mockMint(signers.carol.address, mintAmount);
      await tx.wait();

      const balance = await token.balanceOf(signers.carol.address);
      const decrypted = await fhevm.userDecryptEuint(FhevmType.euint64, balance, tokenAddress, signers.carol);

      expect(decrypted).to.equal(mintAmount);
    });
  });
});
