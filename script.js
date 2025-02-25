document.addEventListener('DOMContentLoaded', () => {
    const Telegram = window.Telegram;
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    const connectWalletBtn = document.getElementById('connectWallet');
    const checkCreditsBtn = document.getElementById('checkCredits');
    const buyCreditsBtn = document.getElementById('buyCredits');
    const pastGenerationsBtn = document.getElementById('pastGenerations');
    const generateVideoBtn = document.getElementById('generateVideo');
    const disconnectBtn = document.getElementById('disconnect');
    const feedback = document.getElementById('feedback');

    let wallet = null;

    function updateUI() {
        if (wallet) {
            connectWalletBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
        } else {
            connectWalletBtn.style.display = 'block';
            disconnectBtn.style.display = 'none';
        }
    }

    function showFeedback(message) {
        feedback.textContent = message;
        feedback.style.color = '#e0e0e0';
    }

    function showError(message) {
        feedback.textContent = message;
        feedback.style.color = '#ff4444';
    }

    async function apiCall(endpoint, method = 'GET', data = null) {
        const url = `http://localhost:5000${endpoint}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 2000
        };
        if (data) options.body = JSON.stringify(data);
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            return await response.json();
        } catch (error) {
            showError(`*Error:* ${error.message}`);
            return null;
        }
    }

    connectWalletBtn.addEventListener('click', () => {
        showFeedback("*Connect your Phantom wallet by opening this link:* https://phantom.app/ul/connect?callback=https://your-bot-domain.com/callback");
        // Simulate wallet input (in real app, use Telegram Web App API for input)
        wallet = prompt("Enter your Solana public key:");
        if (wallet && PublicKey.fromString(wallet)) {
            const response = apiCall('/api/wallet/connect', 'POST', { wallet, signed_in: true });
            if (response?.success) {
                showFeedback("*Wallet connected:* " + wallet.substring(0, 6) + "..." + wallet.substring(wallet.length - 3));
                updateUI();
            } else {
                showError("*Failed to connect wallet.* Try again.");
            }
        } else {
            showError("*Invalid Solana public key.* Try again.");
        }
    });

    checkCreditsBtn.addEventListener('click', async () => {
        if (!wallet) {
            showError("*Please connect your wallet with Connect Wallet first.*");
            return;
        }
        const response = await apiCall(`/api/credits?wallet=${wallet}`);
        if (response) {
            showFeedback(`*You have ${response.credits} Bonecoin credits.*`);
        }
    });

    buyCreditsBtn.addEventListener('click', () => {
        if (!wallet) {
            showError("*Please connect your wallet with Connect Wallet first.*");
            return;
        }
        const amount = prompt("How many credits would you like a quote for? (1–25)");
        if (amount && !isNaN(amount) && amount >= 1 && amount <= 25) {
            const quote = await apiCall(`/api/credits/quote?wallet=${wallet}&amount=${amount}`, 'GET');
            if (quote) {
                const confirm = confirm(`*Quote:* ${amount} credits for ${quote.quote.toFixed(2)} Bonecoin (${quote.price_usd.toFixed(6)}/Bonecoin). Approve?`);
                if (confirm) {
                    const response = await apiCall('/api/credits/buy', 'POST', { wallet, amount });
                    if (response?.success) {
                        showFeedback(`*Bought ${amount} credits for ${response.quote.toFixed(2)} Bonecoin (${response.price_usd.toFixed(6)}/Bonecoin)!* New balance: ${response.new_credits}`);
                    } else {
                        showError("*Failed to buy credits.* Try again.");
                    }
                } else {
                    showFeedback("*Credit purchase canceled.*");
                }
            }
        } else {
            showError("*Please enter a number between 1 and 25.*");
        }
    });

    pastGenerationsBtn.addEventListener('click', async () => {
        if (!wallet) {
            showError("*Please connect your wallet with Connect Wallet first.*");
            return;
        }
        const response = await apiCall(`/api/generations?wallet=${wallet}&limit=3&offset=0`);
        if (response && response.length > 0) {
            let message = "*Past Generations:*\n";
            response.forEach(gen => message += `ID: ${gen.id}, Prompt: ${gen.prompt}\n`);
            showFeedback(message);
            response.forEach(gen => {
                const video = document.createElement('video');
                video.src = gen.video_url;
                video.controls = true;
                video.style.width = '100%';
                feedback.appendChild(video);
            });
            if (response.length === 3) {
                const moreBtn = document.createElement('button');
                moreBtn.textContent = "More";
                moreBtn.className = "button";
                moreBtn.addEventListener('click', () => loadMoreGenerations(3));
                feedback.appendChild(moreBtn);
            }
        } else {
            showError("*No past generations found.*");
        }
    });

    async function loadMoreGenerations(offset) {
        const response = await apiCall(`/api/generations?wallet=${wallet}&limit=3&offset=${offset}`);
        if (response && response.length > 0) {
            let message = "*Past Generations:*\n";
            response.forEach(gen => message += `ID: ${gen.id}, Prompt: ${gen.prompt}\n`);
            showFeedback(message);
            response.forEach(gen => {
                const video = document.createElement('video');
                video.src = gen.video_url;
                video.controls = true;
                video.style.width = '100%';
                feedback.appendChild(video);
            });
            if (response.length === 3) {
                const moreBtn = document.createElement('button');
                moreBtn.textContent = "More";
                moreBtn.className = "button";
                moreBtn.addEventListener('click', () => loadMoreGenerations(offset + 3));
                feedback.appendChild(moreBtn);
            }
        } else {
            showError("*No more past generations found.*");
        }
    }

    generateVideoBtn.addEventListener('click', async () => {
        if (!wallet) {
            showError("*Please connect your wallet with Connect Wallet first.*");
            return;
        }
        if (credits < 10) {
            showError("*Not enough credits!* Need at least 10. Use Buy Credits.");
            return;
        }
        const prompt = prompt("*Describe your video...*");
        if (prompt) {
            const response = await apiCall('/api/generate', 'POST', { wallet, prompt });
            if (response?.id) {
                showFeedback("*Generating... 30s remaining*");
                let timeLeft = 30;
                const interval = setInterval(() => {
                    timeLeft--;
                    showFeedback(`*Generating... ${timeLeft}s remaining*`);
                    if (timeLeft <= 0) {
                        clearInterval(interval);
                        const status = apiCall(`/api/generate/status?id=${response.id}`);
                        if (status?.status === "completed") {
                            const video = document.createElement('video');
                            video.src = status.video_url;
                            video.controls = true;
                            video.style.width = '100%';
                            feedback.innerHTML = "*Video generated!*\n";
                            feedback.appendChild(video);
                        } else {
                            showError("*Generation failed.*");
                        }
                    }
                }, 1000);
            } else {
                showError("*Failed to generate video.* Try again.");
            }
        }
    });

    disconnectBtn.addEventListener('click', async () => {
        if (!wallet) {
            showError("*No wallet connected to disconnect.*");
            return;
        }
        const response = await apiCall('/api/wallet/disconnect', 'POST', { wallet });
        if (response?.success) {
            wallet = null;
            showFeedback("*Wallet disconnected successfully.*");
            updateUI();
        } else {
            showError("*Failed to disconnect wallet.* Try again.");
        }
    });
});