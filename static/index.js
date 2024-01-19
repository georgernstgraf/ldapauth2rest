userInput = document.getElementById('username');
passInput = document.getElementById('password');
resultOut = document.getElementById('result');
outbox = document.getElementById('outbox');
function submit() {
    console.log(`submit: ${userInput.value}`);
    const o = { user: userInput.value, passwd: passInput.value };
    fetch('', {
        method: 'POST',
        body: JSON.stringify(o),
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => {
            return [res.status, res.json()];
        })
        .then((arr) => {
            displayResult(...arr);
        })
        .catch((err) => {
            displayResult(undefined, err.message);
        });
}
const colors = ['#aaf0aa', 'lightgrey', '#f0a7a7', 'lightsalmon', '#9d7149'];
async function displayResult(stat, res) {
    const str = JSON.stringify(res, null, 2);
    //console.log(str);
    resultOut.innerHTML = `Status: ${stat}<br>${str}`;
    stat = stat ? stat : 600;
    outbox.style.backgroundColor = colors[Math.floor(stat / 100) - 2];
}
