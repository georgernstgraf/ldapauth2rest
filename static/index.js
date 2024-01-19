userInput = document.getElementById('username');
passInput = document.getElementById('password');
resultOut = document.getElementById('result');

function submit() {
    console.log(`submit: ${userInput.value}`);
    const o = { user: userInput.value, passwd: passInput.value };
    fetch('', {
        method: 'POST',
        body: JSON.stringify(o),
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => {
            displayResult(res);
        })
        .catch((err) => {
            console.log('Georg');
            console.log(err.message);
        });
}
async function displayResult(res) {
    const str = JSON.stringify(await res.json(), null, 2);
    console.log(str);
    resultOut.innerHTML = `Status: ${res.status}<br>${str}`;
}
