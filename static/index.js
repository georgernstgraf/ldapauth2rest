userInput = document.getElementById('username');
passInput = document.getElementById('password');
resultOut = document.getElementById('result');
outbox = document.getElementById('outbox');
let httpStatus;
function submit() {
    console.log(`submit: ${userInput.value}`);
    const o = { user: userInput.value, passwd: passInput.value };
    httpStatus = undefined;
    fetch('', {
        method: 'POST',
        body: JSON.stringify(o),
        headers: { 'Content-Type': 'application/json' },
    })
        .then((res) => {
            httpStatus = res.status;
            return res.json();
        })
        .then((data) => {
            displayResult(data);
        })
        .catch((err) => {
            displayResult(err.message);
        });
}
const colors = ['#aaf0aa', 'lightgrey', '#f0a7a7', 'lightsalmon'];
async function displayResult(res) {
    const str = JSON.stringify(res, null, 2);
    //console.log(str);
    resultOut.innerHTML = `Status: ${httpStatus}<br>${str}`;
    outbox.style.backgroundColor = colors[Math.floor(httpStatus / 100) - 2];
}
