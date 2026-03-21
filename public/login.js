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
        // If login is successful, send them to the map page!
        window.location.href = '/map.html';
    } else {
        const errorMsg = document.getElementById('errorMessage');
        errorMsg.textContent = data.message;
        errorMsg.style.display = 'block';
    }
});s