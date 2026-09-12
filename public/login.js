document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent page reload

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
        if (data.user) localStorage.setItem('civicUser', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('civicToken', data.token);
        window.location.href = data.redirectUrl || '/dashboard.html';
    } else {
        const errorMsg = document.getElementById('errorMessage');
        if (errorMsg) {
            errorMsg.textContent = data.message || data.error || 'Login failed';
            errorMsg.style.display = 'block';
        }
    }
});